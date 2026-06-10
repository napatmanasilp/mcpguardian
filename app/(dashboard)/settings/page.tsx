import { Infinity } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { DeleteAccountSection } from "@/components/settings/delete-account-section";
import { getPlanDisplayName, getOverageRateDisplay } from "@/lib/plan-limits";
import { createClient } from "@/lib/supabase/server";

const planLimits: Record<string, { label: string; checks: number | string; description: string }> = {
  free: { label: "Free Plan", checks: 100, description: "Basic scanning with limited checks." },
  developer: { label: "Developer Plan", checks: "2,000", description: "For indie builders and power developers." },
  team: { label: "Team Plan", checks: "20,000", description: "For small teams shipping with AI agents." },
  startup: { label: "Startup Plan", checks: "200,000", description: "For scaling companies." },
  enterprise: { label: "Enterprise Plan", checks: "Custom", description: "Custom plan with dedicated support." },
};

const SettingsPage = async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const plan = profile?.plan || "free";
  const scansThisMonth = profile?.scans_this_month || 0;
  const checksPurchased = profile?.checks_purchased ?? 0;

  const planInfo = planLimits[plan] ?? planLimits.free;
  const checksIncluded = typeof planInfo.checks === "number" ? planInfo.checks : 0;
  const totalAvailable = typeof planInfo.checks === "number"
    ? planInfo.checks + checksPurchased
    : Infinity;
  const percentUsed = totalAvailable === Infinity
    ? 0
    : Math.round((scansThisMonth / Math.max(totalAvailable as number, 1)) * 100);

  const createdAt = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "N/A";

  return (
    <main className="flex flex-1 flex-col gap-8 p-8">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">Manage your account and subscription</p>
      </div>

      <div className="max-w-2xl space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <span className="text-sm font-medium text-muted-foreground">Email</span>
              <p className="mt-0.5">{user.email}</p>
            </div>
            <Separator />
            <div>
              <span className="text-sm font-medium text-muted-foreground">Member since</span>
              <p className="mt-0.5">{createdAt}</p>
            </div>
            <Separator />
            <div>
              <span className="text-sm font-medium text-muted-foreground">User ID</span>
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">{user.id}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Current Plan</CardTitle>
              <Badge variant={plan === "free" ? "secondary" : "default"}>
                {planInfo.label}
              </Badge>
            </div>
            <CardDescription>{planInfo.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {plan === "enterprise" ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Infinity className="size-4" />
                <span>Custom checks — contact your account manager</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Checks used this month</span>
                  <span className="font-medium">
                    {scansThisMonth} of{" "}
                    {totalAvailable === Infinity
                      ? "Unlimited"
                      : (totalAvailable as number).toLocaleString()}
                  </span>
                </div>
                <Progress value={percentUsed} max={100} />
                {checksPurchased > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Includes {checksPurchased.toLocaleString()} top-up credit
                    {checksPurchased !== 1 ? "s" : ""}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <Button size="sm" variant="outline" asChild>
                <Link href="/billing">View Billing</Link>
              </Button>
              {plan !== "enterprise" && (
                <Button size="sm" asChild>
                  <Link href="/billing/upgrade">Upgrade Plan</Link>
                </Button>
              )}
            </div>

            {plan !== "free" && plan !== "enterprise" && plan !== "payg" && (
              <p className="text-xs text-muted-foreground">
                Overage rate: {getOverageRateDisplay(plan, 0)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-red-200 dark:border-red-900">
          <CardHeader>
            <CardTitle className="text-red-500">Delete Account</CardTitle>
            <CardDescription>
              Permanently delete your account and all data. This cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DeleteAccountSection userId={user.id} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default SettingsPage;
