import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Radar, Shield } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cn } from "@/lib/utils";

const SessionDetailPage = async ({
  params,
}: {
  params: Promise<{ sessionId: string }>;
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
  const { sessionId } = await params;

  const { data: session } = await svc
    .from("proxy_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("organization_id", membership.organization_id)
    .single();

  if (!session) notFound();

  const { data: toolCalls } = await svc
    .from("tool_invocation_logs")
    .select("tool_name, was_blocked, threat_type, latency_ms, permission_level, created_at, billed")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: server } = await svc
    .from("mcp_servers")
    .select("name")
    .eq("id", session.mcp_server_id)
    .single();

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/sessions" className="hover:text-slate-300">Sessions</Link>
        <span>/</span>
        <span className="text-slate-300 font-mono">{sessionId.slice(0, 12)}</span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-1">Session Detail</p>
          <h1 className="text-xl font-bold tracking-tight font-mono">{sessionId}</h1>
          <div className="flex items-center gap-3 mt-1">
            <Badge
              variant="outline"
              className={cn(
                "text-[10px]",
                session.status === "active" && "border-emerald-500/30 text-emerald-400",
                (session.status === "terminated_threat" || session.status === "terminated_rug_pull") && "border-red-500/30 text-red-400",
                session.status === "terminated_clean" && "border-slate-500/30 text-slate-400",
                session.status === "expired" && "border-slate-500/30 text-slate-400",
              )}
            >
              {session.status}
            </Badge>
            {server && <span className="text-xs text-slate-400">{server.name}</span>}
          </div>
        </div>
        <Link href="/sessions">
          <Button variant="outline" size="sm" className="border-white/10 gap-1.5">
            <ArrowLeft className="size-3.5" />
            All Sessions
          </Button>
        </Link>
      </div>

      {/* Session Info */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
          <CardContent className="p-4 text-center">
            <p className="text-lg font-bold font-mono text-slate-200">{session.tool_call_count ?? 0}</p>
            <p className="text-[10px] text-slate-500">Tool Calls</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
          <CardContent className="p-4 text-center">
            <p className="text-lg font-bold font-mono text-slate-200">{toolCalls?.filter((t) => t.was_blocked).length ?? 0}</p>
            <p className="text-[10px] text-slate-500">Blocked</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
          <CardContent className="p-4 text-center">
            <p className="text-lg font-bold font-mono text-slate-200">{session.watchdog_enabled ? "On" : "Off"}</p>
            <p className="text-[10px] text-slate-500">Watchdog</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
          <CardContent className="p-4 text-center">
            <p className="text-lg font-bold font-mono text-slate-200">
              {session.watchdog_last_verified_at
                ? new Date(session.watchdog_last_verified_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                : "—"}
            </p>
            <p className="text-[10px] text-slate-500">Last Verified</p>
          </CardContent>
        </Card>
      </div>

      {/* Tool Calls */}
      {toolCalls && toolCalls.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Tool Invocations</h2>
          <div className="space-y-1">
            {toolCalls.map((tc, i) => (
              <div key={i} className="flex items-center gap-3 rounded-md bg-white/5 px-3 py-2 text-xs">
                <div className={cn(
                  "size-2 rounded-full shrink-0",
                  tc.was_blocked ? "bg-red-500" : tc.threat_type ? "bg-amber-500" : "bg-emerald-500",
                )} />
                <span className="font-mono text-slate-300 flex-1 truncate">{tc.tool_name}</span>
                {tc.permission_level && (
                  <Badge variant="outline" className="text-[9px] border-white/10">{tc.permission_level}</Badge>
                )}
                {tc.threat_type && <Badge variant="destructive" className="text-[9px]">{tc.threat_type}</Badge>}
                {tc.latency_ms != null && <span className="text-slate-500 w-12 text-right">{tc.latency_ms}ms</span>}
                <span className="text-slate-500 w-16 text-right">{tc.billed != null ? `$${tc.billed.toFixed(4)}` : ""}</span>
                <span className="text-slate-500">{new Date(tc.created_at).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
};

export default SessionDetailPage;
