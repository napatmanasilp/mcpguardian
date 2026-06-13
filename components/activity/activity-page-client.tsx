"use client";

import { useState } from "react";

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

      const { data: threats } = await supabase
        .from("tool_invocation_logs")
        .select("id, tool_name, mcp_server_id, was_blocked, threat_type, description, severity, session_id, created_at")
        .eq("organization_id", organizationId)
        .not("threat_type", "is", null)
        .order("created_at", { ascending: false })
        .range(currentCount, currentCount + 49);

      const newEvents: MergedEvent[] = (threats ?? []).map((t) => ({
        id: t.id,
        type: "threat" as const,
        title: t.tool_name ?? "Unknown",
        description: t.description ?? `Threat: ${t.threat_type}`,
        severity: mapSeverity(t.severity, t.was_blocked),
        session_id: t.session_id ?? null,
        server_id: t.mcp_server_id ?? null,
        createdAt: t.created_at,
      }));

      setEvents((prev) => [...prev, ...newEvents]);
      setLastBatchSize(newEvents.length);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6 overflow-x-hidden">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-1">Activity</p>
          <h1 className="text-2xl font-bold tracking-tight">Threat Log</h1>
        </div>
        <ExportCsvButton events={events} />
      </div>

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
    </main>
  );
}

/** Maps raw severity from the database or derives it from was_blocked */
function mapSeverity(
  severity: string | null | undefined,
  wasBlocked: boolean
): "critical" | "high" | "medium" {
  if (severity) {
    const lower = severity.toLowerCase();
    if (lower === "critical") return "critical";
    if (lower === "high") return "high";
    if (lower === "medium" || lower === "warning") return "medium";
  }
  return wasBlocked ? "critical" : "high";
}
