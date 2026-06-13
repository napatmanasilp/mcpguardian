"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { useRealtime } from "@/components/providers/realtime-provider";
import { cn } from "@/lib/utils";
import type { Alert } from "@/lib/types/alerts";

interface AlertRowProps {
  alert: Alert;
}

export function AlertRow({ alert }: AlertRowProps) {
  const router = useRouter();
  const { decrementAlertCount, incrementAlertCount } = useRealtime();

  // Optimistic local state for read status
  const [optimisticRead, setOptimisticRead] = useState(alert.read);

  // In-flight flag to prevent duplicate clicks (Req 17.5)
  const inFlightRef = useRef(false);

  const severityIcon = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical":
        return <span className="size-3 rounded-full bg-threat shrink-0" />;
      case "high":
        return <span className="size-3 rounded-full bg-threat shrink-0" />;
      case "medium":
        return <span className="size-3 rounded-full bg-caution shrink-0" />;
      default:
        return <span className="size-3 rounded-full bg-monitor shrink-0" />;
    }
  };

  const relativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
  };

  /**
   * Resolves the navigation target based on alert fields:
   * 1. session_id non-null → /sessions/{session_id}
   * 2. server_id non-null → /servers/{server_id}
   * 3. Both null → /activity
   */
  const resolveTarget = (): string => {
    if (alert.session_id) return `/sessions/${alert.session_id}`;
    if (alert.server_id) return `/servers/${alert.server_id}`;
    return "/activity";
  };

  const handleClick = useCallback(async () => {
    // Ignore duplicate clicks while in flight (Req 17.5)
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    const wasUnread = !optimisticRead;

    // Step 1: Optimistic update — mark as read immediately (< 100ms) (Req 17.1)
    if (wasUnread) {
      setOptimisticRead(true);
      decrementAlertCount();
    }

    try {
      // Step 2: Fire server action in background
      const res = await fetch(`/api/alerts/${alert.id}/mark-read`, {
        method: "POST",
      });

      // Step 3: Resolve navigation target
      let target = resolveTarget();

      // Handle 404 — the referenced session/server no longer exists
      if (res.status === 404) {
        // Revert optimistic update on failure (Req 17.2)
        if (wasUnread) {
          setOptimisticRead(false);
          incrementAlertCount();
        }
        toast.error("Could not mark alert as read");
        target = "/activity";
      } else if (!res.ok) {
        // Server action failed — revert + toast (Req 17.2)
        if (wasUnread) {
          setOptimisticRead(false);
          incrementAlertCount();
        }
        toast.error("Could not mark alert as read");
        target = "/activity";
      }

      // Step 4: Navigate
      router.push(target);
    } catch {
      // Network error — revert optimistic update + toast (Req 17.2)
      if (wasUnread) {
        setOptimisticRead(false);
        incrementAlertCount();
      }
      toast.error("Could not mark alert as read");
      router.push("/activity");
    } finally {
      inFlightRef.current = false;
    }
  }, [alert.id, optimisticRead, decrementAlertCount, incrementAlertCount, router]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      className={cn(
        "flex items-start gap-4 rounded-lg border px-4 py-3 transition-colors hover:bg-white/[0.03] cursor-pointer",
        inFlightRef.current && "opacity-60 pointer-events-none",
        !optimisticRead
          ? "border-l-4 border-l-monitor border-white/10 bg-[hsl(222,47%,6%)]"
          : "border-white/5 bg-white/[0.02]",
      )}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex items-center gap-2 shrink-0">
          {severityIcon(alert.severity)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p
              className={cn(
                "text-sm font-medium truncate",
                !optimisticRead ? "text-slate-200" : "text-slate-400",
              )}
            >
              {alert.title}
            </p>
            <Badge
              variant={
                alert.severity.toLowerCase() === "critical"
                  ? "destructive"
                  : alert.severity.toLowerCase() === "high"
                    ? "default"
                    : "secondary"
              }
              className="text-[9px] shrink-0"
            >
              {alert.severity}
            </Badge>
          </div>
          <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">
            {alert.message}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">
            {relativeTime(alert.created_at)}
          </p>
        </div>
      </div>
      {!optimisticRead && (
        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-monitor" />
      )}
    </div>
  );
}
