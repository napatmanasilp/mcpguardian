import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Plus, Search, Server, Shield, Terminal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cn } from "@/lib/utils";

const ServersPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
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

  const params = await searchParams;
  const query = params.q?.toLowerCase() ?? "";

  let queryBuilder = svc
    .from("mcp_servers")
    .select("id, name, transport_type, endpoint_url, allowlist_status, last_scan_result, risk_score, created_at, allowlisted_at")
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: false });

  if (query) {
    queryBuilder = queryBuilder.ilike("name", `%${query}%`);
  }

  const { data: servers } = await queryBuilder;

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-1">Servers</p>
          <h1 className="text-2xl font-bold tracking-tight">MCP Servers</h1>
        </div>
        <Link href="/onboarding">
          <Button className="gap-2 shrink-0">
            <Plus className="size-4" />
            Add Server
          </Button>
        </Link>
      </div>

      {/* Search */}
      <form className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
        <Input
          name="q"
          placeholder="Search servers..."
          defaultValue={query}
          className="pl-9 border-white/10 bg-white/5 w-full max-w-md"
        />
      </form>

      {/* Server Grid */}
      {servers && servers.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {servers.map((server) => {
            const scanColor =
              server.last_scan_result === "clean"
                ? "text-emerald-400"
                : server.last_scan_result === "suspicious"
                  ? "text-amber-400"
                  : server.last_scan_result === "malicious"
                    ? "text-red-400"
                    : "text-slate-500";

            const statusColor =
              server.allowlist_status === "approved"
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                : server.allowlist_status === "blocked"
                  ? "bg-red-500/20 text-red-400 border-red-500/30"
                  : "bg-amber-500/20 text-amber-400 border-amber-500/30";

            return (
              <Link key={server.id} href={`/servers/${server.id}`}>
                <Card className="border-white/10 bg-[hsl(222,47%,6%)] hover:bg-[hsl(222,47%,8%)] transition-colors cursor-pointer">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-200 truncate flex items-center gap-2">
                          {server.name}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                          {server.endpoint_url ?? server.name}
                        </p>
                      </div>
                      <Badge
                        variant={server.transport_type === "http" ? "default" : "secondary"}
                        className="text-[10px] shrink-0"
                      >
                        {server.transport_type === "http" ? "HTTP" : <><Terminal className="size-2.5 mr-1" /> STDIO</>}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={cn("text-[10px]", statusColor)}>
                        {server.allowlist_status}
                      </Badge>
                      {server.risk_score != null && (
                        <span className={cn("text-xs font-mono", scanColor)}>
                          Score: {server.risk_score}/100
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>
                        Added {new Date(server.created_at).toLocaleDateString()}
                      </span>
                      <ArrowRight className="size-3" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
          <Server className="size-12 text-slate-600 mb-4" />
          <h2 className="text-lg font-semibold text-slate-300 mb-1">No servers registered</h2>
          <p className="text-sm text-slate-500 mb-6">Add your first MCP server to begin scanning.</p>
          <Link href="/onboarding">
            <Button className="gap-2">
              <Plus className="size-4" />
              Add Server
            </Button>
          </Link>
        </div>
      )}
    </main>
  );
};

export default ServersPage;
