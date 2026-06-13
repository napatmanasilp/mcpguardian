import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { AlertRow } from "@/components/alerts/alert-row";
import { MarkAllReadButton } from "@/components/alerts/mark-all-read-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { getOrgContext } from "@/lib/data/org-context";
import { createServiceClient } from "@/lib/supabase/service";
import { EMPTY_STATES } from "@/lib/ui/empty-states";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Alerts — MCPGuardian",
  description: "View and manage security alerts for your MCP servers.",
};

const AlertsPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ severity?: string; status?: string }>;
}) => {
  const orgCtx = await getOrgContext();
  if (!orgCtx) redirect("/onboarding");

  const svc = createServiceClient();

  const params = await searchParams;
  const severityFilter = params.severity || "";
  const statusFilter = params.status || "";

  let query = svc
    .from("alerts")
    .select("id, alert_type, severity, title, message, read, created_at, organization_id, session_id, server_id")
    .eq("organization_id", orgCtx.organizationId);

  if (severityFilter && ["critical", "high", "medium"].includes(severityFilter)) {
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
            <MarkAllReadButton />
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
            <AlertRow key={alert.id} alert={alert} />
          ))}
        </div>
      ) : (
        <EmptyState {...EMPTY_STATES["alerts"]} />
      )}
    </main>
  );
};

export default AlertsPage;
