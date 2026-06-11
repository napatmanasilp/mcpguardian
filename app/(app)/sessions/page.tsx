import Link from "next/link";
import { redirect } from "next/navigation";
import { Radar } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cn } from "@/lib/utils";

const SessionsPage = async () => {
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

  const { data: sessions } = await svc
    .from("proxy_sessions")
    .select("id, status, tool_call_count, watchdog_enabled, watchdog_last_verified_at, created_at, terminated_at, termination_reason, mcp_server_id")
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-1">Sessions</p>
        <h1 className="text-2xl font-bold tracking-tight">Proxy Sessions</h1>
      </div>

      {sessions && sessions.length > 0 ? (
        <div className="space-y-2">
          {sessions.map((session) => (
            <Link key={session.id} href={`/sessions/${session.id}`}>
              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3 hover:bg-white/10 hover:-translate-y-px transition-all duration-150 cursor-pointer">
                <div className="flex items-center gap-4 min-w-0">
                  <Badge
                    className={cn(
                      "text-[10px] shrink-0",
                      session.status === "active" && "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
                      session.status === "terminated_clean" && "bg-slate-500/20 text-slate-400 border-slate-500/30",
                      (session.status === "terminated_threat" || session.status === "terminated_rug_pull") && "bg-red-500/20 text-red-400 border-red-500/30",
                      session.status === "expired" && "bg-slate-500/20 text-slate-400 border-slate-500/30",
                    )}
                    variant="outline"
                  >
                    {session.status}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-sm text-slate-200 truncate font-mono">{session.id.slice(0, 12)}…</p>
                    <p className="text-xs text-slate-500">
                      {session.tool_call_count ?? 0} tool calls
                      {session.watchdog_enabled && " · Watchdog enabled"}
                      {session.termination_reason && ` · ${session.termination_reason}`}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-slate-500 shrink-0">
                  {session.terminated_at
                    ? new Date(session.terminated_at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                    : new Date(session.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
          <Radar className="size-12 text-slate-600 mb-4" />
          <h2 className="text-lg font-semibold text-slate-300 mb-1">No sessions yet</h2>
          <p className="text-sm text-slate-500 mb-6">Proxy sessions appear when your MCP client connects through the proxy.</p>
          <Link href="/onboarding/proxy-setup">
            <Button variant="outline" className="border-blue-500/30 text-blue-400">
              Set up proxy connection
            </Button>
          </Link>
        </div>
      )}
    </main>
  );
};

export default SessionsPage;
