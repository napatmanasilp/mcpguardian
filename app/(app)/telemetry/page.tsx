import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, ArrowRight, Server } from "lucide-react";

export const metadata: Metadata = {
  title: "Telemetry — MCPGuardian",
  description: "Monitor server health metrics, latency sparklines, and uptime percentages.",
};

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkline } from "@/components/telemetry/sparkline";
import { EmptyState } from "@/components/ui/empty-state";
import { getOrgContext } from "@/lib/data/org-context";
import { createServiceClient } from "@/lib/supabase/service";
import { EMPTY_STATES } from "@/lib/ui/empty-states";
import { computeUptime, hasInsufficientData } from "@/lib/utils/telemetry";
import { cn } from "@/lib/utils";

const TelemetryPage = async () => {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/onboarding");

  const svc = createServiceClient();
  const orgId = ctx.organizationId;

  // Calculate the date 30 days ago for health metrics query
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Aggregate stats
  const [serversRes, activeSessionsRes, healthMetricsRes, recentInvocationsRes] = await Promise.all([
    svc.from("mcp_servers").select("id, name, risk_score, allowlist_status").eq("organization_id", orgId),
    svc.from("proxy_sessions").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "active"),
    svc
      .from("server_health_metrics")
      .select("server_id, latency_ms, is_reachable, recorded_at")
      .eq("organization_id", orgId)
      .gte("recorded_at", thirtyDaysAgo)
      .order("recorded_at", { ascending: true }),
    svc.from("tool_invocation_logs").select("tool_name, was_blocked, threat_type, latency_ms, session_id, created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(20),
  ]);

  const servers = serversRes.data ?? [];
  const activeSessions = activeSessionsRes.count ?? 0;
  const healthMetrics = healthMetricsRes.data ?? [];
  const recentInvocations = recentInvocationsRes.data ?? [];

  // Group health metrics by server_id
  const metricsByServer = new Map<string, typeof healthMetrics>();
  for (const metric of healthMetrics) {
    const existing = metricsByServer.get(metric.server_id) ?? [];
    existing.push(metric);
    metricsByServer.set(metric.server_id, existing);
  }

  // For the stats cards, derive reachable servers and avg latency from the full metrics set
  const reachableServers = new Set<string>();
  for (const metric of healthMetrics) {
    if (metric.is_reachable) {
      reachableServers.add(metric.server_id);
    }
  }

  const avgLatency = healthMetrics.length > 0
    ? Math.round(healthMetrics.reduce((s, h) => s + (h.latency_ms ?? 0), 0) / healthMetrics.length)
    : null;

  // Empty state: no servers means no telemetry data
  if (servers.length === 0) {
    return (
      <main className="flex flex-1 flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-1">Telemetry</p>
            <h1 className="text-2xl font-bold tracking-tight">Telemetry Overview</h1>
          </div>
        </div>
        <EmptyState {...EMPTY_STATES["telemetry"]} />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-1">Telemetry</p>
          <h1 className="text-2xl font-bold tracking-tight">Telemetry Overview</h1>
        </div>
        <Link href="/activity" className="text-xs text-monitor hover:underline">
          View full log →
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
          <CardContent className="p-4 text-center">
            <p className="text-lg font-bold font-mono text-monitor">{servers.length}</p>
            <p className="text-[10px] text-slate-500">Servers</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
          <CardContent className="p-4 text-center">
            <p className="text-lg font-bold font-mono text-secure">{activeSessions}</p>
            <p className="text-[10px] text-slate-500">Active Sessions</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
          <CardContent className="p-4 text-center">
            <p className="text-lg font-bold font-mono text-slate-200">{reachableServers.size}/{servers.length}</p>
            <p className="text-[10px] text-slate-500">Reachable</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
          <CardContent className="p-4 text-center">
            <p className="text-lg font-bold font-mono text-slate-200">{avgLatency !== null ? `${avgLatency}ms` : "—"}</p>
            <p className="text-[10px] text-slate-500">Avg Latency</p>
          </CardContent>
        </Card>
      </div>

      {/* Servers with Sparklines and Uptime */}
      {servers.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <Server className="size-4 text-slate-400" />
            Servers
          </h2>
          <div className="space-y-2">
            {servers.map((srv) => {
              const serverMetrics = metricsByServer.get(srv.id) ?? [];
              const hasInsufficient = hasInsufficientData(serverMetrics.length);

              // Take the 24 most recent records for sparkline data
              const sparklineMetrics = serverMetrics.slice(-24);
              const sparklineData = sparklineMetrics.map((m) => m.latency_ms ?? 0);

              // Compute uptime from all metrics for this server
              const uptime = computeUptime(
                serverMetrics.map((m) => ({
                  recorded_at: m.recorded_at,
                  is_reachable: m.is_reachable,
                }))
              );

              return (
                <Link key={srv.id} href={`/servers/${srv.id}/telemetry`}>
                  <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 hover:bg-white/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={cn("size-2 rounded-full shrink-0", reachableServers.has(srv.id) ? "bg-secure" : "bg-threat")} />
                      <span className="text-sm text-slate-200">{srv.name}</span>
                      {srv.risk_score != null && (
                        <span className={cn("text-xs font-mono", srv.risk_score >= 70 ? "text-threat" : srv.risk_score >= 40 ? "text-caution" : "text-secure")}>
                          {srv.risk_score}/100
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Sparkline or Insufficient data */}
                      {hasInsufficient ? (
                        <span className="text-xs text-slate-500 italic">Insufficient data</span>
                      ) : (
                        <>
                          <Sparkline data={sparklineData} width={100} height={28} />
                          <span className="text-xs font-mono text-slate-300 min-w-[52px] text-right">
                            {uptime}
                          </span>
                        </>
                      )}
                      <ArrowRight className="size-3.5 text-slate-500" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Invocations */}
      {recentInvocations.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <Activity className="size-4 text-slate-400" />
            Recent Invocations
          </h2>
          <div className="space-y-1">
            {recentInvocations.map((inv, i) => (
              <div key={i} className="flex items-center gap-3 rounded-md bg-white/5 px-3 py-2 text-xs">
                <div className={cn(
                  "size-2 rounded-full shrink-0",
                  inv.was_blocked ? "bg-threat" : inv.threat_type ? "bg-caution" : "bg-secure",
                )} />
                <span className="font-mono text-slate-300 flex-1 truncate">{inv.tool_name}</span>
                {inv.threat_type && <Badge variant="destructive" className="text-[9px]">{inv.threat_type}</Badge>}
                {inv.latency_ms != null && <span className="text-slate-500">{inv.latency_ms}ms</span>}
                <span className="text-slate-500">{new Date(inv.created_at).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
};

export default TelemetryPage;
