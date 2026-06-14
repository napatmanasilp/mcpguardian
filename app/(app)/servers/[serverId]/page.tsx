import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FileText, Globe, Radar, ScanSearch, Shield, Terminal, Activity, Clock, AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ServerActions } from "@/components/servers/server-actions";
import { RescanButtonWithRefresh } from "@/components/servers/rescan-button-with-refresh";
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
    return {
      title: `${name} — Servers — MCPGuardian`,
      description: `Security details and scan history for ${server.name}.`,
    };
  }

  return {
    title: "Server — MCPGuardian",
    description: "View server security details, risk score, and scan history.",
  };
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
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

  const [scansResult, sessionsResult, healthResult] = await Promise.all([
    svc
      .from("scans")
      .select("id, overall_result, risk_score, status, findings, created_at")
      .eq("mcp_server_id", serverId)
      .order("created_at", { ascending: false })
      .limit(10),
    svc
      .from("proxy_sessions")
      .select("id, status, tool_call_count, threat_count, blocked_count, created_at, ended_at")
      .eq("mcp_server_id", serverId)
      .order("created_at", { ascending: false })
      .limit(5),
    svc
      .from("server_health_metrics")
      .select("is_reachable, latency_ms, error_rate_pct, recorded_at")
      .eq("mcp_server_id", serverId)
      .order("recorded_at", { ascending: false })
      .limit(24),
  ]);

  const recentScans = scansResult.data ?? [];
  const recentSessions = sessionsResult.data ?? [];
  const recentHealth = healthResult.data ?? [];

  // Compute aggregated stats
  const totalScans = recentScans.length;
  const activeSessions = recentSessions.filter((s) => s.status === "active").length;
  const totalToolCalls = server.tool_call_count_total ?? 0;
  const latestHealth = recentHealth[0] ?? null;
  const lastScan = recentScans[0] ?? null;

  // Get latest scan findings count
  const latestFindings = lastScan?.findings as unknown[] ?? [];
  const criticalFindings = (latestFindings as Array<{severity?: string}>).filter((f) => f.severity === "CRITICAL").length;
  const highFindings = (latestFindings as Array<{severity?: string}>).filter((f) => f.severity === "HIGH").length;

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/servers" className="hover:text-slate-300 transition-colors">Servers</Link>
        <span>/</span>
        <span className="text-slate-300">{server.name}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{server.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge variant={server.transport_type === "http" ? "default" : "secondary"} className="text-[10px]">
              {server.transport_type === "http" ? <><Globe className="size-2.5 mr-1" />HTTP</> : <><Terminal className="size-2.5 mr-1" />STDIO</>}
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
            {server.last_scan_at && (
              <span className="text-[10px] text-slate-500">Last scan: {timeAgo(server.last_scan_at)}</span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <RescanButtonWithRefresh serverId={serverId} />
          <ServerActions
            serverId={serverId}
            serverName={server.name}
            transportType={server.transport_type}
            endpointUrl={server.endpoint_url}
            stdioCommand={server.stdio_command}
          />
        </div>
      </div>

      {/* Risk Score Banner */}
      <Card className={cn(
        "border-white/10",
        server.risk_score != null && server.risk_score > 60 ? "bg-threat/5 border-threat/20" :
        server.risk_score != null && server.risk_score > 30 ? "bg-caution/5 border-caution/20" :
        "bg-secure/5 border-secure/20"
      )}>
        <CardContent className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Shield className={cn(
              "size-8",
              server.risk_score != null && server.risk_score > 60 ? "text-threat" :
              server.risk_score != null && server.risk_score > 30 ? "text-caution" :
              "text-secure"
            )} />
            <div>
              <p className="text-sm font-semibold text-slate-200">
                Risk Score: <span className={cn(
                  "font-mono",
                  server.risk_score != null && server.risk_score > 60 ? "text-threat" :
                  server.risk_score != null && server.risk_score > 30 ? "text-caution" :
                  "text-secure"
                )}>{server.risk_score ?? "—"}</span>/100
              </p>
              <p className="text-xs text-slate-500">
                {server.last_scan_result === "clean" && "No threats detected"}
                {server.last_scan_result === "suspicious" && "Potential security concerns found"}
                {server.last_scan_result === "malicious" && "Security threats detected — review findings"}
                {!server.last_scan_result && "No scan completed yet — trigger a rescan"}
              </p>
            </div>
          </div>
          {(criticalFindings > 0 || highFindings > 0) && (
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-threat" />
              <span className="text-xs text-slate-400">
                {criticalFindings > 0 && `${criticalFindings} critical`}
                {criticalFindings > 0 && highFindings > 0 && ", "}
                {highFindings > 0 && `${highFindings} high`}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
          <CardContent className="p-4 text-center">
            <p className="text-lg font-bold font-mono text-blue-400">
              {latestHealth?.is_reachable ? "Up" : server.last_scan_result ? "Unknown" : "—"}
            </p>
            <p className="text-[10px] text-slate-500">Status</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
          <CardContent className="p-4 text-center">
            <p className="text-lg font-bold font-mono text-slate-200">
              {latestHealth?.latency_ms != null ? `${latestHealth.latency_ms}ms` : "—"}
            </p>
            <p className="text-[10px] text-slate-500">Latency</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
          <CardContent className="p-4 text-center">
            <p className="text-lg font-bold font-mono text-slate-200">{totalScans}</p>
            <p className="text-[10px] text-slate-500">Scans</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
          <CardContent className="p-4 text-center">
            <p className="text-lg font-bold font-mono text-slate-200">{activeSessions}</p>
            <p className="text-[10px] text-slate-500">Active Sessions</p>
          </CardContent>
        </Card>
      </div>

      {/* Server Configuration */}
      <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-slate-400">Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="space-y-1">
              <p className="text-slate-500 uppercase tracking-wider text-[10px]">Transport</p>
              <p className="font-mono text-slate-300">{server.transport_type === "http" ? "HTTP (Remote)" : "STDIO (Local)"}</p>
            </div>
            {server.endpoint_url && (
              <div className="space-y-1">
                <p className="text-slate-500 uppercase tracking-wider text-[10px]">Endpoint</p>
                <p className="font-mono text-slate-300 truncate">{server.endpoint_url}</p>
              </div>
            )}
            {server.stdio_command && (
              <div className="space-y-1">
                <p className="text-slate-500 uppercase tracking-wider text-[10px]">Command</p>
                <p className="font-mono text-slate-300 truncate">{server.stdio_command}</p>
              </div>
            )}
            <div className="space-y-1">
              <p className="text-slate-500 uppercase tracking-wider text-[10px]">Total Tool Calls</p>
              <p className="font-mono text-slate-300">{totalToolCalls.toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-slate-500 uppercase tracking-wider text-[10px]">Created</p>
              <p className="font-mono text-slate-300">{new Date(server.created_at).toLocaleDateString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-slate-500 uppercase tracking-wider text-[10px]">Server ID</p>
              <p className="font-mono text-slate-400 text-[10px] truncate">{serverId}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Scans */}
      <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
            <ScanSearch className="size-4 text-blue-400" />
            Recent Scans
          </CardTitle>
          {recentScans.length > 0 && (
            <Link href={`/servers/${serverId}/scans`}>
              <Button size="sm" variant="link" className="text-xs text-blue-400">View all</Button>
            </Link>
          )}
        </CardHeader>
        <CardContent>
          {recentScans.length > 0 ? (
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
                        {scan.risk_score ?? "—"}
                      </span>
                      <span className="text-xs text-slate-400 capitalize">{scan.overall_result ?? scan.status}</span>
                    </div>
                    <span className="text-xs text-slate-500">{timeAgo(scan.created_at)}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">No scans yet — use the Rescan button to trigger one.</p>
          )}
        </CardContent>
      </Card>

      {/* Recent Sessions */}
      <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
            <Radar className="size-4 text-blue-400" />
            Recent Sessions
          </CardTitle>
          {recentSessions.length > 0 && (
            <Link href="/sessions">
              <Button size="sm" variant="link" className="text-xs text-blue-400">View all</Button>
            </Link>
          )}
        </CardHeader>
        <CardContent>
          {recentSessions.length > 0 ? (
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
                        )}
                      >
                        {session.status}
                      </Badge>
                      <span className="text-xs text-slate-400">{session.tool_call_count ?? 0} calls</span>
                      {(session.threat_count ?? 0) > 0 && (
                        <span className="text-xs text-threat">{session.threat_count} threats</span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500">
                      {timeAgo(session.ended_at ?? session.created_at)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">No proxy sessions recorded for this server.</p>
          )}
        </CardContent>
      </Card>

      {/* Health History */}
      {recentHealth.length > 0 && (
        <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
              <Activity className="size-4 text-blue-400" />
              Health History
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {recentHealth.slice(0, 12).map((h, i) => (
              <div key={i} className="flex items-center gap-3 text-xs">
                <div className={cn("size-2 rounded-full shrink-0", h.is_reachable ? "bg-emerald-500" : "bg-red-500")} />
                <span className="font-mono text-slate-400 w-16">{h.latency_ms != null ? `${h.latency_ms}ms` : "—"}</span>
                <span className="text-slate-500">{h.error_rate_pct != null ? `${h.error_rate_pct}% err` : "0% err"}</span>
                <span className="text-slate-500 ml-auto">{timeAgo(h.recorded_at)}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </main>
  );
};

export default ServerDetailPage;
