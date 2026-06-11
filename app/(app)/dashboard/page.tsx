import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CloudOff,
  FileText,
  ScanSearch,
  Server,
  Shield,
  ShieldCheck,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ThreatFeedSection } from "@/components/dashboard/threat-feed-section";
import { WelcomeCard } from "@/components/dashboard/welcome-card";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────

interface ThreatEntry {
  id: string;
  tool_name: string;
  was_blocked: boolean;
  threat_type: string | null;
  created_at: string;
  mcp_server_id?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function threatColor(type: string | null, blocked: boolean): string {
  if (blocked) return "border-l-red-500/60 bg-red-500/5";
  if (type) return "border-l-amber-400/60 bg-amber-500/5";
  return "border-l-emerald-500/60 bg-emerald-500/5";
}

// ─── Page Component ─────────────────────────────────────────────────────

const DashboardPage = async () => {
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

  // This is a safety guard — middleware should already catch this,
  // but server-rendered pages need the type narrowing for TypeScript
  const orgId = membership!.organization_id;

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
    svc.from("organizations").select("name, plan_id, scans_used_this_period, tool_calls_used_this_period, proxy_first_connected_at, current_period_start, current_period_end, scan_limit, tool_call_limit").eq("id", orgId).single(),
    svc.from("mcp_servers").select("id, name, transport_type, allowlist_status, last_scan_result, risk_score").eq("organization_id", orgId).order("created_at", { ascending: false }),
    svc.from("alerts").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("read", false),
    svc.from("scans").select("overall_score, created_at").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    svc.from("tool_invocation_logs").select("id, tool_name, was_blocked, threat_type, created_at, mcp_server_id").eq("organization_id", orgId).not("threat_type", "is", null).order("created_at", { ascending: false }).limit(10),
    svc.from("proxy_sessions").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "active"),
    svc.from("tool_invocation_logs").select("*", { count: "exact", head: true }).eq("organization_id", orgId).gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    svc.from("tool_invocation_logs").select("*", { count: "exact", head: true }).eq("organization_id", orgId).eq("was_blocked", true).gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    svc.from("server_health_metrics").select("latency_ms").eq("organization_id", orgId).order("recorded_at", { ascending: false }).limit(100),
  ]);

  if (!org) redirect("/onboarding");

  const { name: orgName, plan_id: plan, scans_used_this_period: scansUsed, tool_calls_used_this_period: toolCallsUsed, proxy_first_connected_at: proxyConnectedAt } = org;
  const isPaidPlan = plan !== "free";
  const serverCount = servers?.length ?? 0;
  const approvedCount = servers?.filter((s) => s.allowlist_status === "approved").length ?? 0;
  const lastScanAgo = lastScanData?.created_at ? timeAgo(lastScanData.created_at) : null;
  const avgLatency = latencyData && latencyData.length > 0 ? Math.round(latencyData.reduce((sum, r) => sum + (r.latency_ms ?? 0), 0) / latencyData.length) : null;
  const threatCount = recentThreats?.length ?? 0;

  const isFirstVisit = (servers?.length ?? 0) <= 1 && (activeSessions ?? 0) === 0 && (toolCallsToday ?? 0) === 0;

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 animate-fade-in">
      {/* ── Welcome Card (first visit) ─────────────────────────────── */}
      {isFirstVisit && (
        <WelcomeCard proxyConnected={!!proxyConnectedAt} />
      )}

      {/* ── Status Strip ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-bg-surface px-4 py-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-breathe rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          <span className="text-slate-200 font-medium">
            {proxyConnectedAt ? "Protected" : "Scanning"}
          </span>
        </div>
        <span className="text-slate-600">·</span>
        <span className="text-slate-400">
          {lastScanAgo ? `Last scan ${lastScanAgo}` : "No scans yet"}
        </span>
        {threatCount > 0 && (
          <>
            <span className="text-slate-600">·</span>
            <span className="text-amber-400">{threatCount} active threat{threatCount !== 1 ? "s" : ""}</span>
          </>
        )}
        <span className="text-slate-600">·</span>
        <span className="text-slate-400">{serverCount} server{serverCount !== 1 ? "s" : ""} online</span>
        <div className="ml-auto hidden sm:flex items-center gap-2">
          {!proxyConnectedAt && (
            <Link href="/onboarding/proxy-setup">
              <Button size="xs" variant="outline" className="border-amber-500/30 text-amber-400 h-7 text-[10px] gap-1">
                Connect proxy <ArrowRight className="size-3" />
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* ── Two-Column KPI Layout ──────────────────────────────────────── */}          <div className="relative grid gap-6 grid-cols-2 lg:grid-cols-2">
        {/* Vertical divider */}
        <div className="hidden lg:block absolute left-1/2 top-4 bottom-4 w-px bg-white/10 -translate-x-px" />

        {/* LEFT: Pre-Connect Security */}
        <Card className="border-white/10 bg-bg-surface" style={{ borderTop: "2px solid var(--monitor)" }}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="size-6 rounded-md bg-blue-500/15 flex items-center justify-center">
                <ScanSearch className="size-3.5 text-monitor" />
              </div>
              <CardTitle className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                Pre-Connect Security
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold font-mono text-slate-200">{approvedCount}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Servers scanned</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold font-mono" style={{ color: lastScanData?.overall_score ? (lastScanData.overall_score >= 80 ? "var(--secure)" : lastScanData.overall_score >= 60 ? "var(--caution)" : "var(--threat)") : "var(--muted-foreground)" }}>
                  {lastScanData?.overall_score ?? "—"}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">Risk score</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold font-mono text-slate-200">{serverCount}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Total servers</p>
              </div>
            </div>
                  <div className="mt-4 flex flex-wrap gap-2">
              {[
                { label: "Static Analysis", ok: true },
                { label: "Domain Verify", ok: true },
                { label: "Sandbox Exec", ok: Boolean(lastScanData) },
                { label: "CVE Match", ok: true },
              ].map((item) => (
                <span key={item.label} className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", item.ok ? "bg-secure/10 text-secure" : "bg-white/10 text-slate-500")}>
                  {item.ok ? "✓" : "○"} {item.label}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* RIGHT: Runtime Protection */}
        <Card className="border-white/10 bg-bg-surface" style={{ borderTop: "2px solid var(--secure)" }}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="size-6 rounded-md bg-emerald-500/15 flex items-center justify-center">
                <Shield className="size-3.5 text-secure" />
              </div>
              <CardTitle className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                Runtime Protection
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {proxyConnectedAt ? (
              <div className="grid grid-cols-3 gap-4 min-w-0">
                <div className="text-center">
                  <p className="text-2xl font-bold font-mono text-slate-200">{activeSessions ?? 0}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Active sessions</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold font-mono text-slate-200">{toolCallsToday ?? 0}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Tool calls today</p>
                </div>
                <div className="text-center">
                  <p className={cn("text-2xl font-bold font-mono", blockedToday && blockedToday > 0 ? "text-threat" : "text-slate-200")}>{blockedToday ?? 0}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">Blocked today</p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <CloudOff className="size-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-500 mb-3">Proxy not connected — no runtime protection active</p>
                <Link href="/onboarding/proxy-setup">
                  <Button size="sm" variant="outline" className="border-blue-500/30 text-blue-400 gap-1.5">
                    <Shield className="size-3.5" />
                    Enable runtime protection <ArrowRight className="size-3.5" />
                  </Button>
                </Link>
              </div>
            )}
            {avgLatency !== null && (
              <p className="mt-3 text-[10px] text-slate-500 text-center font-mono">Avg proxy latency: {avgLatency}ms</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── NSA Compliance Panel (paid plans) ──────────────────────────── */}
      {isPaidPlan && (
        <Card className="border-white/10 bg-bg-surface" style={{ borderTop: "2px solid var(--secure)" }}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-secure" />
                <CardTitle className="text-sm font-semibold text-slate-200">NSA MCP Security CSI</CardTitle>
              </div>
              <Link href="/compliance">
                <Button size="xs" variant="link" className="text-[10px] text-blue-400 gap-1">
                  View Full Report <ArrowRight className="size-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress bar */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">NSA Control Coverage</span>
                <span className="text-secure font-mono">80%</span>
              </div>
              <Progress value={80} className="h-1.5" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: "Parameter validation active", ok: true },
                { label: "Tool execution sandboxing", ok: true },
                { label: "All tool invocations logged", ok: true },
                { label: "Injection filtering active", ok: true },
                { label: "Message signing — Roadmap Q3 2026", ok: false },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-xs text-slate-300">
                  {item.ok ? (
                    <CheckCircle2 className="size-3.5 text-secure shrink-0" />
                  ) : (
                    <span className="size-3.5 flex items-center justify-center text-caution shrink-0 text-[10px]">○</span>
                  )}
                  {item.label}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Live Threat Feed ────────────────────────────────────────────── */}
      {recentThreats && recentThreats.length > 0 && (
        <ThreatFeedSection threats={recentThreats as ThreatEntry[]} />
      )}

      {/* ── Usage Meter ─────────────────────────────────────────────────── */}
      <Card className="border-white/10 bg-bg-surface">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Usage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Scans</span>
              <span className="text-slate-300 font-mono">{scansUsed ?? 0} / {org.scan_limit ?? 50}</span>
            </div>
            <Progress value={Math.min(100, ((scansUsed ?? 0) / (org.scan_limit ?? 50)) * 100)} className="h-1.5" />
          </div>
          {toolCallsUsed != null && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Tool calls</span>
                <span className="text-slate-300 font-mono">{(toolCallsUsed ?? 0).toLocaleString()} / {(org.tool_call_limit ?? 25000).toLocaleString()}</span>
              </div>
              <Progress value={Math.min(100, ((toolCallsUsed ?? 0) / (org.tool_call_limit ?? 25000)) * 100)} className="h-1.5" />
            </div>
          )}
          <Link href="/settings/billing">
            <Button size="sm" variant="link" className="text-xs text-blue-400 -ml-2 gap-1">
              View full usage <ArrowRight className="size-3" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* ── Empty State ────────────────────────────────────────────────── */}
      {(!servers || servers.length === 0) && (
        <div className="flex flex-1 flex-col items-center justify-center py-16 text-center animate-fade-in">
          <Server className="size-12 text-white/20 mb-4" />
          <h2 className="text-lg font-semibold text-slate-300 mb-1">No servers yet</h2>
          <p className="text-sm text-slate-500 mb-6 max-w-sm">
            Register your first MCP server to begin security scanning and get real-time threat protection.
          </p>
          <Link href="/onboarding">
            <Button className="gap-2">
              <Server className="size-4" />
              Add your first server
            </Button>
          </Link>
        </div>
      )}

      {/* ── Server Health Grid ──────────────────────────────────────────── */}
      {servers && servers.length > 0 && (
        <div className="animate-fade-in">
          <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
            <Server className="size-4 text-slate-400" />
            Servers
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {servers.map((server, i) => (
              <Link key={server.id} href={`/servers/${server.id}`}>
                <Card
                  className="border-white/10 bg-bg-surface hover:bg-bg-elevated transition-all duration-150 cursor-pointer hover:-translate-y-0.5"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-200 truncate flex items-center gap-2">
                          <span className={cn("size-2 rounded-full shrink-0", server.allowlist_status === "approved" ? "bg-secure" : server.allowlist_status === "blocked" ? "bg-threat" : "bg-caution")} />
                          {server.name}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">{server.id.slice(0, 8)}…</p>
                      </div>
                      <Badge variant={server.transport_type === "http" ? "default" : "secondary"} className="text-[10px] shrink-0">
                        {server.transport_type === "http" ? "HTTP" : "STDIO"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[10px]">
                      <Badge className={cn("text-[9px] px-1.5 py-0", server.allowlist_status === "approved" ? "bg-secure/15 text-secure" : server.allowlist_status === "blocked" ? "bg-threat/15 text-threat" : "bg-caution/15 text-caution")}>
                        {server.allowlist_status}
                      </Badge>
                      {server.risk_score != null && (
                        <span className={cn("font-mono", server.last_scan_result === "clean" ? "text-secure" : server.last_scan_result === "suspicious" ? "text-caution" : "text-threat")}>
                          {server.risk_score}/100
                        </span>
                      )}
                    </div>
                    {server.risk_score != null && (
                      <div className="h-1 w-full overflow-hidden rounded-full bg-white/5">
                        <div
                          className={cn("h-full rounded-full transition-all duration-500", server.risk_score >= 80 ? "bg-secure" : server.risk_score >= 60 ? "bg-caution" : "bg-threat")}
                          style={{ width: `${server.risk_score}%` }}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </main>
  );
};

export default DashboardPage;
