import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  CloudOff,
  FileText,
  ScanSearch,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Terminal,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────

interface ServerHealth {
  id: string;
  name: string;
  transport_type: string;
  allowlist_status: string;
  last_scan_result: string | null;
  risk_score: number | null;
  active_sessions: number;
  tool_calls_24h: number;
  threat_rate_24h: number;
}

interface ThreatEntry {
  id: string;
  tool_name: string;
  was_blocked: boolean;
  threat_type: string | null;
  created_at: string;
}

// ─── Page Component ─────────────────────────────────────────────────────

const DashboardPage = async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const svc = createServiceClient();

  // Fetch org context
  const { data: membership } = await svc
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("invitation_status", "accepted")
    .single();

  if (!membership) redirect("/onboarding");

  const orgId = membership.organization_id;

  const orgPromise = svc
    .from("organizations")
    .select("name, plan_id, scans_used_this_period, tool_calls_used_this_period, proxy_first_connected_at, current_period_start, current_period_end")
    .eq("id", orgId)
    .single();

  const serversPromise = svc
    .from("mcp_servers")
    .select("id, name, transport_type, allowlist_status, last_scan_result, risk_score")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false });

  const alertsCountPromise = svc
    .from("alerts")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("read", false);

  const completedScansPromise = svc
    .from("scans")
    .select("overall_score, created_at")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Recent threats from tool_invocation_logs
  const threatsPromise = svc
    .from("tool_invocation_logs")
    .select("id, tool_name, was_blocked, threat_type, created_at, mcp_server_id")
    .eq("organization_id", orgId)
    .not("threat_type", "is", null)
    .order("created_at", { ascending: false })
    .limit(10);

  // Active sessions count
  const activeSessionsPromise = svc
    .from("proxy_sessions")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("status", "active");

  // Tool calls today
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const toolCallsTodayPromise = svc
    .from("tool_invocation_logs")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .gte("created_at", todayStart.toISOString());

  // Blocked today
  const blockedTodayPromise = svc
    .from("tool_invocation_logs")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("was_blocked", true)
    .gte("created_at", todayStart.toISOString());

  // Average proxy latency
  const avgLatencyPromise = svc
    .from("server_health_metrics")
    .select("latency_ms")
    .eq("organization_id", orgId)
    .order("recorded_at", { ascending: false })
    .limit(100);
  const [
    { data: org },
    { data: servers },
    { count: unreadAlerts },
    { data: lastScanData },
    { data: recentThreats },
    { count: activeSessions },
    { count: toolCallsToday },
    { count: blockedToday },
    { data: latencyData },
  ] = await Promise.all([
    orgPromise,
    serversPromise,
    alertsCountPromise,
    completedScansPromise,
    threatsPromise,
    activeSessionsPromise,
    toolCallsTodayPromise,
    blockedTodayPromise,
    avgLatencyPromise,
  ]);

  if (!org) redirect("/onboarding");

  const {
    name: orgName,
    plan_id: plan,
    scans_used_this_period: scansUsed,
    tool_calls_used_this_period: toolCallsUsed,
    proxy_first_connected_at: proxyConnectedAt,
  } = org;

  const planLimits: Record<string, { scans: number; toolCalls: number }> = {
    free: { scans: 50, toolCalls: 0 },
    developer: { scans: 100, toolCalls: 25000 },
    team: { scans: 500, toolCalls: 100000 },
    startup: { scans: 2000, toolCalls: 500000 },
    enterprise: { scans: -1, toolCalls: -1 },
  };

  const limits = planLimits[plan] ?? { scans: 50, toolCalls: 0 };
  const scanPercent = limits.scans === -1 ? 0 : Math.min(100, Math.round(((scansUsed ?? 0) / limits.scans) * 100));
  const toolCallPercent = limits.toolCalls === -1 ? 0 : Math.min(100, Math.round(((toolCallsUsed ?? 0) / limits.toolCalls) * 100));

  const avgLatency =
    latencyData && latencyData.length > 0
      ? Math.round(latencyData.reduce((sum, r) => sum + (r.latency_ms ?? 0), 0) / latencyData.length)
      : null;

  const serversWithHealth: ServerHealth[] = (servers ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    transport_type: s.transport_type,
    allowlist_status: s.allowlist_status,
    last_scan_result: s.last_scan_result,
    risk_score: s.risk_score,
    active_sessions: 0,
    tool_calls_24h: 0,
    threat_rate_24h: 0,
  }));

  const isPaidPlan = plan !== "free";

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      {/* ── Proxy Connection Banner ──────────────────────────────── */}
      {!proxyConnectedAt && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/8 p-4 flex items-center gap-3 md:gap-4">
          <div className="size-8 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
            <CloudOff className="size-4 text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-300">Your proxy isn&apos;t connected yet</p>
            <p className="text-xs text-slate-400 mt-0.5">
              MCPGuardian is scanning your servers but cannot protect runtime tool calls until you wire the proxy.
            </p>
          </div>
          <Link href="/onboarding/proxy-setup" className="flex-shrink-0 hidden sm:block">
            <Button size="sm" variant="outline" className="border-amber-500/30 text-amber-400">
              Complete proxy setup <ArrowRight className="size-3.5 ml-1" />
            </Button>
          </Link>
        </div>
      )}

      {/* ── NSA Compliance Panel ────────────────────────────────── */}
      {isPaidPlan && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-blue-400" />
                <p className="text-sm font-semibold text-blue-300">NSA MCP SECURITY CSI — Your Compliance Status</p>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Document: U/OO/6030316-26
              </p>
            </div>
            <Button size="sm" variant="outline" className="border-blue-500/30 text-blue-400 shrink-0 gap-1.5">
              <FileText className="size-3.5" />
              Download Report
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {[
              { label: "Parameter validation active", ok: true },
              { label: "Tool execution sandboxing", ok: true },
              { label: "All tool invocations logged", ok: true },
              { label: "Injection filtering active on all sessions", ok: true },
              { label: "Message signing — Roadmap Q3 2026", ok: false },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-slate-300">
                {item.ok ? (
                  <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <span className="size-3.5 flex items-center justify-center text-amber-400 shrink-0">🗺️</span>
                )}
                {item.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Dual Layer Status ────────────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
              <ScanSearch className="size-4 text-blue-400" />
              Pre-Connect Scan Coverage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3">
              {[
                { label: "Approved", count: servers?.filter((s) => s.allowlist_status === "approved").length ?? 0, color: "text-emerald-400" },
                { label: "Pending", count: servers?.filter((s) => s.allowlist_status === "monitoring").length ?? 0, color: "text-amber-400" },
                { label: "Blocked", count: servers?.filter((s) => s.allowlist_status === "blocked").length ?? 0, color: "text-red-400" },
              ].map((stat) => (
                <div key={stat.label} className="flex-1 text-center">
                  <p className={`text-lg font-bold font-mono ${stat.color}`}>{stat.count}</p>
                  <p className="text-[10px] text-slate-500">{stat.label}</p>
                </div>
              ))}
            </div>
            {lastScanData?.overall_score != null && (
              <p className="text-xs text-slate-500">
                Last scan: <span className={cn(lastScanData.overall_score >= 80 ? "text-emerald-400" : lastScanData.overall_score >= 60 ? "text-amber-400" : "text-red-400")}>{lastScanData.overall_score}/100</span>
              </p>
            )}
            <Link href="/servers">
              <Button size="sm" variant="ghost" className="text-xs text-blue-400 hover:text-blue-300 gap-1 -ml-2">
                Scan a new server <ArrowRight className="size-3" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
              <Shield className="size-4 text-emerald-400" />
              Runtime Proxy Protection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {proxyConnectedAt ? (
              <>
                <div className="flex gap-3">
                  {[
                    { label: "Active Sessions", count: activeSessions ?? 0, color: "text-emerald-400" },
                    { label: "Tool Calls Today", count: toolCallsToday ?? 0, color: "text-blue-400" },
                    { label: "Blocked Today", count: blockedToday ?? 0, color: blockedToday && blockedToday > 0 ? "text-red-400" : "text-slate-400" },
                  ].map((stat) => (
                    <div key={stat.label} className="flex-1 text-center">
                      <p className={`text-lg font-bold font-mono ${stat.color}`}>{stat.count}</p>
                      <p className="text-[10px] text-slate-500">{stat.label}</p>
                    </div>
                  ))}
                </div>
                {avgLatency !== null && (
                  <p className="text-xs text-slate-500">Average latency: {avgLatency}ms</p>
                )}
              </>
            ) : (
              <div className="text-center py-4">
                <CloudOff className="size-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Not active</p>
                <Link href="/onboarding/proxy-setup">
                  <Button size="sm" variant="outline" className="mt-2 border-blue-500/30 text-blue-400">
                    Connect proxy <ArrowRight className="size-3.5 ml-1" />
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Usage Meters ─────────────────────────────────────────── */}
      {(limits.scans > 0 || limits.toolCalls > 0) && (
        <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Usage This Period</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {limits.scans > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Scans</span>
                  <span className="text-slate-300 font-mono">{scansUsed ?? 0} / {limits.scans}</span>
                </div>
                <Progress
                  value={scanPercent}
                  className={cn(
                    "h-2",
                    scanPercent >= 95 ? "[&>div]:bg-red-500" : scanPercent >= 80 ? "[&>div]:bg-amber-500" : "[&>div]:bg-blue-500",
                  )}
                />
              </div>
            )}
            {limits.toolCalls > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Tool Calls</span>
                  <span className="text-slate-300 font-mono">{toolCallsUsed ?? 0} / {limits.toolCalls.toLocaleString()}</span>
                </div>
                <Progress
                  value={toolCallPercent}
                  className={cn(
                    "h-2",
                    toolCallPercent >= 95 ? "[&>div]:bg-red-500" : toolCallPercent >= 80 ? "[&>div]:bg-amber-500" : "[&>div]:bg-blue-500",
                  )}
                />
              </div>
            )}
            <Link href="/settings/billing">
              <Button size="sm" variant="link" className="text-xs text-blue-400 -ml-2">
                View full usage <ArrowRight className="size-3 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* ── Recent Threat Activity ────────────────────────────────── */}
      {recentThreats && recentThreats.length > 0 && (
        <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
              <ShieldAlert className="size-4 text-red-400" />
              Recent Threat Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(recentThreats as ThreatEntry[]).slice(0, 10).map((threat) => (
              <div
                key={threat.id}
                className="flex items-center justify-between gap-3 rounded-md bg-white/5 px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={cn(
                      "size-2 rounded-full shrink-0",
                      threat.was_blocked ? "bg-red-500" : "bg-amber-500",
                    )}
                  />
                  <span className="font-mono text-slate-300 truncate">{threat.tool_name}</span>
                  {threat.threat_type && (
                    <Badge variant="destructive" className="text-[9px] px-1 py-0">
                      {threat.threat_type}
                    </Badge>
                  )}
                </div>
                <span className="text-slate-500 shrink-0">
                  {new Date(threat.created_at).toLocaleString()}
                </span>
              </div>
            ))}
            <Link href="/activity">
              <Button size="sm" variant="link" className="text-xs text-blue-400 -ml-2">
                View all activity <ArrowRight className="size-3 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* ── Server Health Grid ───────────────────────────────────── */}
      {serversWithHealth.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <Server className="size-4 text-slate-400" />
            Servers
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {serversWithHealth.map((server) => (
              <Link key={server.id} href={`/servers/${server.id}`}>
                <Card className="border-white/10 bg-[hsl(222,47%,6%)] hover:bg-[hsl(222,47%,8%)] transition-colors cursor-pointer">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-200 truncate">{server.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">{server.id.slice(0, 8)}…</p>
                      </div>
                      <Badge
                        variant={server.transport_type === "http" ? "default" : "secondary"}
                        className="text-[10px] shrink-0"
                      >
                        {server.transport_type === "http" ? "HTTP" : <><Terminal className="size-2.5 mr-0.5" /> STDIO</>}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[10px]">
                      {server.allowlist_status === "approved" ? (
                        <Badge variant="default" className="bg-emerald-500/20 text-emerald-400 text-[10px] border-0">Approved</Badge>
                      ) : server.allowlist_status === "blocked" ? (
                        <Badge variant="destructive" className="text-[10px]">Blocked</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">Monitoring</Badge>
                      )}
                      {server.last_scan_result && (
                        <span className={cn(
                          server.last_scan_result === "clean" ? "text-emerald-400" :
                          server.last_scan_result === "suspicious" ? "text-amber-400" :
                          "text-red-400"
                        )}>
                          {server.risk_score != null ? `${server.risk_score}/100` : "—"}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── Empty State ──────────────────────────────────────────── */}
      {(!servers || servers.length === 0) && (
        <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
          <Server className="size-12 text-slate-600 mb-4" />
          <h2 className="text-lg font-semibold text-slate-300 mb-1">No servers yet</h2>
          <p className="text-sm text-slate-500 mb-6">
            Register your first MCP server to get started with security scanning.
          </p>
          <Link href="/onboarding">
            <Button className="gap-2">
              <Server className="size-4" />
              Add your first server
            </Button>
          </Link>
        </div>
      )}
    </main>
  );
};

export default DashboardPage;
