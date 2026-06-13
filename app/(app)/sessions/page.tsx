import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, Radar, Shield, ShieldAlert } from "lucide-react";

export const metadata: Metadata = {
  title: "Sessions — MCPGuardian",
  description: "View and filter proxy sessions routed through MCPGuardian.",
};

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrgContext } from "@/lib/data/org-context";
import { EmptyState } from "@/components/ui/empty-state";
import { EMPTY_STATES } from "@/lib/ui/empty-states";
import { RugPullTooltip } from "@/components/sessions/rug-pull-tooltip";
import { cn } from "@/lib/utils";
import { computeTotalToolCalls } from "@/lib/utils/sessions";

function formatDuration(startedAt: string, endedAt: string | null): string {
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  const diffMs = end - new Date(startedAt).getTime();
  const secs = Math.floor(diffMs / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_FILTERS = ["all", "active", "terminated_clean", "terminated_threat", "terminated_rug_pull"] as const;

const SessionsPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; from?: string; to?: string }>;
}) => {
  const org = await getOrgContext();
  if (!org) redirect("/onboarding");

  const svc = createServiceClient();
  const params = await searchParams;
  const statusFilter = params.status ?? "all";
  const from = params.from ?? "";
  const to = params.to ?? "";

  let query = svc
    .from("proxy_sessions")
    .select("id, status, tool_call_count, threat_count, blocked_count, watchdog_enabled, agent_identifier, started_at, ended_at, termination_reason, mcp_server_id")
    .eq("organization_id", org.organizationId)
    .order("started_at", { ascending: false })
    .limit(100);

  if (statusFilter !== "all") {
    query = query.eq("status", statusFilter);
  }

  if (from) {
    query = query.gte("started_at", `${from}T00:00:00.000Z`);
  }
  if (to) {
    query = query.lte("started_at", `${to}T23:59:59.999Z`);
  }

  const { data: sessions } = await query;

  // Fetch server names for all sessions
  const serverIds = [...new Set((sessions ?? []).map((s) => s.mcp_server_id).filter(Boolean))];
  const { data: serverRows } = serverIds.length > 0
    ? await svc.from("mcp_servers").select("id, name").in("id", serverIds)
    : { data: [] };

  const serverNameById: Record<string, string> = {};
  for (const s of (serverRows ?? [])) {
    serverNameById[s.id] = s.name;
  }

  const activeCount = (sessions ?? []).filter((s) => s.status === "active").length;
  const threatCount = (sessions ?? []).filter((s) => s.status === "terminated_threat" || s.status === "terminated_rug_pull").length;
  const totalToolCalls = computeTotalToolCalls(sessions ?? []);

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-1">Protect</p>
          <h1 className="text-2xl font-bold tracking-tight">Proxy Sessions</h1>
          <p className="text-sm text-slate-500 mt-1 hidden sm:block">
            Every agent connection routed through MCPGuardian
          </p>
          <span className="text-slate-400 text-xs sm:text-sm">{totalToolCalls.toLocaleString()} tool calls total</span>
        </div>
        {/* Summary badges */}
        <div className="hidden md:flex items-center gap-2">
          {activeCount > 0 && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-secure/15 text-secure border border-secure/25">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-secure opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-secure" />
              </span>
              {activeCount} active
            </span>
          )}
          {threatCount > 0 && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-threat/15 text-threat border border-threat/25">
              <ShieldAlert className="size-3" />
              {threatCount} threat{threatCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500 font-mono">Filter:</span>
        {STATUS_FILTERS.map((s) => {
          const isActive = statusFilter === s;
          const label = s === "all" ? "All" : s === "active" ? "Active" : s === "terminated_clean" ? "Clean exit" : s === "terminated_threat" ? "Threat" : "Rug pull";
          const linkParams = new URLSearchParams();
          if (s !== "all") linkParams.set("status", s);
          if (from) linkParams.set("from", from);
          if (to) linkParams.set("to", to);
          const href = linkParams.toString() ? `/sessions?${linkParams.toString()}` : "/sessions";
          const pill = (
            <Link
              key={s}
              href={href}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all border",
                isActive
                  ? "bg-monitor/20 text-monitor border-monitor/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border-transparent",
              )}
            >
              {label}
            </Link>
          );
          if (s === "terminated_rug_pull") {
            return <RugPullTooltip key={s}>{pill}</RugPullTooltip>;
          }
          return pill;
        })}
      </div>

      {/* Date range filter */}
      <form method="GET" action="/sessions" className="flex items-end gap-2 md:gap-3 flex-wrap">
        {statusFilter !== "all" && (
          <input type="hidden" name="status" value={statusFilter} />
        )}
        <div className="flex flex-col gap-1">
          <label htmlFor="from" className="text-xs text-slate-500 font-mono">From</label>
          <input
            type="date"
            id="from"
            name="from"
            defaultValue={from}
            className="rounded-md border border-white/10 bg-white/5 px-2 md:px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50 max-w-[140px]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="to" className="text-xs text-slate-500 font-mono">To</label>
          <input
            type="date"
            id="to"
            name="to"
            defaultValue={to}
            className="rounded-md border border-white/10 bg-white/5 px-2 md:px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50 max-w-[140px]"
          />
        </div>
        <Button type="submit" variant="outline" size="sm" className="border-monitor/30 text-monitor text-xs">
          Apply
        </Button>
      </form>

      {/* Sessions list */}
      {sessions && sessions.length > 0 ? (
        <div className="space-y-2">
          {sessions.map((session) => {
            const isActive = session.status === "active";
            const isThreat = session.status === "terminated_threat" || session.status === "terminated_rug_pull";
            const serverName = serverNameById[session.mcp_server_id] ?? "Unknown server";
            const duration = formatDuration(session.started_at, session.ended_at ?? null);

            return (
              <Link key={session.id} href={`/sessions/${session.id}`}>
                <div className={cn(
                  "flex flex-col md:flex-row md:items-center md:justify-between rounded-lg border px-3 py-3 md:px-4 hover:-translate-y-px transition-all duration-150 cursor-pointer gap-2 md:gap-0",
                  isActive ? "border-secure/20 bg-secure/5 hover:bg-secure/8" :
                  isThreat ? "border-threat/20 bg-threat/5 hover:bg-threat/8" :
                  "border-white/10 bg-white/5 hover:bg-white/10",
                )}>
                  {/* Left: status + server + meta */}
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Status icon */}
                    <div className={cn(
                      "size-8 rounded-full flex items-center justify-center shrink-0",
                      isActive ? "bg-secure/20" : isThreat ? "bg-threat/20" : "bg-slate-500/15",
                    )}>
                      {isActive ? (
                        <Shield className="size-4 text-secure" />
                      ) : isThreat ? (
                        <ShieldAlert className="size-4 text-threat" />
                      ) : (
                        <Activity className="size-4 text-slate-500" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* Server name + agent */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-200 truncate">
                          {serverName}
                        </p>
                        {session.agent_identifier && (
                          <span className="text-[10px] font-mono text-slate-500 truncate max-w-[100px] md:max-w-[120px]">
                            via {session.agent_identifier}
                          </span>
                        )}
                      </div>
                      {/* Meta row */}
                      <div className="flex items-center gap-2 md:gap-3 mt-0.5 flex-wrap">
                        <span className="text-xs text-slate-500 font-mono">
                          {session.id.slice(0, 8)}…
                        </span>
                        <span className="text-xs text-slate-500">
                          {session.tool_call_count ?? 0} calls
                        </span>
                        {(session.threat_count ?? 0) > 0 && (
                          <span className="text-xs text-threat">
                            {session.threat_count} threat{session.threat_count !== 1 ? "s" : ""}
                          </span>
                        )}
                        {(session.blocked_count ?? 0) > 0 && (
                          <span className="text-xs text-threat hidden sm:inline">
                            {session.blocked_count} blocked
                          </span>
                        )}
                        {session.watchdog_enabled && (
                          <span className="text-[10px] text-monitor hidden sm:inline">Watchdog ✓</span>
                        )}
                        {session.termination_reason && (
                          <span className="text-[10px] text-slate-500 italic hidden sm:inline">
                            {session.termination_reason.replace(/_/g, " ")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: status badge + duration + time */}
                  <div className="flex items-center gap-3 shrink-0 pl-11 md:pl-0">
                    <span className="text-xs text-slate-500 font-mono md:hidden">{duration}</span>
                    <span className="text-[10px] text-slate-600 md:hidden">
                      {timeAgo(session.started_at)}
                    </span>
                    <div className="hidden md:flex flex-col items-end gap-0.5">
                      <span className="text-xs text-slate-500 font-mono">{duration}</span>
                      <span className="text-[10px] text-slate-600">
                        {timeAgo(session.started_at)}
                      </span>
                    </div>
                    {session.status === "terminated_rug_pull" ? (
                      <RugPullTooltip>
                        <Badge
                          className={cn(
                            "text-[10px] shrink-0",
                            "bg-threat/20 text-threat border-threat/30",
                          )}
                          variant="outline"
                        >
                          rug pull
                        </Badge>
                      </RugPullTooltip>
                    ) : (
                      <Badge
                        className={cn(
                          "text-[10px] shrink-0",
                          isActive && "bg-secure/20 text-secure border-secure/30",
                          session.status === "terminated_clean" && "bg-slate-500/20 text-slate-400 border-slate-500/30",
                          isThreat && "bg-threat/20 text-threat border-threat/30",
                          session.status === "expired" && "bg-slate-500/20 text-slate-400 border-slate-500/30",
                        )}
                        variant="outline"
                      >
                        {isActive ? "active" : isThreat ? "threat" : session.status.replace("terminated_", "")}
                      </Badge>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (from || to || statusFilter !== "all") ? (
        /* Filtered empty state — date range or status filter yielded no results */
        <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
          <Radar className="size-12 text-slate-600 mb-4" />
          <h2 className="text-lg font-semibold text-slate-300 mb-1">
            No sessions found for this date range
          </h2>
          <p className="text-sm text-slate-500 mb-6 max-w-sm">
            Try adjusting the date range or clearing filters to see all sessions.
          </p>
          <Link href="/sessions">
            <Button variant="outline" className="border-monitor/30 text-monitor">
              Clear filters
            </Button>
          </Link>
        </div>
      ) : (
        /* No sessions at all — use registry empty state */
        <EmptyState {...EMPTY_STATES["sessions"]} />
      )}
    </main>
  );
};

export default SessionsPage;
