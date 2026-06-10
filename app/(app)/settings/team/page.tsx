import { redirect } from "next/navigation";
import { Mail, Plus, Shield, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cn } from "@/lib/utils";

const TeamSettingsPage = async () => {
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

  const { data: members } = await svc
    .from("organization_members")
    .select("id, user_id, role, invitation_status, created_at")
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: true });

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-1">Settings</p>
        <h1 className="text-2xl font-bold tracking-tight">Team</h1>
      </div>

      <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-200">Members</CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Manage who has access to your organization.
            </CardDescription>
          </div>
          <Button size="sm" className="gap-1.5">
            <Plus className="size-3.5" />
            Invite
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {members && members.length > 0 ? (
            members.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-full bg-blue-500/15 flex items-center justify-center">
                    <User className="size-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-200">{m.user_id.slice(0, 12)}…</p>
                    <p className="text-[10px] text-slate-500">
                      {m.invitation_status === "accepted" ? "Active" : m.invitation_status}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px]",
                    m.role === "owner" ? "border-blue-500/30 text-blue-400" : "border-slate-500/30 text-slate-400",
                  )}
                >
                  {m.role}
                </Badge>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">No members found</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default TeamSettingsPage;
