import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutGrid, List, Plus, Search } from "lucide-react";

export const metadata: Metadata = {
  title: "Servers — MCPGuardian",
  description: "Manage your registered MCP servers, view risk scores, and trigger rescans.",
};

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { ServersListClient } from "@/components/servers/servers-list-client";
import { getOrgContext } from "@/lib/data/org-context";
import { createServiceClient } from "@/lib/supabase/service";
import { EMPTY_STATES } from "@/lib/ui/empty-states";
import { cn } from "@/lib/utils";

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

      {/* Server List */}
      {servers && servers.length > 0 ? (
        <ServersListClient
          servers={servers}
          latencyByServer={latencyByServer}
          sessionCountByServer={sessionCountByServer}
          currentView={currentView}
        />
      ) : (
        <EmptyState {...EMPTY_STATES["servers"]} />
      )}
    </main>
  );
};

export default ServersPage;
