import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Activity, ArrowLeft } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cn } from "@/lib/utils";

const ServerTelemetryPage = async ({
  params,
}: {
  params: Promise<{ serverId: string }>;
}) => {
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
  const { serverId } = await params;

  const { data: server } = await svc
    .from("mcp_servers")
    .select("name")
    .eq("id", serverId)
    .eq("organization_id", membership.organization_id)
    .single();

  if (!server) notFound();

  const { data: healthMetrics } = await svc
    .from("server_health_metrics")
    .select("*")
    .eq("server_id", serverId)
    .eq("organization_id", membership.organization_id)
    .order("recorded_at", { ascending: false })
    .limit(100);

  const { data: recentInvocs } = await svc
    .from("tool_invocation_logs")
    .select("tool_name, was_blocked, threat_type, latency_ms, created_at")
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/servers" className="hover:text-slate-300">Servers</Link>
        <span>/</span>
        <Link href={`/servers/${serverId}`} className="hover:text-slate-300">{server.name}</Link>
        <span>/</span>
        <span className="text-slate-300">Telemetry</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Telemetry</h1>
          <p className="text-sm text-slate-500">{server.name}</p>
        </div>
        <Link href={`/servers/${serverId}`}>
          <Button variant="outline" size="sm" className="border-white/10 gap-1.5">
            <ArrowLeft className="size-3.5" />
            Back
          </Button>
        </Link>
      </div>

      {/* Health Metrics Summary */}
      {healthMetrics && healthMetrics.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
              <CardContent className="p-4 text-center">
                <p className="text-lg font-bold font-mono text-secure">
                  {healthMetrics.filter((h) => h.is_reachable).length}/{healthMetrics.length}
                </p>
                <p className="text-[10px] text-slate-500">Reachability</p>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
              <CardContent className="p-4 text-center">
                <p className="text-lg font-bold font-mono text-slate-200">
                  {healthMetrics.length > 0
                    ? `${Math.round(healthMetrics.reduce((s, h) => s + (h.latency_ms ?? 0), 0) / healthMetrics.length)}ms`
                    : "—"}
                </p>
                <p className="text-[10px] text-slate-500">Avg Latency</p>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
              <CardContent className="p-4 text-center">
                <p className="text-lg font-bold font-mono text-caution">
                  {healthMetrics.length > 0
                    ? `${(healthMetrics.reduce((s, h) => s + (h.error_rate_pct ?? 0), 0) / healthMetrics.length).toFixed(1)}%`
                    : "—"}
                </p>
                <p className="text-[10px] text-slate-500">Avg Error Rate</p>
              </CardContent>
            </Card>
            <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
              <CardContent className="p-4 text-center">
                <p className="text-lg font-bold font-mono text-threat">
                  {recentInvocs?.filter((i) => i.was_blocked).length ?? 0}
                </p>
                <p className="text-[10px] text-slate-500">Blocked Calls</p>
              </CardContent>
            </Card>
          </div>

          {/* Health Metric Timeline */}
          <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
                <Activity className="size-4 text-monitor" />
                Health Timeline (last {healthMetrics.length} checks)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 max-h-80 overflow-y-auto">
              {healthMetrics.map((h, i) => (
                <div key={i} className="flex items-center gap-3 py-1 text-xs border-b border-white/5 last:border-0">
                  <div className={cn("size-2 rounded-full shrink-0", h.is_reachable ? "bg-secure" : "bg-threat")} />
                  <span className="font-mono text-slate-400 w-20">{h.latency_ms != null ? `${h.latency_ms}ms` : "—"}</span>
                  <span className="text-slate-500 w-16">{h.error_rate_pct != null ? `${h.error_rate_pct}%` : "—"}</span>
                  <span className="text-slate-500 w-20">{h.tool_call_rate_per_minute != null ? `${h.tool_call_rate_per_minute}/min` : "—"}</span>
                  <span className="text-slate-500 ml-auto">{new Date(h.recorded_at).toLocaleString()}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
          <Activity className="size-12 text-slate-600 mb-4" />
          <h2 className="text-lg font-semibold text-slate-300 mb-1">No telemetry data yet</h2>
          <p className="text-sm text-slate-500">Health metrics will appear once the proxy is connected and active.</p>
        </div>
      )}

      {/* Recent Invocations */}
      {recentInvocs && recentInvocs.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Recent Tool Invocations</h2>
          <div className="space-y-1">
            {recentInvocs.map((inv, i) => (
              <div key={i} className="flex items-center gap-3 rounded-md bg-white/5 px-3 py-2 text-xs">
                <div className={cn(
                  "size-2 rounded-full shrink-0",
                  inv.was_blocked ? "bg-threat" : inv.threat_type ? "bg-caution" : "bg-secure",
                )} />
                <span className="font-mono text-slate-300 truncate flex-1">{inv.tool_name}</span>
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

export default ServerTelemetryPage;
