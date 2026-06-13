import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ScanSearch } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cn } from "@/lib/utils";

const ServerScansPage = async ({
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

  const { data: scans } = await svc
    .from("scans")
    .select("id, overall_score, overall_result, risk_score, servers_scanned, trigger_reason, created_at")
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
        <span className="text-slate-300">Scans</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Scan History</h1>
          <p className="text-sm text-slate-500">{server.name}</p>
        </div>
        <Link href={`/servers/${serverId}`}>
          <Button variant="outline" size="sm" className="border-white/10 gap-1.5">
            <ArrowLeft className="size-3.5" />
            Back to server
          </Button>
        </Link>
      </div>

      {scans && scans.length > 0 ? (
        <div className="space-y-2">
          {scans.map((scan) => (
            <Link key={scan.id} href={`/reports/${scan.id}`}>
              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10 transition-colors">
                <div className="flex items-center gap-4">
                  <span className={cn(
                    "font-mono text-base font-bold",
                    scan.overall_score >= 80 ? "text-secure" :
                    scan.overall_score >= 60 ? "text-caution" :
                    "text-threat"
                  )}>
                    {scan.overall_score ?? "—"}
                  </span>
                  <div>
                    <p className="text-sm text-slate-200 capitalize">{scan.overall_result ?? "unknown"}</p>
                    <p className="text-xs text-slate-500">
                      Risk: {scan.risk_score ?? "—"} · Servers: {scan.servers_scanned ?? 1}
                      {scan.trigger_reason && ` · ${scan.trigger_reason}`}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-slate-500 shrink-0">
                  {new Date(scan.created_at).toLocaleDateString(undefined, {
                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
          <ScanSearch className="size-12 text-slate-600 mb-4" />
          <h2 className="text-lg font-semibold text-slate-300 mb-1">No scans yet</h2>
          <p className="text-sm text-slate-500">Run a scan to see results here.</p>
        </div>
      )}
    </main>
  );
};

export default ServerScansPage;
