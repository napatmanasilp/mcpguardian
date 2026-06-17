import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { getOrgContext } from "@/lib/data/org-context";
import { createServiceClient } from "@/lib/supabase/service";
import { ActivityPageClient } from "@/components/activity/activity-page-client";
import { EmptyState } from "@/components/ui/empty-state";
import { EMPTY_STATES } from "@/lib/ui/empty-states";
import { hasFeature } from "@/lib/feature-gates";
import type { MergedEvent } from "@/lib/types/activity";

export const metadata: Metadata = {
  title: "Threat Log — MCPGuardian",
  description: "View detected security threats and tool invocation anomalies.",
};

export default async function ActivityPage() {
  const orgContext = await getOrgContext();
  if (!orgContext) redirect("/onboarding");

  const { organizationId } = orgContext;
  const svc = createServiceClient();

  const { data: threats, error } = await svc
    .from("tool_invocation_logs")
    .select("id, tool_name, mcp_server_id, was_blocked, threat_type, description, severity, session_id, created_at")
    .eq("organization_id", organizationId)
    .not("threat_type", "is", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message ?? "Failed to load threat log data");
  }

  const events: MergedEvent[] = (threats ?? []).map((t) => ({
    id: t.id,
    type: "threat" as const,
    title: t.tool_name ?? "Unknown",
    description: t.description ?? `Threat: ${t.threat_type}`,
    severity: mapSeverity(t.severity, t.was_blocked),
    session_id: t.session_id ?? null,
    server_id: t.mcp_server_id ?? null,
    createdAt: t.created_at,
  }));

  if (events.length === 0) {
    const emptyConfig = EMPTY_STATES["activity"];
    return (
      <main className="flex flex-1 flex-col gap-6 p-4 md:p-6 overflow-x-hidden">
        <div>
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-1">Activity</p>
          <h1 className="text-2xl font-bold tracking-tight">Threat Log</h1>
        </div>
        <EmptyState
          icon={emptyConfig.icon}
          heading={emptyConfig.heading}
          description={emptyConfig.description}
          cta={emptyConfig.cta}
        />
      </main>
    );
  }

  return (
    <ActivityPageClient
      initialEvents={events}
      organizationId={organizationId}
      currentPlan={orgContext.plan}
      hasForensicTimeline={hasFeature(orgContext.plan, "forensic_timeline")}
    />
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
  // Fallback: blocked → critical, otherwise high
  return wasBlocked ? "critical" : "high";
}
