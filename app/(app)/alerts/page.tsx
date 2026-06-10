import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cn } from "@/lib/utils";

const AlertsPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ severity?: string; status?: string }>;
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
  const severityFilter = params.severity || "";
  const statusFilter = params.status || "";

  let query = svc
    .from("alerts")
    .select("id, alert_type, severity, title, message, read, created_at, organization_id")
    .eq("organization_id", membership.organization_id);

  if (severityFilter && ["critical", "high", "medium"].includes(severityFilter)) {
    // Case-insensitive match — DB stores uppercase (e.g., "CRITICAL"), filters use lowercase
    query = query.ilike("severity", severityFilter);
  }

  if (statusFilter === "unread") {
    query = query.eq("read", false);
  } else if (statusFilter === "read") {
    query = query.eq("read", true);
  }

  const { data: alerts } = await query
    .order("created_at", { ascending: false })
    .limit(50);

  const hasUnread = alerts?.some((a) => !a.read) ?? false;

  const severityIcon = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "critical":
        return <span className="size-3 rounded-full bg-red-500 shrink-0" />;
      case "high":
        return <span className="size-3 rounded-full bg-orange-500 shrink-0" />;
      case "medium":
        return <span className="size-3 rounded-full bg-yellow-500 shrink-0" />;
      default:
        return <span className="size-3 rounded-full bg-blue-500 shrink-0" />;
    }
  };

  const relativeTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
  };

  const buildUrl = (severity: string, status: string) => {
    const p = new URLSearchParams();
    if (severity) p.set("severity", severity);
    if (status) p.set("status", status);
    const qs = p.toString();
    return qs ? `/alerts?${qs}` : "/alerts";
  };

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-1">Security</p>
          <h1 className="text-2xl font-bold tracking-tight">Alerts</h1>
        </div>
        <div className="flex items-center gap-2">
          {hasUnread && (
            <form
              action={async () => {
                "use server";
                const s = await createClient();
                const { data: { user: u } } = await s.auth.getUser();
                if (u) {
                  const sv = createServiceClient();
                  const { data: m } = await sv
                    .from("organization_members")
                    .select("organization_id")
                    .eq("user_id", u.id)
                    .eq("invitation_status", "accepted")
                    .single();
                  if (m) {
                    await sv
                      .from("alerts")
                      .update({ read: true })
                      .eq("organization_id", m.organization_id)
                      .eq("read", false);
                  }
                }
              }}
            >
              <Button type="submit" variant="outline" size="sm" className="border-white/10">
                Mark All Read
              </Button>
            </form>
          )}
          <Link href="/activity">
            <Button variant="outline" size="sm" className="border-white/10 gap-1.5">
              <ExternalLink className="size-3.5" />
              Activity Timeline
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-mono">Severity:</span>
          <div className="flex gap-1">
            {[
              { value: "", label: "All" },
              { value: "critical", label: "Critical" },
              { value: "high", label: "High" },
              { value: "medium", label: "Medium" },
            ].map((opt) => {
              const isActive = severityFilter === opt.value;
              return (
                <Link
                  key={opt.value}
                  href={buildUrl(opt.value, statusFilter)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all",
                    isActive
                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent",
                  )}
                >
                  {opt.label}
                </Link>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-mono">Status:</span>
          <div className="flex gap-1">
            {[
              { value: "", label: "All" },
              { value: "unread", label: "Unread" },
              { value: "read", label: "Read" },
            ].map((opt) => {
              const isActive = statusFilter === opt.value;
              return (
                <Link
                  key={opt.value}
                  href={buildUrl(severityFilter, opt.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all",
                    isActive
                      ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent",
                  )}
                >
                  {opt.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Alert List */}
      {alerts && alerts.length > 0 ? (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <form key={alert.id} action={async () => {
              "use server";
              const sv = createServiceClient();
              await sv
                .from("alerts")
                .update({ read: true })
                .eq("id", alert.id)
                .eq("organization_id", membership.organization_id);
            }}>
              <button type="submit" className="w-full text-left">
                <div
                  className={cn(
                    "flex items-start gap-4 rounded-lg border px-4 py-3 transition-colors hover:bg-white/[0.03] cursor-pointer",
                    !alert.read
                      ? "border-l-4 border-l-blue-500 border-white/10 bg-[hsl(222,47%,6%)]"
                      : "border-white/5 bg-white/[0.02]",
                  )}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex items-center gap-2 shrink-0">
                      {severityIcon(alert.severity)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p
                          className={cn(
                            "text-sm font-medium truncate",
                            !alert.read ? "text-slate-200" : "text-slate-400",
                          )}
                        >
                          {alert.title}
                        </p>
                        <Badge
                          variant={
                            alert.severity.toLowerCase() === "critical"
                              ? "destructive"
                              : alert.severity.toLowerCase() === "high"
                                ? "default"
                                : "secondary"
                          }
                          className="text-[9px] shrink-0"
                        >
                          {alert.severity}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">
                        {alert.message}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1">
                        {relativeTime(alert.created_at)}
                      </p>
                    </div>
                  </div>
                  {!alert.read && (
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500" />
                  )}
                </div>
              </button>
            </form>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <Bell className="size-12 text-slate-600/40" />
            <div>
              <p className="text-lg font-medium text-slate-200">No alerts</p>
              <p className="text-sm text-slate-400">
                {severityFilter || statusFilter
                  ? "Try changing the filter"
                  : "Your MCP servers are looking good. We'll notify you if anything changes."}
              </p>
            </div>
            {!severityFilter && !statusFilter && (
              <Link href="/activity">
                <Button variant="outline" size="sm" className="border-white/10 gap-1.5">
                  <ExternalLink className="size-3.5" />
                  View Activity Timeline
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
};

export default AlertsPage;
