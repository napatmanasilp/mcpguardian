import { err, ok, isError, requireUser, requireOrg } from "@/lib/api-helpers";

// GET /api/telemetry/overview — aggregate telemetry stats for the org dashboard
export async function GET() {
  const auth = await requireUser();
  if (isError(auth)) return auth;

  const orgCtx = await requireOrg(auth.user.userId);
  if (isError(orgCtx)) return orgCtx;

  const { org, svc } = orgCtx;

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: recentSessions },
    { data: activeSessions },
    { count: totalToolCalls },
    { count: totalThreats },
    { count: totalBlocked },
    { data: avgLatency },
    { data: healthMetrics },
  ] = await Promise.all([
    // Recent session telemetry (last 24h)
    svc
      .from("session_telemetry_snapshots")
      .select("tool_calls_in_window, avg_latency_ms, threat_count, blocked_count, snapshot_at")
      .eq("organization_id", org.orgId)
      .gte("snapshot_at", twentyFourHoursAgo)
      .order("snapshot_at", { ascending: false })
      .limit(100),
    // Active sessions count
    svc
      .from("proxy_sessions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org.orgId)
      .eq("status", "active"),
    // Total tool calls (7 days)
    svc
      .from("tool_invocation_logs")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", org.orgId)
      .gte("invoked_at", sevenDaysAgo),
    // Total threats detected (7 days)
    svc
      .from("tool_invocation_logs")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", org.orgId)
      .gte("invoked_at", sevenDaysAgo)
      .not("threats_detected", "is", null),
    // Total blocked calls (7 days)
    svc
      .from("tool_invocation_logs")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", org.orgId)
      .eq("was_blocked", true)
      .gte("invoked_at", sevenDaysAgo),
    // Average latency
    svc
      .from("session_telemetry_snapshots")
      .select("avg_latency_ms")
      .eq("organization_id", org.orgId)
      .not("avg_latency_ms", "is", null)
      .order("snapshot_at", { ascending: false })
      .limit(50),
    // Server health
    svc
      .from("server_health_metrics")
      .select("mcp_server_id, is_reachable, error_rate_pct, tool_call_rate_per_minute")
      .eq("organization_id", org.orgId)
      .order("recorded_at", { ascending: false })
      .limit(50),
  ]);

  // Compute average of non-null latencies
  const latencies = (avgLatency ?? [])
    .map((r) => r.avg_latency_ms)
    .filter((l): l is number => l !== null);
  const avgLatencyMs =
    latencies.length > 0
      ? latencies.reduce((a, b) => a + b, 0) / latencies.length
      : null;

  // Compute tool call volume from recent snapshots
  const totalVolume = (recentSessions ?? []).reduce(
    (sum, s) => sum + (s.tool_calls_in_window ?? 0),
    0,
  );

  return ok({
    period: {
      last24h: twentyFourHoursAgo,
      last7d: sevenDaysAgo,
    },
    activeSessions: activeSessions ?? 0,
    toolCalls7d: totalToolCalls ?? 0,
    toolCallVolume24h: totalVolume,
    threatsDetected7d: totalThreats ?? 0,
    blockedCalls7d: totalBlocked ?? 0,
    avgLatencyMs,
    serverHealthCount: (healthMetrics ?? []).length,
    serversDegraded: (healthMetrics ?? []).filter((h) => h.is_reachable === false).length,
  });
}
