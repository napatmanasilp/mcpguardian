import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, FileText, Radar, ScanSearch, Terminal, Activity } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ServerActions } from "@/components/servers/server-actions";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ serverId: string }>;
}): Promise<Metadata> {
  const { serverId } = await params;
  const svc = createServiceClient();
  const { data: server } = await svc
    .from("mcp_servers")
    .select("name")
    .eq("id", serverId)
    .maybeSingle();

  if (server?.name) {
    const name = server.name.length > 30 ? server.name.slice(0, 27) + "..." : server.name;
    const title = `${name} — Servers — MCPGuardian`.slice(0, 60);
    return {
      title,
      description: `Security details and scan history for ${server.name}.`.slice(0, 160),
    };
  }

  return {
    title: "Server — MCPGuardian",
    description: "View server security details, risk score, and scan history.",
  };
}

const ServerDetailPage = async ({
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
    .select("*")
    .eq("id", serverId)
    .eq("organization_id", membership.organization_id)
    .single();

  if (!server) notFound();

  const { data: recentScans } = await svc
    .from("scans")
    .select("id, overall_result, risk_score, status, created_at")
    .eq("organization_id", membership.organization_id)
    .eq("mcp_server_id", serverId)
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: recentSessions } = await svc
    .from("proxy_sessions")
    .select("id, status, tool_call_count, created_at, ended_at")
    .eq("mcp_server_id", serverId)
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: false })
    .limit(5);

  const { data: recentHealth } = await svc
    .from("server_health_metrics")
    .select("is_reachable, latency_ms, error_rate_pct, tool_call_rate_per_minute, recorded_at")
    .eq("mcp_server_id", serverId)
    .eq("organization_id", membership.organization_id)
    .order("recorded_at", { ascending: false })
    .limit(24);

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      {/* Breadcrumb + Header */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/servers" className="hover:text-slate-300 transition-colors">Servers</Link>
        <span>/</span>
        <span className="text-slate-300">{server.name}</span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-1">
            Server Detail
          </p>
          <h1 className="text-2xl font-bold tracking-tight">{server.name}</h1>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
            <Badge variant={server.transport_type === "http" ? "default" : "secondary"} className="text-[10px]">
              {server.transport_type === "http" ? "HTTP" : <><Terminal className="size-2.5 mr-1" /> STDIO</>}
            </Badge>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px]",
                server.allowlist_status === "approved" && "border-secure/30 text-secure",
                server.allowlist_status === "blocked" && "border-threat/30 text-threat",
                server.allowlist_status === "monitoring" && "border-caution/30 text-caution",
              )}
            >
              {server.allowlist_status}
            </Badge>
            {server.risk_score != null && (
              <span className={cn(
                server.last_scan_result === "clean" ? "text-secure" :
                server.last_scan_result === "suspicious" ? "text-caution" :
                server.last_scan_result === "malicious" ? "text-threat" : ""
              )}>
                Risk: {server.risk_score}/100
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <ServerActions
            serverId={serverId}
            serverName={server.name}
            transportType={server.transport_type}
            endpointUrl={server.endpoint_url}
            stdioCommand={server.stdio_command}
          />
          <Link href={`/servers/${serverId}/scans`}>
            <Button size="sm" variant="outline" className="border-white/10 gap-1.5">
              <FileText className="size-3.5" />
              Scans
            </Button>
          </Link>
          <Link href={`/servers/${serverId}/telemetry`}>
            <Button size="sm" variant="outline" className="border-white/10 gap-1.5">
              <Activity className="size-3.5" />
              Telemetry
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
          <CardContent className="p-4 text-center">
            <p className="text-lg font-bold font-mono text-blue-400">{recentHealth?.[0]?.is_reachable ? "Up" : "Unknown"}</p>
            <p className="text-[10px] text-slate-500">Status</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
          <CardContent className="p-4 text-center">
            <p className="text-lg font-bold font-mono text-slate-200">{recentHealth?.[0]?.latency_ms != null ? `${recentHealth[0].latency_ms}ms` : "—"}</p>
            <p className="text-[10px] text-slate-500">Latency</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
          <CardContent className="p-4 text-center">
            <p className="text-lg font-bold font-mono text-slate-200">{recentSessions?.filter((s) => s.status === "active").length ?? 0}</p>
            <p className="text-[10px] text-slate-500">Active Sessions</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
          <CardContent className="p-4 text-center">
            <p className="text-lg font-bold font-mono text-slate-200">{recentScans?.length ?? 0}</p>
            <p className="text-[10px] text-slate-500">Total Scans</p>
          </CardContent>
        </Card>
      </div>

      {/* Health History */}
      {recentHealth && recentHealth.length > 0 && (
        <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
              <Activity className="size-4 text-blue-400" />
              Recent Health (last 24 checks)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {recentHealth.slice(0, 12).map((h, i) => (
              <div key={i} className="flex items-center gap-3 text-xs">
                <div className={cn("size-2 rounded-full shrink-0", h.is_reachable ? "bg-emerald-500" : "bg-red-500")} />
                <span className="font-mono text-slate-400 w-16">{h.latency_ms != null ? `${h.latency_ms}ms` : "—"}</span>
                <span className="text-slate-500">{h.error_rate_pct != null ? `${h.error_rate_pct}% err` : "—"}</span>
                <span className="text-slate-500 ml-auto">{new Date(h.recorded_at).toLocaleTimeString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent Scans */}
      {recentScans && recentScans.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <ScanSearch className="size-4 text-slate-400" />
            Recent Scans
            <Link href={`/servers/${serverId}/scans`}>
              <Button size="sm" variant="link" className="text-xs text-blue-400 ml-2">View all</Button>
            </Link>
          </h2>
          <div className="space-y-2">
            {recentScans.slice(0, 5).map((scan) => (
              <Link key={scan.id} href={`/reports/${scan.id}`}>
                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 hover:bg-white/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "font-mono text-sm font-bold",
                      (scan.risk_score ?? 0) <= 30 ? "text-emerald-400" :
                      (scan.risk_score ?? 0) <= 60 ? "text-amber-400" :
                      "text-red-400"
                    )}>
                      Risk: {scan.risk_score ?? "—"}
                    </span>
                    <span className="text-xs text-slate-400 capitalize">{scan.overall_result ?? scan.status}</span>
                  </div>
                  <span className="text-xs text-slate-500">{new Date(scan.created_at).toLocaleString()}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent Sessions */}
      {recentSessions && recentSessions.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <Radar className="size-4 text-slate-400" />
            Recent Sessions
            <Link href="/sessions">
              <Button size="sm" variant="link" className="text-xs text-blue-400 ml-2">View all</Button>
            </Link>
          </h2>
          <div className="space-y-2">
            {recentSessions.map((session) => (
              <Link key={session.id} href={`/sessions/${session.id}`}>
                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 hover:bg-white/10 transition-colors">
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={session.status === "active" ? "default" : "secondary"}
                      className={cn(
                        "text-[10px]",
                        session.status === "active" && "bg-emerald-500/20 text-emerald-400",
                        session.status?.startsWith("terminated") && "bg-red-500/20 text-red-400",
                      )}
                    >
                      {session.status}
                    </Badge>
                    <span className="text-xs text-slate-400">{session.tool_call_count ?? 0} calls</span>
                  </div>
                  <span className="text-xs text-slate-500">
                    {session.ended_at ? new Date(session.ended_at).toLocaleString() : new Date(session.created_at).toLocaleString()}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
};

export default ServerDetailPage;
