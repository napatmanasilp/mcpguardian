import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signOut } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const GeneralSettingsPage = async () => {
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

  let orgName = "";
  let userEmail = user.email ?? "";

  if (membership) {
    const { data: org } = await svc
      .from("organizations")
      .select("name")
      .eq("id", membership.organization_id)
      .single();
    if (org) orgName = org.name;
  }

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
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orgName" className="text-xs text-slate-400">Organization name</Label>
            <Input
              id="orgName"
              defaultValue={orgName}
              className="border-white/10 bg-white/5 max-w-md"
            />
          </div>
          <Button size="sm" className="bg-blue-600 hover:bg-blue-700">Save</Button>
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

      {/* Sign Out */}
      <form action={signOut}>
        <Button variant="destructive" size="sm">Sign Out</Button>
      </form>
    </main>
  );
};

export default GeneralSettingsPage;
