import { Infinity } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { DeleteAccountSection } from "@/components/settings/delete-account-section";
import { createClient } from "@/lib/supabase/server";

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
  const maxScans = profile?.max_scans || 3;
  const createdAt = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "N/A";

  const proUrl = process.env.NEXT_PUBLIC_POLAR_PRO_URL || "/pricing";
  const proHref = proUrl.startsWith("http")
    ? `${proUrl}?metadata%5Buser_id%5D=${encodeURIComponent(user.id)}`
    : proUrl;
  const portalUrl = process.env.NEXT_PUBLIC_POLAR_PORTAL_URL;

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
              <Badge variant={plan === "pro" ? "default" : "secondary"}>
                {plan === "pro" ? "Pro Plan" : "Free Plan"}
              </Badge>
            </div>
            <CardDescription>
              {plan === "pro"
                ? "You have unlimited scans and all Pro features."
                : "Upgrade to Pro for unlimited scans and more features."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {plan === "free" ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Scans used this month</span>
                  <span className="font-medium">{scansThisMonth} of {maxScans}</span>
                </div>
                <Progress value={scansThisMonth} max={maxScans} />
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Infinity className="size-4" />
                <span>Unlimited scans</span>
              </div>
            )}

            {plan === "free" ? (
              <Button size="lg" className="w-full" asChild>
                <Link href={proHref}>Upgrade to Pro &mdash; $29/month</Link>
              </Button>
            ) : portalUrl ? (
              <Button variant="outline" size="lg" className="w-full" asChild>
                <Link href={portalUrl} target="_blank" rel="noopener noreferrer">
                  Manage Subscription
                </Link>
              </Button>
            ) : null}
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