import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, ArrowRight, ExternalLink } from "lucide-react";

export const metadata: Metadata = {
  title: "Billing — MCPGuardian",
  description: "View your plan, usage metrics, and invoice history.",
};

import { AnnualSwitchButton } from "@/components/billing/annual-switch-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getOrgContext } from "@/lib/data/org-context";
import { createServiceClient } from "@/lib/supabase/service";
import { shouldShowWarning, formatAllowanceDisplay } from "@/lib/quota-enforcer";
import { TIER_CATALOG, getTier } from "@/lib/tier-catalog";
import { cn } from "@/lib/utils";

const BillingSettingsPage = async () => {
  const orgContext = await getOrgContext();
  if (!orgContext) redirect("/onboarding");

  const svc = createServiceClient();

  const { data: org } = await svc
    .from("organizations")
    .select("name, plan_id, scans_used_this_period, tool_calls_used_this_period, current_period_start, current_period_end, billing_cycle")
    .eq("id", orgContext.organizationId)
    .single();

  if (!org) redirect("/onboarding");

  const { data: addons } = await svc
    .from("addon_purchases")
    .select("*")
    .eq("organization_id", orgContext.organizationId)
    .eq("status", "active");

  const { data: invoices } = await svc
    .from("usage_billing_records")
    .select("id, created_at, total_charge_cents, status")
    .eq("organization_id", orgContext.organizationId)
    .order("created_at", { ascending: false })
    .limit(10);

  const tier = getTier(org.plan_id ?? "free") ?? TIER_CATALOG.free;
  const scanAllowance = tier.scanAllowance;
  const toolCallAllowance = tier.toolCallAllowance;
  const scansUsed = org.scans_used_this_period ?? 0;
  const toolCallsUsed = org.tool_calls_used_this_period ?? 0;

  const scanPercent = scanAllowance === null ? 0 : Math.min(100, Math.round((scansUsed / scanAllowance) * 100));
  const toolCallPercent = toolCallAllowance === null ? 0 : Math.min(100, Math.round((toolCallsUsed / toolCallAllowance) * 100));

  const showScanWarning = shouldShowWarning(scansUsed, scanAllowance);
  const showToolCallWarning = shouldShowWarning(toolCallsUsed, toolCallAllowance);
  const showUpgradeWarning = showScanWarning || showToolCallWarning;

  const planLabel = tier.displayName;
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
          {/* Upgrade Warning Banner */}
          {showUpgradeWarning && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 flex items-start gap-2">
              <AlertTriangle className="size-4 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-300">Approaching usage limit</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  You&apos;ve used 80% or more of your{" "}
                  {showScanWarning && showToolCallWarning
                    ? "scan and tool call"
                    : showScanWarning
                      ? "scan"
                      : "tool call"}{" "}
                  allowance.{" "}
                  <Link href="/upgrade" className="text-amber-400 underline underline-offset-2">
                    Upgrade your plan
                  </Link>{" "}
                  for higher limits.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Scans</span>
              <span className="text-slate-300 font-mono">
                {scansUsed} / {formatAllowanceDisplay(scanAllowance)}
              </span>
            </div>
            {scanAllowance !== null && (
              <Progress
                value={scanPercent}
                className={cn("h-2", scanPercent >= 95 ? "[&>div]:bg-red-500" : scanPercent >= 80 ? "[&>div]:bg-amber-500" : "[&>div]:bg-blue-500")}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Tool Calls</span>
              <span className="text-slate-300 font-mono">
                {toolCallsUsed.toLocaleString()} / {formatAllowanceDisplay(toolCallAllowance)}
              </span>
            </div>
            {toolCallAllowance !== null && (
              <Progress
                value={toolCallPercent}
                className={cn("h-2", toolCallPercent >= 95 ? "[&>div]:bg-red-500" : toolCallPercent >= 80 ? "[&>div]:bg-amber-500" : "[&>div]:bg-blue-500")}
              />
            )}
          </div>

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
          <AnnualSwitchButton currentPlanId={org.plan_id!} />
        </div>
      )}

      {/* Invoice History */}
      <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-slate-200">Invoice History</CardTitle>
          <CardDescription className="text-xs text-slate-500">Past invoices for your organization</CardDescription>
        </CardHeader>
        <CardContent>
          {invoices && invoices.length > 0 ? (
            <div className="space-y-2">
              {invoices.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2 text-sm"
                >
                  <span className="text-slate-300">
                    {new Date(record.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <span className="text-slate-200 font-mono">
                    {record.total_charge_cents > 0 ? `$${(record.total_charge_cents / 100).toFixed(2)}` : "$0.00"}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px]",
                      record.status === "paid" && "border-emerald-500/30 text-emerald-400",
                      record.status === "open" && "border-amber-500/30 text-amber-400",
                    )}
                  >
                    {record.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 text-center py-4">No billing records yet</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default BillingSettingsPage;
