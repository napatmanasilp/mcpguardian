import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { MergedEvent } from "@/lib/types/activity";
import { ActivityPageClient } from "@/components/activity/activity-page-client";

export const metadata: Metadata = {
  title: "Threat Log — MCPGuardian",
};

const ActivityPage = async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const svc = createServiceClient();
  const { data: membership } = await svc
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("invitation_status", "accepted")
    .single();

  if (!membership) redirect("/onboarding");

  const [threatsResult, alertsResult] = await Promise.all([
    svc
      .from("tool_invocation_logs")
      .select("id, tool_name, mcp_server_id, was_blocked, threat_type, latency_ms, session_id, created_at")
      .eq("organization_id", membership.organization_id)
      .not("threat_type", "is", null)
      .order("created_at", { ascending: false })
      .limit(50),
    svc
      .from("alerts")
      .select("id, alert_type, severity, title, message, session_id, server_id, created_at, read")
      .eq("organization_id", membership.organization_id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const threats = threatsResult.data ?? [];
  const alerts = alertsResult.data ?? [];

  // Merge and sort by created_at
  const allEvents: MergedEvent[] = [
    ...threats.map((t) => ({
      id: t.id,
      type: "threat" as const,
      title: t.threat_type ?? "Unknown threat",
      description: `Tool: ${t.tool_name}`,
      severity: t.was_blocked ? "critical" as const : "high" as const,
      session_id: t.session_id ?? null,
      server_id: t.mcp_server_id ?? null,
      createdAt: t.created_at,
    })),
    ...alerts.filter((a) => a.severity === "CRITICAL" || a.severity === "HIGH").map((a) => ({
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

  return (
    <ActivityPageClient
      initialEvents={allEvents}
      organizationId={membership.organization_id}
    />
  );
};

export default ActivityPage;
