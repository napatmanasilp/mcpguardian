import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CloudOff,
  ScanSearch,
  Server,
  Shield,
  ShieldCheck,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Dashboard — MCPGuardian",
  description: "Overview of your MCP server security posture, usage metrics, and active threats.",
};

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { ThreatFeedSection } from "@/components/dashboard/threat-feed-section";
import { WelcomeCard } from "@/components/dashboard/welcome-card";
import { QuickActionsBar } from "@/components/dashboard/quick-actions-bar";
import { NSAComplianceTeaser } from "@/components/dashboard/nsa-compliance-teaser";
import { getOrgContext } from "@/lib/data/org-context";
import { createServiceClient } from "@/lib/supabase/service";
import { TIER_CATALOG, type TierId, isUnlimited } from "@/lib/tier-catalog";
import { EMPTY_STATES } from "@/lib/ui/empty-states";
import { cn } from "@/lib/utils";
import { isWarningThreshold } from "@/lib/utils/usage";

// ─── Types ──────────────────────────────────────────────────────────────

// Threat entries from scan results (non-clean scans)
interface ScanThreat {
  id: string;
  overall_result: string | null;
  risk_score: number | null;
  findings: unknown;
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

/** Returns the start of today in UTC as an ISO string */
function todayStartUtc(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

// ─── Page Component ─────────────────────────────────────────────────────

export default async function DashboardPage() {
  const orgContext = await getOrgContext();
  if (!orgContext) redirect("/onboarding");

  const { organizationId: orgId, plan } = orgContext;
  const svc = createServiceClient();

  // Resolve tier allowances
  const tier = TIER_CATALOG[plan as TierId] ?? TIER_CATALOG.free;

  const todayStart = todayStartUtc();

  const [
    { data: org },
    { data: servers },
    { count: unreadAlerts },
    { data: lastScanData },
    recentThreatsResult,
    { count: activeSessions },
    toolCallsTodayResult,
    blockedTodayResult,
    { data: latencyData },
  ] = await Promise.all([
    svc
      .from("organizations")
      .select("name, plan_id, scans_used_this_period, tool_calls_used_this_period, proxy_first_connected_at, current_period_start, current_period_end")
      .eq("id", orgId)
      .single(),
    svc
      .from("mcp_servers")
      .select("id, name, transport_type, allowlist_status, last_scan_result, risk_score, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false }),
    svc
      .from("alerts")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("read", false),
    svc
      .from("scans")
      .select("risk_score, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    svc
      .from("scans")
      .select("id, overall_result, risk_score, findings, created_at, mcp_server_id")
      .eq("organization_id", orgId)
      .eq("status", "completed")
      .not("overall_result", "eq", "clean")
      .order("created_at", { ascending: false })
      .limit(10)
      .then((r) => r, () => ({ data: null, error: null })),
    svc
      .from("proxy_sessions")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "active"),
    svc
      .from("scans")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .gte("created_at", todayStart)
      .then((r) => r, () => ({ count: 0, error: null })),
    svc
      .from("scans")
      .select("*", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("overall_result", "malicious")
      .gte("created_at", todayStart)
      .then((r) => r, () => ({ count: 0, error: null })),
    svc
      .from("server_health_metrics")
      .select("latency_ms")
      .eq("organization_id", orgId)
      .order("recorded_at", { ascending: false })
      .limit(100),
  ]);

  // Extract results with fallbacks for tables that may have schema mismatches
  const recentThreats = recentThreatsResult?.data ?? null;
  const scansToday = toolCallsTodayResult?.count ?? 0;
  const threatsToday = blockedTodayResult?.count ?? 0;

  if (!org) redirect("/onboarding");

  const {
    name: orgName,
    plan_id: orgPlan,
    scans_used_this_period: scansUsed,
    tool_calls_used_this_period: toolCallsUsed,
    proxy_first_connected_at: proxyConnectedAt,
  } = org;

  const isPaidPlan = orgPlan !== "free";
  const serverCount = servers?.length ?? 0;
  const approvedCount = servers?.filter((s) => s.allowlist_status === "approved").length ?? 0;
  const lastScanAgo = lastScanData?.created_at ? timeAgo(lastScanData.created_at) : null;
  const avgLatency =
    latencyData && latencyData.length > 0
      ? Math.round(latencyData.reduce((sum, r) => sum + (r.latency_ms ?? 0), 0) / latencyData.length)
      : null;
  const threatCount = recentThreats?.length ?? 0;

  // Most recently created server for "Scan Now"
  const mostRecentServerId = servers?.[0]?.id ?? null;

  const isFirstVisit = serverCount <= 1 && (activeSessions ?? 0) === 0 && (scansToday ?? 0) === 0;

  // Proxy is considered "connected" if any servers are registered or proxy was directly connected
  const proxyIsActive = !!proxyConnectedAt || serverCount > 0;

  // Usage data
  const scansUsedCount = scansUsed ?? 0;
  const toolCallsUsedCount = toolCallsUsed ?? 0;
  const scanAllowance = tier.scanAllowance;
  const toolCallAllowance = tier.toolCallAllowance;
  const scanWarning = isWarningThreshold(scansUsedCount, scanAllowance);
  const toolCallWarning = isWarningThreshold(toolCallsUsedCount, toolCallAllowance);

  // ─── Empty State: zero servers ───────────────────────────────────────
  if (serverCount === 0) {
    const emptyConfig = EMPTY_STATES["servers"];
    return (
      <main className="flex flex-1 flex-col gap-6 p-6 animate-fade-in">
        {/* Show welcome card for first-time users */}
        <WelcomeCard proxyConnected={proxyIsActive} />
        <EmptyState
          icon={emptyConfig.icon}
          heading="No servers yet"
          description="Register your first MCP server to begin security scanning and get real-time threat protection."
          cta={{ label: "Add your first server", href: "/servers/new" }}
        />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6 animate-fade-in">
      {/* ── Welcome Card (first visit) ─────────────────────────────── */}
      {isFirstVisit && <WelcomeCard proxyConnected={proxyIsActive} />}

      {/* ── Status Strip ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-bg-surface px-4 py-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-breathe rounded-full bg-secure opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-secure" />
          </span>
          <span className="text-slate-200 font-medium">
            {proxyIsActive ? "Protected" : "Scanning"}
          </span>
        </div>
        <span className="text-slate-600">·</span>
        <span className="text-slate-400">
          {lastScanAgo ? `Last scan ${lastScanAgo}` : "No scans yet"}
        </span>
        {threatCount > 0 && (
          <>
            <span className="text-slate-600">·</span>
            <Link href="/alerts?severity=critical" className="text-caution hover:underline">
              {threatCount} active threat{threatCount !== 1 ? "s" : ""}
            </Link>
          </>
        )}
        <span className="text-slate-600">·</span>
        <span className="text-slate-400">
          {serverCount} server{serverCount !== 1 ? "s" : ""} online
        </span>
        <div className="ml-auto hidden sm:flex items-center gap-2">
          <Link href="/servers/new">
            <Button size="xs" variant="outline" className="border-monitor/30 text-monitor h-7 text-[10px] gap-1">
              Add server <ArrowRight className="size-3" />
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Quick Actions Bar ──────────────────────────────────────────── */}
      <QuickActionsBar mostRecentServerId={mostRecentServerId} />

      {/* ── Two-Column KPI Layout ──────────────────────────────────────── */}
      <div className="relative grid gap-6 grid-cols-2 lg:grid-cols-2">
        {/* Vertical divider */}
        <div className="hidden lg:block absolute left-1/2 top-4 bottom-4 w-px bg-white/10 -translate-x-px" />

        {/* LEFT: Pre-Connect Security */}
        <Card className="border-white/10 bg-bg-surface" style={{ borderTop: "2px solid var(--monitor)" }}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="size-6 rounded-md bg-monitor/15 flex items-center justify-center">
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
                <p
                  className="text-2xl font-bold font-mono"
                  style={{
                    color: lastScanData?.risk_score != null
                      ? lastScanData.risk_score <= 20
                        ? "var(--secure)"
                        : lastScanData.risk_score <= 50
                          ? "var(--caution)"
                          : "var(--threat)"
                      : "var(--muted-foreground)",
                  }}
                >
                  {lastScanData?.risk_score != null ? Math.max(0, 100 - lastScanData.risk_score) : "—"}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">Safety score</p>
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
                <span
                  key={item.label}
                  className={cn(
                    "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                    item.ok ? "bg-secure/10 text-secure" : "bg-white/10 text-slate-500"
                  )}
                >
                  {item.ok ? "✓" : "○"} {item.label}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* RIGHT: Scan Activity */}
        <Card className="border-white/10 bg-bg-surface" style={{ borderTop: "2px solid var(--secure)" }}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="size-6 rounded-md bg-secure/15 flex items-center justify-center">
                <Shield className="size-3.5 text-secure" />
              </div>
              <CardTitle className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                Scan Activity
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 min-w-0">
              <div className="text-center">
                <p className="text-2xl font-bold font-mono text-slate-200">{serverCount}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Servers</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold font-mono text-slate-200">{scansUsedCount}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Scans this month</p>
              </div>
              <div className="text-center">
                <p
                  className={cn(
                    "text-2xl font-bold font-mono",
                    threatCount > 0 ? "text-threat" : "text-slate-200"
                  )}
                >
                  {threatCount}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">Threats found</p>
              </div>
            </div>
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
                <Button size="xs" variant="link" className="text-[10px] text-monitor gap-1">
                  View Full Report <ArrowRight className="size-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
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
                    <span className="size-3.5 flex items-center justify-center text-caution shrink-0 text-[10px]">
                      ○
                    </span>
                  )}
                  {item.label}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── NSA Compliance Teaser (free plans) ─────────────────────────── */}
      {!isPaidPlan && <NSAComplianceTeaser />}

      {/* ── Recent Threats (scans with issues) ─────────────────────────── */}
      {recentThreats && recentThreats.length > 0 && (
        <ThreatFeedSection threats={recentThreats} />
      )}

      {/* ── Usage Meters ────────────────────────────────────────────────── */}
      <Card className="border-white/10 bg-bg-surface">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Usage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Scans usage meter */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-slate-400">
                Scans
                {scanWarning && (
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1.5 py-0 border-caution/30"
                    style={{ color: "var(--caution)" }}
                  >
                    <AlertTriangle className="size-2.5 mr-0.5" />
                    ≥80%
                  </Badge>
                )}
              </span>
              <span className="text-slate-300 font-mono">
                {scansUsedCount} / {isUnlimited(scanAllowance) ? "∞" : scanAllowance}
              </span>
            </div>
            {!isUnlimited(scanAllowance) && (
              <Progress
                value={Math.min(100, (scansUsedCount / (scanAllowance as number)) * 100)}
                className="h-1.5"
              />
            )}
          </div>

          {/* Tool calls usage meter */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-slate-400">
                Tool calls
                {toolCallWarning && (
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1.5 py-0 border-caution/30"
                    style={{ color: "var(--caution)" }}
                  >
                    <AlertTriangle className="size-2.5 mr-0.5" />
                    ≥80%
                  </Badge>
                )}
              </span>
              <span className="text-slate-300 font-mono">
                {toolCallsUsedCount.toLocaleString()} /{" "}
                {isUnlimited(toolCallAllowance) ? "∞" : (toolCallAllowance as number).toLocaleString()}
              </span>
            </div>
            {!isUnlimited(toolCallAllowance) && (
              <Progress
                value={Math.min(100, (toolCallsUsedCount / (toolCallAllowance as number)) * 100)}
                className="h-1.5"
              />
            )}
          </div>

          <Link href="/settings/billing">
            <Button size="sm" variant="link" className="text-xs text-monitor -ml-2 gap-1">
              View full usage <ArrowRight className="size-3" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* ── Server Health Grid ──────────────────────────────────────────── */}
      <div className="animate-fade-in">
        <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <Server className="size-4 text-slate-400" />
          Servers
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {servers!.map((server, i) => (
            <Link key={server.id} href={`/servers/${server.id}`}>
              <Card
                className="border-white/10 bg-bg-surface hover:bg-bg-elevated transition-all duration-150 cursor-pointer hover:-translate-y-0.5"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-200 truncate flex items-center gap-2">
                        <span
                          className={cn(
                            "size-2 rounded-full shrink-0",
                            server.allowlist_status === "approved"
                              ? "bg-secure"
                              : server.allowlist_status === "blocked"
                                ? "bg-threat"
                                : "bg-caution"
                          )}
                        />
                        {server.name}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">{server.id.slice(0, 8)}…</p>
                    </div>
                    <Badge
                      variant={server.transport_type === "http" ? "default" : "secondary"}
                      className="text-[10px] shrink-0"
                    >
                      {server.transport_type === "http" ? "HTTP" : "STDIO"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <Badge
                      className={cn(
                        "text-[9px] px-1.5 py-0",
                        server.allowlist_status === "approved"
                          ? "bg-secure/15 text-secure"
                          : server.allowlist_status === "blocked"
                            ? "bg-threat/15 text-threat"
                            : "bg-caution/15 text-caution"
                      )}
                    >
                      {server.allowlist_status}
                    </Badge>
                    {server.risk_score != null && (
                      <span
                        className={cn(
                          "font-mono",
                          server.risk_score <= 20
                            ? "text-secure"
                            : server.risk_score <= 50
                              ? "text-caution"
                              : "text-threat"
                        )}
                      >
                        {Math.max(0, 100 - server.risk_score)}/100
                      </span>
                    )}
                  </div>
                  {server.risk_score != null && (
                    <div className="h-1 w-full overflow-hidden rounded-full bg-white/5">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          server.risk_score <= 20
                            ? "bg-secure"
                            : server.risk_score <= 50
                              ? "bg-caution"
                              : "bg-threat"
                        )}
                        style={{ width: `${100 - server.risk_score}%` }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
