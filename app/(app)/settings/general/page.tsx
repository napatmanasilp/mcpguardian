import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "General Settings — MCPGuardian",
  description: "Manage your organization name, logo, and timezone preferences.",
};
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DeleteOrgSection } from "@/components/settings/delete-org-section";
import { NotificationToggle } from "@/components/settings/notification-toggle";
import { OrgLogoUpload } from "@/components/settings/org-logo-upload";
import { OrgNameForm } from "@/components/settings/org-name-form";
import { TimezoneSelector } from "@/components/settings/timezone-selector";
import { signOut } from "@/lib/actions/auth";
import { getOrgContext } from "@/lib/data/org-context";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const GeneralSettingsPage = async () => {
  const orgContext = await getOrgContext();
  if (!orgContext) redirect("/onboarding");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const svc = createServiceClient();

  const { data: org } = await svc
    .from("organizations")
    .select("name, timezone, logo_url, email_notifications_enabled")
    .eq("id", orgContext.organizationId)
    .single();

  const orgName = org?.name ?? "";
  const orgTimezone = org?.timezone ?? "UTC";
  const orgLogoUrl = org?.logo_url ?? null;
  const emailNotifications = org?.email_notifications_enabled ?? true;
  const userEmail = user.email ?? "";

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-1">Settings</p>
        <h1 className="text-2xl font-bold tracking-tight">General</h1>
      </div>

      {/* Organization */}
      <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-200">Organization</CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Your organization&apos;s name and branding.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <OrgNameForm initialName={orgName} />
          <OrgLogoUpload currentLogoUrl={orgLogoUrl} />
        </CardContent>
      </Card>

      {/* Timezone */}
      <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-200">Timezone</CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Set your organization&apos;s default timezone for reports and scheduling.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TimezoneSelector currentTimezone={orgTimezone} />
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-200">Notifications</CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Manage how you receive security alerts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NotificationToggle
            initialEnabled={emailNotifications}
            organizationId={orgContext.organizationId}
          />
        </CardContent>
      </Card>

      {/* Profile */}
      <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-200">Profile</CardTitle>
          <CardDescription className="text-xs text-slate-500">
            Your account email and personal settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-xs text-slate-400">Email</Label>
            <Input
              id="email"
              defaultValue={userEmail}
              disabled
              className="border-white/10 bg-white/5 max-w-md opacity-60"
            />
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone — Delete Organization */}
      <DeleteOrgSection orgName={orgName} />

      {/* Sign Out */}
      <form action={signOut}>
        <Button variant="destructive" size="sm">Sign Out</Button>
      </form>
    </main>
  );
};

export default GeneralSettingsPage;
