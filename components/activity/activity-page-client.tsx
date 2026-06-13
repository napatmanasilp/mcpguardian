"use client";

import { useState } from "react";
import { Activity } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ExportCsvButton } from "@/components/activity/export-csv-button";
import { EventRow } from "@/components/activity/event-row";
import { shouldShowLoadMore } from "@/lib/utils/activity";
import { createClient } from "@/lib/supabase/client";
import type { MergedEvent } from "@/lib/types/activity";

interface ActivityPageClientProps {
  initialEvents: MergedEvent[];
  organizationId: string;
}

export function ActivityPageClient({ initialEvents, organizationId }: ActivityPageClientProps) {
  const [events, setEvents] = useState<MergedEvent[]>(initialEvents);
  const [lastBatchSize, setLastBatchSize] = useState(initialEvents.length);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    setLoading(true);
    try {
      const supabase = createClient();
      const currentCount = events.length;

      const [threatsResult, alertsResult] = await Promise.all([
        supabase
          .from("tool_invocation_logs")
          .select("id, tool_name, mcp_server_id, was_blocked, threat_type, latency_ms, session_id, created_at")
          .eq("organization_id", organizationId)
          .not("threat_type", "is", null)
          .order("created_at", { ascending: false })
          .range(currentCount, currentCount + 49),
        supabase
          .from("alerts")
          .select("id, alert_type, severity, title, message, session_id, server_id, created_at, read")
          .eq("organization_id", organizationId)
          .order("created_at", { ascending: false })
          .range(currentCount, currentCount + 49),
      ]);

      const threats = threatsResult.data ?? [];
      const alerts = alertsResult.data ?? [];

      const newEvents: MergedEvent[] = [
        ...threats.map((t) => ({
          id: t.id,
          type: "threat" as const,
          title: t.threat_type ?? "Unknown threat",
          description: `Tool: ${t.tool_name}`,
          severity: (t.was_blocked ? "critical" : "high") as "critical" | "high",
          session_id: t.session_id ?? null,
          server_id: t.mcp_server_id ?? null,
          createdAt: t.created_at,
        })),
        ...alerts
          .filter((a) => a.severity === "CRITICAL" || a.severity === "HIGH")
          .map((a) => ({
            id: a.id,
            type: "alert" as const,
            title: a.title,
            description: a.message,
            severity: (a.severity?.toLowerCase() ?? "medium") as "critical" | "high" | "medium",
            session_id: a.session_id ?? null,
            server_id: a.server_id ?? null,
            createdAt: a.created_at,
          })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setEvents((prev) => [...prev, ...newEvents]);
      setLastBatchSize(newEvents.length);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-1">Activity</p>
          <h1 className="text-2xl font-bold tracking-tight">Threat Log</h1>
        </div>
        <ExportCsvButton events={events} />
      </div>

      {events.length > 0 ? (
        <div className="space-y-2">
          {events.map((event) => (
            <EventRow key={`${event.type}-${event.id}`} event={event} />
          ))}

          {shouldShowLoadMore(lastBatchSize) && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={loading}
              >
                {loading ? "Loading…" : "Load more"}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
          <Activity className="size-12 text-slate-600 mb-4" />
          <h2 className="text-lg font-semibold text-slate-300 mb-1">No security events</h2>
          <p className="text-sm text-slate-500">Threat and alert activity will appear here once detected.</p>
        </div>
      )}
    </main>
  );
}
