import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, LayoutGrid, List, Plus, Search } from "lucide-react";

export const metadata: Metadata = {
  title: "Servers — MCPGuardian",
  description: "Manage your registered MCP servers, view risk scores, and trigger rescans.",
};

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { RescanButtonWithRefresh } from "@/components/servers/rescan-button-with-refresh";
import { getOrgContext } from "@/lib/data/org-context";
import { createServiceClient } from "@/lib/supabase/service";
import { EMPTY_STATES } from "@/lib/ui/empty-states";
import { cn } from "@/lib/utils";

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

const ServersPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; view?: string }>;
}) => {
  const org = await getOrgContext();
  if (!org) redirect("/onboarding");

  const svc = createServiceClient();

  const params = await searchParams;
  const query = params.q?.toLowerCase() ?? "";
  const currentView = params.view ?? "list";

  let queryBuilder = svc
    .from("mcp_servers")
    .select("id, name, transport_type, endpoint_url, allowlist_status, last_scan_result, last_scan_at, risk_score, created_at")
    .eq("organization_id", org.organizationId)
    .order("created_at", { ascending: false });

  if (query) {
    queryBuilder = queryBuilder.ilike("name", `%${query}%`);
  }

  const { data: servers, error: queryError } = await queryBuilder;

  if (queryError) {
    throw new Error("Failed to load server data. Please try again.");
  }

  // Fetch latest latency + active session count per server in parallel
  const serverIds = servers?.map((s) => s.id) ?? [];
  const [latencyRows, sessionRows] = await Promise.all([
    serverIds.length > 0
      ? svc
          .from("server_health_metrics")
          .select("mcp_server_id, latency_ms")
          .in("mcp_server_id", serverIds)
          .order("recorded_at", { ascending: false })
          .limit(serverIds.length * 5)
      : Promise.resolve({ data: [] }),
    serverIds.length > 0
      ? svc
          .from("proxy_sessions")
          .select("mcp_server_id")
          .in("mcp_server_id", serverIds)
          .eq("status", "active")
      : Promise.resolve({ data: [] }),
  ]);

  // Build lookup maps
  const latencyByServer: Record<string, number | null> = {};
  for (const row of (latencyRows.data ?? [])) {
    if (!(row.mcp_server_id in latencyByServer)) {
      latencyByServer[row.mcp_server_id] = row.latency_ms ?? null;
    }
  }
  const sessionCountByServer: Record<string, number> = {};
  for (const row of (sessionRows.data ?? [])) {
    sessionCountByServer[row.mcp_server_id] = (sessionCountByServer[row.mcp_server_id] ?? 0) + 1;
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6 overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-1">Servers</p>
          <h1 className="text-2xl font-bold tracking-tight">MCP Servers</h1>
        </div>
        <Link href="/servers/new">
          <Button className="gap-2 shrink-0">
            <Plus className="size-4" />
            <span className="hidden sm:inline">Add Server</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </Link>
      </div>

      {/* Search + View Toggle */}
      <div className="flex items-center gap-3">
        <form className="relative flex-1 min-w-0 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
          <Input
            name="q"
            placeholder="Search servers..."
            defaultValue={query}
            className="pl-9 border-white/10 bg-white/5 w-full"
          />
        </form>
        {/* Grid/List toggle — hidden on mobile */}
        <div className="hidden sm:flex items-center gap-1 border border-white/10 rounded-lg p-1">
          <Link
            href="?view=list"
            className={cn("p-1.5 rounded transition-colors", currentView === "list" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60")}
          >
            <List className="size-4" />
          </Link>
          <Link
            href="?view=grid"
            className={cn("p-1.5 rounded transition-colors", currentView === "grid" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60")}
          >
            <LayoutGrid className="size-4" />
          </Link>
        </div>
      </div>

      {/* Server List/Grid */}
      {servers && servers.length > 0 ? (
        currentView === "list" ? (
          /* ── List View ── */
          <div className="flex flex-col gap-2">
            {servers.map((server) => {
              const statusColor =
                server.allowlist_status === "approved"
                  ? "bg-secure/20 text-secure border-secure/30"
                  : server.allowlist_status === "blocked"
                    ? "bg-threat/20 text-threat border-threat/30"
                    : "bg-caution/20 text-caution border-caution/30";

              return (
                <Link key={server.id} href={`/servers/${server.id}`}>
                  <Card className="border-white/10 bg-bg-surface hover:bg-bg-elevated transition-all duration-150 hover:-translate-y-px hover:border-white/20 cursor-pointer">
                    <CardContent className="p-3 md:p-4">
                      {/* Desktop: single row layout */}
                      <div className="hidden md:flex items-center gap-3">
                        {/* Status dot */}
                        <span className={cn("size-2 rounded-full shrink-0", server.allowlist_status === "approved" ? "bg-secure" : server.allowlist_status === "blocked" ? "bg-threat" : "bg-caution")} />
                        {/* Name + badges */}
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-200 truncate">{server.name}</p>
                          <Badge variant={server.transport_type === "http" ? "default" : "secondary"} className="text-[10px] shrink-0">
                            {server.transport_type === "http" ? "HTTP" : "STDIO"}
                          </Badge>
                          <Badge variant="outline" className={cn("text-[10px] shrink-0", statusColor)}>
                            {server.allowlist_status}
                          </Badge>
                        </div>
                        {/* 4 inline stats */}
                        <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
                          <span>Risk: {server.risk_score ?? "—"}/100</span>
                          <span>Latency: {latencyByServer[server.id] != null ? `${latencyByServer[server.id]}ms` : "—"}</span>
                          <span>Sessions: {sessionCountByServer[server.id] ?? 0}</span>
                          <span>Scan: {timeAgo(server.last_scan_at ?? null)}</span>
                        </div>
                        <RescanButtonWithRefresh serverId={server.id} />
                        <ArrowRight className="size-3.5 text-slate-500 shrink-0" />
                      </div>

                      {/* Mobile: stacked card layout */}
                      <div className="md:hidden space-y-2">
                        {/* Row 1: dot + name + badges */}
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={cn("size-2 rounded-full shrink-0", server.allowlist_status === "approved" ? "bg-secure" : server.allowlist_status === "blocked" ? "bg-threat" : "bg-caution")} />
                          <p className="text-sm font-semibold text-slate-200 truncate flex-1">{server.name}</p>
                          <Badge variant={server.transport_type === "http" ? "default" : "secondary"} className="text-[10px] shrink-0">
                            {server.transport_type === "http" ? "HTTP" : "STDIO"}
                          </Badge>
                        </div>
                        {/* Row 2: stats grid */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] font-mono text-slate-400 pl-4">
                          <span>Risk: {server.risk_score ?? "—"}/100</span>
                          <span>Scan: {timeAgo(server.last_scan_at ?? null)}</span>
                          <span>Latency: {latencyByServer[server.id] != null ? `${latencyByServer[server.id]}ms` : "—"}</span>
                          <span>Sessions: {sessionCountByServer[server.id] ?? 0}</span>
                        </div>
                        {/* Row 3: status badge + rescan */}
                        <div className="flex items-center justify-between pl-4">
                          <Badge variant="outline" className={cn("text-[10px]", statusColor)}>
                            {server.allowlist_status}
                          </Badge>
                          <RescanButtonWithRefresh serverId={server.id} />
                        </div>
                      </div>

                      {/* Risk bar (both mobile and desktop) */}
                      {server.risk_score != null && (
                        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/5">
                          <div
                            className={cn("h-full rounded-full transition-all duration-500", server.risk_score >= 80 ? "bg-secure" : server.risk_score >= 60 ? "bg-caution" : "bg-threat")}
                            style={{ width: `${server.risk_score}%` }}
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          /* ── Grid View ── */
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {servers.map((server) => {
              const statusColor =
                server.allowlist_status === "approved"
                  ? "bg-secure/20 text-secure border-secure/30"
                  : server.allowlist_status === "blocked"
                    ? "bg-threat/20 text-threat border-threat/30"
                    : "bg-caution/20 text-caution border-caution/30";

              return (
                <Link key={server.id} href={`/servers/${server.id}`}>
                  <Card className="border-white/10 bg-bg-surface hover:bg-bg-elevated transition-all duration-150 hover:-translate-y-px hover:border-white/20 cursor-pointer">
                    <CardContent className="p-5 space-y-4">
                      {/* Row 1: status dot + name + transport badge */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-200 truncate flex items-center gap-2">
                            <span className={cn("size-2 rounded-full shrink-0", server.allowlist_status === "approved" ? "bg-secure" : server.allowlist_status === "blocked" ? "bg-threat" : "bg-caution")} />
                            {server.name}
                          </p>
                          <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                            {server.endpoint_url ?? server.name}
                          </p>
                        </div>
                        <Badge variant={server.transport_type === "http" ? "default" : "secondary"} className="text-[10px] shrink-0">
                          {server.transport_type === "http" ? "HTTP" : "STDIO"}
                        </Badge>
                      </div>

                      {/* Row 2: 4 inline stats */}
                      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400">
                        <div>
                          <p className="text-[9px] text-slate-500 uppercase tracking-wider">Risk</p>
                          <p className={cn(server.risk_score != null && (server.risk_score >= 80 ? "text-secure" : server.risk_score >= 60 ? "text-caution" : "text-threat"))}>
                            {server.risk_score ?? "—"}/100
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-500 uppercase tracking-wider">Latency</p>
                          <p>{latencyByServer[server.id] != null ? `${latencyByServer[server.id]}ms` : "—"}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-500 uppercase tracking-wider">Sessions</p>
                          <p>{sessionCountByServer[server.id] ?? 0}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-slate-500 uppercase tracking-wider">Last Scan</p>
                          <p>{timeAgo(server.last_scan_at ?? null)}</p>
                        </div>
                      </div>

                      {/* Row 3: allowlist badge + risk bar */}
                      <div className="space-y-2">
                        <Badge variant="outline" className={cn("text-[10px]", statusColor)}>
                          {server.allowlist_status}
                        </Badge>
                        {server.risk_score != null && (
                          <div className="h-1 w-full overflow-hidden rounded-full bg-white/5">
                            <div
                              className={cn("h-full rounded-full transition-all duration-500", server.risk_score >= 80 ? "bg-secure" : server.risk_score >= 60 ? "bg-caution" : "bg-threat")}
                              style={{ width: `${server.risk_score}%` }}
                            />
                          </div>
                        )}
                      </div>

                      {/* Rescan action */}
                      <RescanButtonWithRefresh serverId={server.id} />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )
      ) : (
        <EmptyState {...EMPTY_STATES["servers"]} />
      )}
    </main>
  );
};

export default ServersPage;
