import { NextRequest } from "next/server";

import { err, ok, isError, requireUser, requireOrg } from "@/lib/api-helpers";

// GET /api/telemetry/servers/[serverId] — per-server telemetry and health
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ serverId: string }> },
) {
  const { serverId } = await params;

  const auth = await requireUser();
  if (isError(auth)) return auth;

  const orgCtx = await requireOrg(auth.user.userId);
  if (isError(orgCtx)) return orgCtx;

  const { org, svc } = orgCtx;

  // Verify server belongs to org
  const { data: server } = await svc
    .from("mcp_servers")
    .select("id, name, endpoint_url")
    .eq("id", serverId)
    .eq("organization_id", org.orgId)
    .single();

  if (!server) return err("NOT_FOUND", "MCP server not found", 404);

  // Fetch health metrics (last 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [healthResult, telemetryResult, sessionResult] = await Promise.all([
    svc
      .from("server_health_metrics")
      .select("recorded_at, is_reachable, latency_ms, error_rate_pct, tool_call_rate_per_minute, threat_rate_per_minute")
      .eq("mcp_server_id", serverId)
      .gte("recorded_at", sevenDaysAgo)
      .order("recorded_at", { ascending: false })
      .limit(168), // 7 days * 24h
    svc
      .from("session_telemetry_snapshots")
      .select("snapshot_at, tool_calls_in_window, avg_latency_ms, p95_latency_ms, p99_latency_ms, threat_count, blocked_count")
      .eq("mcp_server_id", serverId)
      .gte("snapshot_at", sevenDaysAgo)
      .order("snapshot_at", { ascending: false })
      .limit(168),
    svc
      .from("proxy_sessions")
      .select("id, status, started_at, ended_at, tool_call_count, threat_count")
      .eq("mcp_server_id", serverId)
      .order("started_at", { ascending: false })
      .limit(50),
  ]);

  return ok({
    server: {
      id: server.id,
      name: server.name,
      endpointUrl: server.endpoint_url,
    },
    health: healthResult ?? [],
    telemetry: telemetryResult ?? [],
    sessions: sessionResult ?? [],
  });
}
