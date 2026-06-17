import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, Plus } from "lucide-react";

export const metadata: Metadata = {
  title: "Alert Channels — MCPGuardian",
  description: "Configure notification channels for security alerts.",
};

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrgContext } from "@/lib/data/org-context";
import { hasFeature } from "@/lib/feature-gates";
import { AlertChannelsGate } from "@/components/alerts/alert-channels-gate";
import { cn } from "@/lib/utils";

const AlertChannelsPage = async () => {
  const orgContext = await getOrgContext();
  if (!orgContext) redirect("/onboarding");

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

  // Webhook forwarding requires Team plan
  const hasWebhookAccess = hasFeature(orgContext.plan, "webhook_forwarding");

  const { data: channels } = await svc
    .from("alert_channels")
    .select("*")
    .eq("organization_id", membership.organization_id)
    .order("created_at", { ascending: false });

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-1">Alert Channels</p>
          <h1 className="text-2xl font-bold tracking-tight">Notification Channels</h1>
        </div>
        {hasWebhookAccess && (
          <Button className="gap-2 shrink-0">
            <Plus className="size-4" />
            Add Channel
          </Button>
        )}
      </div>

      {!hasWebhookAccess ? (
        <AlertChannelsGate currentPlan={orgContext.plan} />
      ) : channels && channels.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {channels.map((ch) => (
            <Card key={ch.id} className="border-white/10 bg-[hsl(222,47%,6%)]">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px]",
                      ch.type === "webhook" ? "border-blue-500/30 text-blue-400" :
                      ch.type === "email" ? "border-emerald-500/30 text-emerald-400" :
                      "border-slate-500/30 text-slate-400",
                    )}
                  >
                    {ch.type}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px]",
                      ch.verified ? "border-emerald-500/30 text-emerald-400" : "border-amber-500/30 text-amber-400",
                    )}
                  >
                    {ch.verified ? "Verified" : "Unverified"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-200 truncate">{ch.name}</p>
                  {ch.config?.url && (
                    <p className="text-xs text-slate-500 font-mono truncate mt-0.5">{ch.config.url}</p>
                  )}
                  {ch.config?.email && (
                    <p className="text-xs text-slate-500 mt-0.5">{ch.config.email}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
          <Bell className="size-12 text-slate-600 mb-4" />
          <h2 className="text-lg font-semibold text-slate-300 mb-1">No channels configured</h2>
          <p className="text-sm text-slate-500">Add a webhook or email channel to receive security alert notifications.</p>
        </div>
      )}
    </main>
  );
};

export default AlertChannelsPage;
