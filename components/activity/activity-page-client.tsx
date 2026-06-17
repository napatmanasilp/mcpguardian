"use client";

import { useState } from "react";
import { Clock, Crown, Lock, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ExportCsvButton } from "@/components/activity/export-csv-button";
import { EventRow } from "@/components/activity/event-row";
import { shouldShowLoadMore } from "@/lib/utils/activity";
import { createClient } from "@/lib/supabase/client";
import type { MergedEvent } from "@/lib/types/activity";

interface ActivityPageClientProps {
  initialEvents: MergedEvent[];
  organizationId: string;
  currentPlan?: string;
  hasForensicTimeline?: boolean;
}

export function ActivityPageClient({
  initialEvents,
  organizationId,
  currentPlan = "free",
  hasForensicTimeline = false,
}: ActivityPageClientProps) {
  const [events, setEvents] = useState<MergedEvent[]>(initialEvents);
  const [lastBatchSize, setLastBatchSize] = useState(initialEvents.length);
  const [loading, setLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);

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

  const handleUpgrade = async () => {
    setUpgradeLoading(true);
    try {
      const res = await fetch("/api/billing/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "team", billing: "monthly" }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      setUpgradeLoading(false);
    }
  };

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

      {/* Forensic Timeline — gated for Team+ plans */}
      {hasForensicTimeline ? (
        <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
              <Clock className="size-4 text-monitor" />
              Forensic Timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-xs text-slate-500">
              Deep-dive into threat chains with full payload reconstruction, inter-tool dependency graphs,
              and timeline visualization for incident response.
            </p>
            <Button size="sm" variant="outline" className="border-monitor/30 text-monitor text-xs">
              Open Forensic View
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-white/10 bg-[hsl(222,47%,6%)] border-dashed">
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center gap-3">
              <div className="size-10 rounded-full bg-monitor/10 flex items-center justify-center">
                <Lock className="size-5 text-monitor" />
              </div>
              <div className="space-y-1.5 max-w-sm">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center justify-center gap-2">
                  <Sparkles className="size-3.5 text-monitor" />
                  Forensic Timeline
                </h3>
                <p className="text-xs text-slate-500">
                  Reconstruct attack chains, view full tool call payloads, and generate incident reports.
                  Requires Team plan ($99/mo).
                </p>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
                  disabled={upgradeLoading}
                  onClick={handleUpgrade}
                >
                  {upgradeLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Crown className="size-3.5" />}
                  Upgrade to Team
                </Button>
                <Link href="/upgrade">
                  <Button variant="outline" size="sm" className="border-white/10 text-slate-400 text-xs">
                    Compare
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
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
