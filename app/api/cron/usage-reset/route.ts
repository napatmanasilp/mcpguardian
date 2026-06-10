// SECTION 4.4 — Usage Reset Cron
// Schedule: daily (vercel.json) — fallback for Polar webhook subscription.updated
//
// For each org whose current_period_end < NOW():
//   1. Create usage_billing_records entry for the completed period
//   2. Calculate overages and report to Polar metered billing
//      via reportPolarUsage() helper (lib/polar-checkout.ts)
//   3. Reset organizations.scans_used_this_period = 0
//   4. Reset organizations.tool_calls_used_this_period = 0
//   5. Update current_period_start, current_period_end from Polar subscription data
//
// Note: Polar sends subscription.updated when a billing period renews.
//       Use that event as the primary reset trigger.
//       This daily cron catches any orgs the webhook missed.

import { NextRequest, NextResponse } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";
import { reportPolarUsage } from "@/lib/polar-checkout";
import { getOverageRate, PLAN_GATES } from "@/lib/plan-limits";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const svc = createServiceClient();
  const now = new Date().toISOString();
  let orgsReset = 0;
  let billingRecordsCreated = 0;
  let overageReported = 0;
  let errors = 0;

  // Find orgs whose billing period has ended
  const { data: orgs } = await svc
    .from("organizations")
    .select("id, plan_id, subscription_status, polar_subscription_id, polar_customer_id, current_period_start, current_period_end, scans_used_this_period, tool_calls_used_this_period")
    .lt("current_period_end", now)
    .neq("plan_id", "free") // Free plan has no billing period
    .neq("subscription_status", "canceled");

  if (!orgs || orgs.length === 0) {
    return NextResponse.json({
      success: true,
      orgsReset: 0,
      billingRecordsCreated: 0,
      overageReported: 0,
      errors: 0,
    });
  }

  for (const org of orgs) {
    try {
      const planId = org.plan_id ?? "free";
      const planGates = PLAN_GATES[planId as keyof typeof PLAN_GATES] ?? PLAN_GATES.free;
      const includedScans = planGates.checksPerMonth === -1 ? Infinity : planGates.checksPerMonth;
      const includedToolCalls = planGates.checksPerMonth === -1 ? Infinity : planGates.checksPerMonth;

      const scansUsed = org.scans_used_this_period ?? 0;
      const toolCallsUsed = org.tool_calls_used_this_period ?? 0;

      const scanOverage = includedScans === Infinity ? 0 : Math.max(0, scansUsed - includedScans);
      const toolCallOverage = includedToolCalls === Infinity ? 0 : Math.max(0, toolCallsUsed - includedToolCalls);
      const overageRate = getOverageRate(planId);

      const scanOverageChargeCents = Math.round(scanOverage * overageRate * 100);
      const toolCallOverageChargeCents = Math.round(toolCallOverage * overageRate * 100);
      const totalChargeCents = scanOverageChargeCents + toolCallOverageChargeCents;

      // 1. Create usage_billing_records entry for the completed period
      const { data: billingRecord } = await svc
        .from("usage_billing_records")
        .insert({
          organization_id: org.id,
          billing_period_start: org.current_period_start ?? now,
          billing_period_end: org.current_period_end ?? now,
          plan_id: planId,
          base_scans_included: includedScans === Infinity ? -1 : includedScans,
          base_tool_calls_included: includedToolCalls === Infinity ? -1 : includedToolCalls,
          scans_used: scansUsed,
          tool_calls_used: toolCallsUsed,
          scan_overages: scanOverage,
          tool_call_overages: toolCallOverage,
          scan_overage_charge_cents: scanOverageChargeCents,
          tool_call_overage_charge_cents: toolCallOverageChargeCents,
          total_charge_cents: totalChargeCents,
          status: "open",
        })
        .select("id")
        .single();

      if (billingRecord) billingRecordsCreated++;

      // 2. Report overage to Polar if enabled
      if (totalChargeCents > 0 && org.polar_subscription_id) {
        try {
          await reportPolarUsage({
            subscriptionId: org.polar_subscription_id,
            meterId: `meter_${planId}_scans`,
            quantity: scanOverage + toolCallOverage,
            timestamp: new Date(),
          });
          overageReported++;
        } catch {
          // Overage reporting is best-effort
        }
      }

      // 3. Compute new billing period dates (30 days from previous end, or default)
      const prevEnd = org.current_period_end ? new Date(org.current_period_end) : new Date();
      const newStart = new Date(prevEnd);
      const newEnd = new Date(prevEnd.getTime() + 30 * 24 * 60 * 60 * 1000);

      // 4-5. Reset counters and update period
      await svc
        .from("organizations")
        .update({
          scans_used_this_period: 0,
          tool_calls_used_this_period: 0,
          current_period_start: newStart.toISOString(),
          current_period_end: newEnd.toISOString(),
          updated_at: now,
        })
        .eq("id", org.id);

      orgsReset++;

      console.log(
        `[usage-reset-cron] Reset org ${org.id} (${planId}): ` +
          `scans=${scansUsed} overage=${scanOverage} tool_calls=${toolCallsUsed} ` +
          `charge=${totalChargeCents}c`,
      );
    } catch {
      errors++;
    }
  }

  console.log(
    `[usage-reset-cron] orgs=${orgsReset} billing=${billingRecordsCreated} overage=${overageReported} errors=${errors}`,
  );

  return NextResponse.json({
    success: true,
    orgsReset,
    billingRecordsCreated,
    overageReported,
    errors,
  });
}
