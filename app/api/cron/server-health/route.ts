// SECTION 4.3 — Server Health Metrics Cron
// Schedule: every 5 minutes (vercel.json)
//
// For each mcp_server with active proxy_session in last 24h:
//   - Ping server endpoint, record latency + reachability
//   - Calculate error_rate from last 100 tool_invocation_logs
//   - Calculate tool_call_rate from last 5 minutes of logs
//   - Calculate threat_rate from last 5 minutes of logs
//   - INSERT server_health_metrics record
//   - Purge records older than 48h for this server

import { NextRequest, NextResponse } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const svc = createServiceClient();
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000).toISOString();
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
  let serversPinged = 0;
  let metricsRecorded = 0;
  let recordsPurged = 0;
  let errors = 0;

  // Find servers with active proxy sessions in the last 24h
  const { data: activeServers } = await svc
    .from("proxy_sessions")
    .select("mcp_server_id")
    .eq("status", "active")
    .gte("started_at", twentyFourHoursAgo);

  if (!activeServers || activeServers.length === 0) {
    return NextResponse.json({
      success: true,
      serversPinged: 0,
      metricsRecorded: 0,
      recordsPurged: 0,
      errors: 0,
    });
  }

  // Deduplicate server IDs
  const serverIds = [...new Set(activeServers.map((s) => s.mcp_server_id))];

  for (const serverId of serverIds) {
    try {
      // Fetch server config
      const { data: server } = await svc
        .from("mcp_servers")
        .select("id, endpoint_url, organization_id")
        .eq("id", serverId)
        .single();

      if (!server || !server.endpoint_url) continue;

      serversPinged++;

      // ── Ping server endpoint ──────────────────────────────────────
      let isReachable: boolean;
      let latencyMs: number | null;
      const pingStart = Date.now();

      try {
        const pingResponse = await fetch(server.endpoint_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "tools/list",
            id: `health-${serverId}-${Date.now()}`,
          }),
          signal: AbortSignal.timeout(5000),
        });
        latencyMs = Date.now() - pingStart;
        isReachable = pingResponse.ok;
      } catch {
        latencyMs = null;
        isReachable = false;
      }

      // ── Calculate error_rate from last 100 invocations ────────────
      const { count: totalCalls } = await svc
        .from("tool_invocation_logs")
        .select("*", { count: "exact", head: true })
        .eq("mcp_server_id", serverId)
        .eq("organization_id", server.organization_id)
        .limit(100);

      const { count: errorCalls } = await svc
        .from("tool_invocation_logs")
        .select("*", { count: "exact", head: true })
        .eq("mcp_server_id", serverId)
        .eq("organization_id", server.organization_id)
        .not("was_blocked", "is", null)
        .gte("invoked_at", twentyFourHoursAgo);

      const errorRatePct = totalCalls && totalCalls > 0
        ? Math.round(((errorCalls ?? 0) / totalCalls) * 100 * 100) / 100
        : 0;

      // ── Calculate tool_call_rate from last 5 minutes ──────────────
      const { count: recentCalls } = await svc
        .from("tool_invocation_logs")
        .select("*", { count: "exact", head: true })
        .eq("mcp_server_id", serverId)
        .eq("organization_id", server.organization_id)
        .gte("invoked_at", fiveMinutesAgo);

      const toolCallRatePerMinute = recentCalls ? Math.round((recentCalls / 5) * 100) / 100 : 0;

      // ── Calculate threat_rate from last 5 minutes ─────────────────
      const { count: recentThreats } = await svc
        .from("tool_invocation_logs")
        .select("*", { count: "exact", head: true })
        .eq("mcp_server_id", serverId)
        .eq("organization_id", server.organization_id)
        .gte("invoked_at", fiveMinutesAgo)
        .not("threats_detected", "is", null);

      const threatRatePerMinute = recentThreats ? Math.round((recentThreats / 5) * 100) / 100 : 0;

      // ── INSERT server_health_metrics record ───────────────────────
      await svc.from("server_health_metrics").insert({
        organization_id: server.organization_id,
        mcp_server_id: serverId,
        recorded_at: now.toISOString(),
        is_reachable: isReachable,
        latency_ms: latencyMs,
        error_rate_pct: errorRatePct,
        tool_call_rate_per_minute: toolCallRatePerMinute,
        threat_rate_per_minute: threatRatePerMinute,
      });

      metricsRecorded++;

      // ── Purge records older than 48h for this server ──────────────
      const { count: deleted } = await svc
        .from("server_health_metrics")
        .delete()
        .eq("mcp_server_id", serverId)
        .lt("recorded_at", fortyEightHoursAgo);

      recordsPurged += deleted ?? 0;
    } catch {
      errors++;
    }
  }

  console.log(
    `[server-health-cron] pinged=${serversPinged} recorded=${metricsRecorded} purged=${recordsPurged} errors=${errors}`,
  );

  return NextResponse.json({
    success: true,
    serversPinged,
    metricsRecorded,
    recordsPurged,
    errors,
  });
}
