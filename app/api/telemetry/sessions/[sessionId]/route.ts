import { NextRequest } from "next/server";

import { err, ok, isError, requireUser, requireOrg } from "@/lib/api-helpers";

// GET /api/telemetry/sessions/[sessionId] — per-session telemetry detail
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;

  const auth = await requireUser();
  if (isError(auth)) return auth;

  const orgCtx = await requireOrg(auth.user.userId);
  if (isError(orgCtx)) return orgCtx;

  const { org, svc } = orgCtx;

  // Verify session belongs to org
  const { data: session } = await svc
    .from("proxy_sessions")
    .select("id, mcp_server_id, status, tool_call_count, threat_count, blocked_count, started_at, ended_at")
    .eq("id", sessionId)
    .eq("organization_id", org.orgId)
    .single();

  if (!session) return err("NOT_FOUND", "Session not found", 404);

  // Fetch telemetry snapshots for this session
  const { data: snapshots } = await svc
    .from("session_telemetry_snapshots")
    .select("*")
    .eq("session_id", sessionId)
    .order("snapshot_at", { ascending: false });

  // Fetch invocation logs (last 100)
  const { data: invocations } = await svc
    .from("tool_invocation_logs")
    .select("tool_name, direction, was_blocked, threats_detected, latency_ms, invoked_at")
    .eq("session_id", sessionId)
    .order("invoked_at", { ascending: false })
    .limit(100);

  return ok({
    session: {
      id: session.id,
      mcp_server_id: session.mcp_server_id,
      status: session.status,
      toolCallCount: session.tool_call_count,
      threatCount: session.threat_count,
      blockedCount: session.blocked_count,
      startedAt: session.started_at,
      endedAt: session.ended_at,
    },
    telemetrySnapshots: snapshots ?? [],
    recentInvocations: (invocations ?? []).map((i) => ({
      toolName: i.tool_name,
      direction: i.direction,
      wasBlocked: i.was_blocked,
      threatsDetected: i.threats_detected,
      latencyMs: i.latency_ms,
      invokedAt: i.invoked_at,
    })),
  });
}
