import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CreditCard, ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cn } from "@/lib/utils";

const teamLimits: Record<string, { scans: number; toolCalls: number }> = {
  free: { scans: 50, toolCalls: 0 },
  developer: { scans: 100, toolCalls: 25000 },
  team: { scans: 500, toolCalls: 100000 },
  startup: { scans: 2000, toolCalls: 500000 },
  enterprise: { scans: -1, toolCalls: -1 },
};

const BillingSettingsPage = async () => {
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

  const { data: org } = await svc
    .from("organizations")
    .select("name, plan_id, scans_used_this_period, tool_calls_used_this_period, current_period_start, current_period_end, billing_cycle")
    .eq("id", membership.organization_id)
    .single();

  if (!org) redirect("/onboarding");

  const { data: addons } = await svc
    .from("addon_purchases")
    .select("*")
    .eq("organization_id", membership.organization_id)
    .eq("status", "active");

  const limits = teamLimits[org.plan_id ?? "free"] ?? teamLimits.free;
  const scanPercent = limits.scans === -1 ? 0 : Math.min(100, Math.round(((org.scans_used_this_period ?? 0) / limits.scans) * 100));
  const toolCallPercent = limits.toolCalls === -1 ? 0 : Math.min(100, Math.round(((org.tool_calls_used_this_period ?? 0) / limits.toolCalls) * 100));
  const planLabel = org.plan_id ? org.plan_id.charAt(0).toUpperCase() + org.plan_id.slice(1) : "Free";
  const isAnnual = org.billing_cycle === "annual";
  const isPaid = org.plan_id !== "free";

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-1">Settings</p>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
      </div>

      {/* Current Plan */}
      <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-200">Current Plan</CardTitle>
            <CardDescription className="text-xs text-slate-500">Your active subscription</CardDescription>
          </div>
          <Badge className={cn("text-[10px]", isPaid ? "bg-blue-500/20 text-blue-400" : "bg-slate-500/20 text-slate-400")}>
            {planLabel}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-slate-500">Billing Cycle</p>
              <p className="font-semibold text-slate-200 capitalize">{org.billing_cycle ?? "monthly"}</p>
            </div>
            {org.current_period_end && (
              <div>
                <p className="text-xs text-slate-500">Next Renewal</p>
                <p className="font-semibold text-slate-200">
                  {new Date(org.current_period_end).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}
                </p>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Link href="/upgrade">
              <Button size="sm" variant="outline" className="border-blue-500/30 text-blue-400">
                Change Plan
              </Button>
            </Link>
            <form action="/api/billing/portal" method="POST">
              <Button type="submit" size="sm" variant="outline" className="border-white/10 gap-1.5">
                <ExternalLink className="size-3.5" />
                Manage Billing
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Usage */}
      <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-200">Usage This Period</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {limits.scans > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Scans</span>
                <span className="text-slate-300 font-mono">{org.scans_used_this_period ?? 0} / {limits.scans}</span>
              </div>
              <Progress
                value={scanPercent}
                className={cn("h-2", scanPercent >= 95 ? "[&>div]:bg-red-500" : scanPercent >= 80 ? "[&>div]:bg-amber-500" : "[&>div]:bg-blue-500")}
              />
            </div>
          )}
          {limits.toolCalls > 0 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Tool Calls</span>
                <span className="text-slate-300 font-mono">{org.tool_calls_used_this_period ?? 0} / {limits.toolCalls.toLocaleString()}</span>
              </div>
              <Progress
                value={toolCallPercent}
                className={cn("h-2", toolCallPercent >= 95 ? "[&>div]:bg-red-500" : toolCallPercent >= 80 ? "[&>div]:bg-amber-500" : "[&>div]:bg-blue-500")}
              />
            </div>
          )}
          <Link href="/api/billing/usage">
            <Button size="sm" variant="link" className="text-xs text-blue-400 -ml-2">
              View detailed usage <ArrowRight className="size-3 ml-1" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Add-Ons */}
      <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold text-slate-200">Active Add-Ons</CardTitle>
            <CardDescription className="text-xs text-slate-500">Purchased extras on your account</CardDescription>
          </div>
          <Link href="/upgrade">
            <Button size="sm" variant="outline" className="border-blue-500/30 text-blue-400 text-xs">
              Browse Add-Ons
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {addons && addons.length > 0 ? (
            <div className="space-y-2">
              {addons.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2 text-sm">
                  <span className="text-slate-200">{a.addon_type}</span>
                  <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">
                    {a.quantity} × active
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">No add-ons purchased</p>
          )}
        </CardContent>
      </Card>

      {/* Annual Upgrade Banner */}
      {!isAnnual && isPaid && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/8 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-emerald-300">Save 2 months with annual billing</p>
            <p className="text-xs text-slate-400 mt-0.5">Switch to annual and save ~17% on your subscription.</p>
          </div>
          <Button size="sm" variant="outline" className="border-emerald-500/30 text-emerald-400 shrink-0">
            Switch to Annual
          </Button>
        </div>
      )}
    </main>
  );
};

export default BillingSettingsPage;
