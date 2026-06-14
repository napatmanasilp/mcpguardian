import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Plus, User } from "lucide-react";

export const metadata: Metadata = {
  title: "Team — MCPGuardian",
  description: "Manage team members and their roles within your organization.",
};

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getOrgContext } from "@/lib/data/org-context";
import { createServiceClient } from "@/lib/supabase/service";
import { cn } from "@/lib/utils";

const TeamSettingsPage = async () => {
  const orgContext = await getOrgContext();
  if (!orgContext) redirect("/onboarding");

  const svc = createServiceClient();

  // Fetch all organization members with their email from profiles
  const { data: members } = await svc
    .from("organization_members")
    .select("id, user_id, role, invitation_status, invited_email, created_at")
    .eq("organization_id", orgContext.organizationId)
    .order("created_at", { ascending: true });

  // Resolve emails from auth.users for accepted members
  const userIds = (members ?? [])
    .filter((m) => m.user_id)
    .map((m) => m.user_id);

  let emailMap: Record<string, string> = {};
  if (userIds.length > 0) {
    // Use auth admin API to get user emails
    const { data: { users } } = await svc.auth.admin.listUsers();
    if (users) {
      for (const u of users) {
        if (userIds.includes(u.id) && u.email) {
          emailMap[u.id] = u.email;
        }
      }
    }
  }

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
            members.map((m) => {
              const email =
                emailMap[m.user_id] ??
                m.invited_email ??
                m.user_id.slice(0, 12) + "…";

              return (
                <div key={m.id} className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-full bg-blue-500/15 flex items-center justify-center">
                      <User className="size-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">{email}</p>
                      <p className="text-[10px] text-slate-500">
                        {m.invitation_status === "accepted"
                          ? "Active"
                          : m.invitation_status === "pending"
                            ? "Invited"
                            : m.invitation_status}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px]",
                      m.role === "owner"
                        ? "border-blue-500/30 text-blue-400"
                        : m.role === "admin"
                          ? "border-amber-500/30 text-amber-400"
                          : "border-slate-500/30 text-slate-400",
                    )}
                  >
                    {m.role}
                  </Badge>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">No members found</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default TeamSettingsPage;
