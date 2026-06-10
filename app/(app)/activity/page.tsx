import { redirect } from "next/navigation";
import { Activity, AlertTriangle, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cn } from "@/lib/utils";

const ActivityPage = async () => {
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

  const [threatsResult, alertsResult] = await Promise.all([
    svc
      .from("tool_invocation_logs")
      .select("id, tool_name, mcp_server_id, was_blocked, threat_type, latency_ms, session_id, created_at")
      .eq("organization_id", membership.organization_id)
      .not("threat_type", "is", null)
      .order("created_at", { ascending: false })
      .limit(50),
    svc
      .from("alerts")
      .select("id, alert_type, severity, title, message, created_at, read")
      .eq("organization_id", membership.organization_id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const threats = threatsResult.data ?? [];
  const alerts = alertsResult.data ?? [];

  // Merge and sort by created_at
  const allEvents = [
    ...threats.map((t) => ({
      id: t.id,
      type: "threat" as const,
      title: t.threat_type ?? "Unknown threat",
      description: `Tool: ${t.tool_name}`,
      severity: t.was_blocked ? "critical" as const : "high" as const,
      createdAt: t.created_at,
    })),
    ...alerts.filter((a) => a.severity === "CRITICAL" || a.severity === "HIGH").map((a) => ({
      id: a.id,
      type: "alert" as const,
      title: a.title,
      description: a.message,
      severity: (a.severity?.toLowerCase() ?? "medium") as "critical" | "high" | "medium",
      createdAt: a.created_at,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-1">Activity</p>
        <h1 className="text-2xl font-bold tracking-tight">Security Activity</h1>
      </div>

      {allEvents.length > 0 ? (
        <div className="space-y-2">
          {allEvents.map((event) => (
            <div
              key={`${event.type}-${event.id}`}
              className={cn(
                "flex items-start gap-3 rounded-lg border px-4 py-3",
                event.severity === "critical" ? "border-red-500/20 bg-red-500/5" :
                event.severity === "high" ? "border-amber-500/20 bg-amber-500/5" :
                "border-white/10 bg-white/5",
              )}
            >
              <div className={cn(
                "size-8 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                event.severity === "critical" ? "bg-red-500/20" :
                event.severity === "high" ? "bg-amber-500/20" :
                "bg-slate-500/20",
              )}>
                {event.type === "threat" ? (
                  <ShieldAlert className={cn("size-4", event.severity === "critical" ? "text-red-400" : "text-amber-400")} />
                ) : (
                  <AlertTriangle className={cn("size-4", event.severity === "critical" ? "text-red-400" : "text-amber-400")} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-200 truncate">{event.title}</p>
                  <Badge
                    variant={event.severity === "critical" ? "destructive" : "secondary"}
                    className="text-[9px] shrink-0"
                  >
                    {event.severity}
                  </Badge>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{event.description}</p>
                <p className="text-[10px] text-slate-500 mt-1">
                  {new Date(event.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
          <Activity className="size-12 text-slate-600 mb-4" />
          <h2 className="text-lg font-semibold text-slate-300 mb-1">No security events</h2>
          <p className="text-sm text-slate-500">Threat and alert activity will appear here once detected.</p>
        </div>
      )}
    </main>
  );
};

export default ActivityPage;
