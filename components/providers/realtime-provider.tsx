"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";

interface RealtimeContextValue {
  /** Current unread alert count (incremented live via Realtime) */
  alertCount: number;
  /** Whether we are actively trying to reconnect */
  reconnecting: boolean;
  /** Whether reconnection has permanently failed (5 attempts exhausted) */
  connectionFailed: boolean;
  /** Manually retry the connection after permanent failure */
  retry: () => void;
  /** Updated risk scores keyed by server ID */
  riskScores: Record<string, number>;
  /** Decrement the alert count (used for optimistic mark-as-read) */
  decrementAlertCount: () => void;
  /** Increment the alert count (used to revert on failed mark-as-read) */
  incrementAlertCount: () => void;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  alertCount: 0,
  reconnecting: false,
  connectionFailed: false,
  retry: () => {},
  riskScores: {},
  decrementAlertCount: () => {},
  incrementAlertCount: () => {},
});

export function useRealtime() {
  return useContext(RealtimeContext);
}

interface RealtimeProviderProps {
  organizationId: string;
  initialAlertCount?: number;
  children: React.ReactNode;
}

const MAX_BACKOFF = 30_000; // 30 seconds max
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECTING_INDICATOR_DELAY = 5_000; // 5 seconds before showing indicator

export function RealtimeProvider({
  organizationId,
  initialAlertCount = 0,
  children,
}: RealtimeProviderProps) {
  const [alertCount, setAlertCount] = useState(initialAlertCount);
  const [reconnecting, setReconnecting] = useState(false);
  const [connectionFailed, setConnectionFailed] = useState(false);
  const [riskScores, setRiskScores] = useState<Record<string, number>>({});

  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const supabaseRef = useRef(createClient());

  // Re-fetch alert count and risk scores from the server on reconnect
  const refetchData = useCallback(async () => {
    try {
      const supabase = supabaseRef.current;

      // Re-fetch unread alert count
      const { count } = await supabase
        .from("alerts")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("read", false);

      if (mountedRef.current && count !== null) {
        setAlertCount(count);
      }

      // Re-fetch risk scores for all org servers
      const { data: servers } = await supabase
        .from("mcp_servers")
        .select("id, risk_score")
        .eq("organization_id", organizationId);

      if (mountedRef.current && servers) {
        const scores: Record<string, number> = {};
        for (const server of servers) {
          if (server.risk_score !== null) {
            scores[server.id] = server.risk_score;
          }
        }
        setRiskScores(scores);
      }
    } catch {
      // Silently fail — data will be stale until next successful fetch
    }
  }, [organizationId]);

  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (disconnectTimerRef.current) {
      clearTimeout(disconnectTimerRef.current);
      disconnectTimerRef.current = null;
    }
  }, []);

  const subscribe = useCallback(() => {
    const supabase = supabaseRef.current;

    // Remove existing channel if any
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`org-${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "alerts",
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          if (mountedRef.current) {
            setAlertCount((prev) => prev + 1);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "mcp_servers",
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          if (mountedRef.current && payload.new) {
            const record = payload.new as { id: string; risk_score: number | null };
            if (record.risk_score !== null) {
              setRiskScores((prev) => ({
                ...prev,
                [record.id]: record.risk_score!,
              }));
            }
          }
        },
      )
      .subscribe((status) => {
        if (!mountedRef.current) return;

        if (status === "SUBSCRIBED") {
          // Successfully connected
          clearTimers();
          setReconnecting(false);
          setConnectionFailed(false);
          reconnectAttemptsRef.current = 0;

          // Re-fetch data on reconnect to sync any missed events
          refetchData();
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          handleDisconnect();
        } else if (status === "CLOSED") {
          handleDisconnect();
        }
      });

    channelRef.current = channel;
  }, [organizationId, clearTimers, refetchData]);

  const handleDisconnect = useCallback(() => {
    if (!mountedRef.current) return;

    // Start 5s timer to show "Reconnecting" indicator
    if (!disconnectTimerRef.current) {
      disconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) {
          setReconnecting(true);
        }
      }, RECONNECTING_INDICATOR_DELAY);
    }

    reconnectAttemptsRef.current += 1;

    if (reconnectAttemptsRef.current > MAX_RECONNECT_ATTEMPTS) {
      // Exhausted all attempts
      clearTimers();
      setReconnecting(false);
      setConnectionFailed(true);
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s, capped at 30s
    const backoff = Math.min(
      1000 * Math.pow(2, reconnectAttemptsRef.current - 1),
      MAX_BACKOFF,
    );

    reconnectTimerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        subscribe();
      }
    }, backoff);
  }, [clearTimers, subscribe]);

  const retry = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    setConnectionFailed(false);
    setReconnecting(false);
    clearTimers();
    subscribe();
  }, [clearTimers, subscribe]);

  const decrementAlertCount = useCallback(() => {
    setAlertCount((prev) => Math.max(0, prev - 1));
  }, []);

  const incrementAlertCount = useCallback(() => {
    setAlertCount((prev) => prev + 1);
  }, []);

  // Initial subscription
  useEffect(() => {
    mountedRef.current = true;

    if (organizationId) {
      subscribe();
    }

    return () => {
      mountedRef.current = false;
      clearTimers();
      if (channelRef.current) {
        supabaseRef.current.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  return (
    <RealtimeContext.Provider
      value={{ alertCount, reconnecting, connectionFailed, retry, riskScores, decrementAlertCount, incrementAlertCount }}
    >
      {children}
      {reconnecting && <ReconnectingIndicator />}
      {connectionFailed && <ConnectionFailedIndicator onRetry={retry} />}
    </RealtimeContext.Provider>
  );
}

/** Subtle "Reconnecting" indicator shown in sidebar area */
function ReconnectingIndicator() {
  return (
    <div
      className="fixed bottom-20 left-4 z-50 flex items-center gap-2 rounded-md border border-border bg-[color:var(--bg-elevated)] px-3 py-2 text-xs text-slate-300 shadow-lg md:bottom-4"
      role="status"
      aria-live="polite"
    >
      <span className="relative flex size-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--caution)] opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-[color:var(--caution)]" />
      </span>
      Reconnecting…
    </div>
  );
}

/** Persistent "Live updates unavailable" indicator with retry button */
function ConnectionFailedIndicator({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="fixed bottom-20 left-4 z-50 flex items-center gap-3 rounded-md border border-border bg-[color:var(--bg-elevated)] px-3 py-2 text-xs text-slate-300 shadow-lg md:bottom-4"
      role="alert"
      aria-live="assertive"
    >
      <span className="flex size-2 rounded-full bg-[color:var(--threat)]" />
      <span>Live updates unavailable</span>
      <button
        type="button"
        onClick={onRetry}
        className="rounded border border-border px-2 py-0.5 text-[10px] font-medium text-slate-200 transition-colors hover:bg-white/10"
      >
        Retry
      </button>
    </div>
  );
}
