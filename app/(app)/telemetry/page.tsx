import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, ArrowRight, Eye, Radar, Server } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cn } from "@/lib/utils";

const TelemetryPage = async () => {
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

  const orgId = membership.organization_id;

  // Aggregate stats
  const [serversRes, activeSessionsRes, recentHealthRes, recentInvocationsRes] = await Promise.all([
    svc.from("mcp_servers").select("id, name, risk_score, allowlist_status").eq("organization_id", orgId),
    svc.from("proxy_sessions").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "active"),
    svc.from("server_health_metrics").select("server_id, is_reachable, latency_ms, recorded_at").eq("organization_id", orgId).order("recorded_at", { ascending: false }).limit(50),
    svc.from("tool_invocation_logs").select("tool_name, was_blocked, threat_type, latency_ms, session_id, created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(20),
  ]);

  const servers = serversRes.data ?? [];
  const activeSessions = activeSessionsRes.count ?? 0;
  const recentHealth = recentHealthRes.data ?? [];
  const recentInvocations = recentInvocationsRes.data ?? [];

  const reachableServers = new Set(recentHealth.filter((h) => h.is_reachable).map((h) => h.server_id));
  const avgLatency = recentHealth.length > 0
    ? Math.round(recentHealth.reduce((s, h) => s + (h.latency_ms ?? 0), 0) / recentHealth.length)
    : null;

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-1">Telemetry</p>
        <h1 className="text-2xl font-bold tracking-tight">Telemetry Overview</h1>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
          <CardContent className="p-4 text-center">
            <p className="text-lg font-bold font-mono text-blue-400">{servers.length}</p>
            <p className="text-[10px] text-slate-500">Servers</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
          <CardContent className="p-4 text-center">
            <p className="text-lg font-bold font-mono text-emerald-400">{activeSessions}</p>
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

      {/* Servers */}
      {servers.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <Server className="size-4 text-slate-400" />
            Servers
          </h2>
          <div className="space-y-2">
            {servers.map((srv) => (
              <Link key={srv.id} href={`/servers/${srv.id}/telemetry`}>
                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 hover:bg-white/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={cn("size-2 rounded-full shrink-0", reachableServers.has(srv.id) ? "bg-emerald-500" : "bg-red-500")} />
                    <span className="text-sm text-slate-200">{srv.name}</span>
                    {srv.risk_score != null && (
                      <span className={cn("text-xs font-mono", srv.risk_score >= 70 ? "text-red-400" : srv.risk_score >= 40 ? "text-amber-400" : "text-emerald-400")}>
                        {srv.risk_score}/100
                      </span>
                    )}
                  </div>
                  <ArrowRight className="size-3.5 text-slate-500" />
                </div>
              </Link>
            ))}
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
                  inv.was_blocked ? "bg-red-500" : inv.threat_type ? "bg-amber-500" : "bg-emerald-500",
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
