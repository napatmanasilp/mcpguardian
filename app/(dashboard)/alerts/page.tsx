import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

interface AlertRow {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  message: string;
  read: boolean;
  monitor_name: string | null;
  created_at: string;
}

const severityIcon = (severity: string) => {
  switch (severity) {
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
  if (mins < 60) return `${mins} minute${mins > 1 ? "s" : ""} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days > 1 ? "s" : ""} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months > 1 ? "s" : ""} ago`;
};

const AlertsPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ severity?: string; status?: string }>;
}) => {
  const params = await searchParams;
  const severityFilter = params.severity || "";
  const statusFilter = params.status || "";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let query = supabase
    .from("alerts")
    .select("*, monitored_configs!left(name)")
    .eq("user_id", user.id);

  if (severityFilter && ["critical", "high", "medium"].includes(severityFilter)) {
    query = query.eq("severity", severityFilter);
  }

  if (statusFilter === "unread") {
    query = query.eq("read", false);
  } else if (statusFilter === "read") {
    query = query.eq("read", true);
  }

  const { data: alerts } = await query
    .order("created_at", { ascending: false })
    .limit(20);

  const buildUrl = (severity: string, status: string) => {
    const params = new URLSearchParams();
    if (severity) params.set("severity", severity);
    if (status) params.set("status", status);
    const qs = params.toString();
    return qs ? `/alerts?${qs}` : "/alerts";
  };

  return (
    <main className="flex flex-1 flex-col gap-8 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Security Alerts</h1>
          <p className="text-muted-foreground">Notifications about your monitored configurations</p>
        </div>
        <form
          action={async () => {
            "use server";
            const supabase = await createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              await supabase
                .from("alerts")
                .update({ read: true })
                .eq("user_id", user.id)
                .eq("read", false);
            }
          }}
        >
          <Button type="submit" variant="outline" size="sm">
            Mark All Read
          </Button>
        </form>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Severity:</span>
        <div className="flex gap-2">
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
                className={`inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-input hover:bg-accent"
                }`}
              >
                {opt.label}
              </Link>
            );
          })}
        </div>
        <span className="text-sm text-muted-foreground ml-4">Status:</span>
        <div className="flex gap-2">
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
                className={`inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-input hover:bg-accent"
                }`}
              >
                {opt.label}
              </Link>
            );
          })}
        </div>
      </div>

      {alerts && alerts.length > 0 ? (
        <div className="space-y-3">
          {(alerts as unknown as AlertRow[]).map((alert) => (
            <form key={alert.id} action={async () => {
              "use server";
              const supabase = await createClient();
              await supabase
                .from("alerts")
                .update({ read: true })
                .eq("id", alert.id);
            }}>
              <button type="submit" className="w-full text-left">
                <Card
                  className={`transition-colors hover:bg-muted/50 cursor-pointer ${
                    !alert.read ? "border-l-4 border-l-blue-500" : ""
                  }`}
                >
                  <CardContent className="flex items-start gap-4 py-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex items-center gap-2 shrink-0">
                        {severityIcon(alert.severity)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p
                            className={`text-sm font-medium truncate ${
                              !alert.read ? "text-foreground" : "text-muted-foreground"
                            }`}
                          >
                            {alert.title}
                          </p>
                          {alert.monitor_name && (
                            <Badge variant="outline" className="shrink-0 text-xs">
                              {alert.monitor_name}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                          {alert.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {relativeTime(alert.created_at)}
                        </p>
                      </div>
                    </div>
                    {!alert.read && (
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500" />
                    )}
                  </CardContent>
                </Card>
              </button>
            </form>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <CheckCircle2 className="size-12 text-green-500" />
            <div>
              <h3 className="text-lg font-medium">No alerts</h3>
              <p className="text-sm text-muted-foreground">
                {severityFilter || statusFilter
                  ? "Try changing the filter"
                  : "Your MCP servers are looking good! We'll notify you if anything changes."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </main>
  );
};

export default AlertsPage;
