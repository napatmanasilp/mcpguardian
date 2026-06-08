import { BarChart3, Bell, Eye, Search, Shield } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

interface ScanRow {
  id: string;
  overall_grade: string;
  overall_score: number;
  servers_scanned: number;
  created_at: string;
}

const gradeBadgeVariant = (grade: string) => {
  if (grade === "A" || grade === "B") return "default" as const;
  return "destructive" as const;
};

const DashboardPage = async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ count: totalScans }, { data: avgScoreData }, { count: activeMonitors }, { count: unreadAlerts }, { data: recentScans }] = await Promise.all([
    supabase
      .from("scans")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id),
    supabase
      .from("scans")
      .select("overall_score")
      .eq("user_id", user.id),
    supabase
      .from("monitored_configs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_active", true),
    supabase
      .from("alerts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("read", false),
    supabase
      .from("scans")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const scores = avgScoreData?.map((r) => r.overall_score) || [];
  const avgScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : null;

  return (
    <main className="flex flex-1 flex-col gap-8 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Welcome back</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <Button variant="default" size="sm" asChild>
          <Link href="/scan">Run New Scan &rarr;</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Scans</CardTitle>
            <Search className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalScans ?? 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average Score</CardTitle>
            <BarChart3 className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {avgScore !== null ? `${avgScore}/100` : "\u2014"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Monitors</CardTitle>
            <Eye className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{activeMonitors ?? 0}</p>
          </CardContent>
        </Card>

        <Card className="relative">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unread Alerts</CardTitle>
            <Bell className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{(unreadAlerts ?? 0) > 0 ? unreadAlerts : 0}</p>
            {(unreadAlerts ?? 0) > 0 && (
              <span className="absolute right-4 top-4 flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-red-500" />
              </span>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold">Recent Scans</h2>

        {recentScans && recentScans.length > 0 ? (
          <div className="space-y-3">
            {(recentScans as ScanRow[]).map((scan) => (
              <Link
                key={scan.id}
                href={`/reports/${scan.id}`}
                className="flex items-center gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50"
              >
                <Badge variant={gradeBadgeVariant(scan.overall_grade)}>
                  {scan.overall_grade}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {new Date(scan.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <span className="text-sm font-medium tabular-nums">{scan.overall_score}/100</span>
                <span className="text-sm text-muted-foreground">
                  {scan.servers_scanned} server{scan.servers_scanned !== 1 ? "s" : ""}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
              <Shield className="size-12 text-muted-foreground/40" />
              <div>
                <p className="text-lg font-medium">No scans yet</p>
                <p className="text-sm text-muted-foreground">
                  Run your first security scan to check your MCP configuration
                </p>
              </div>
              <Button asChild>
                <Link href="/scan">Scan Now &rarr;</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
};

export default DashboardPage;