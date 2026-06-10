import { NextRequest } from "next/server";

import { err, ok, isError, requireUser, requireOrg } from "@/lib/api-helpers";
import { getOverageRate, PLAN_GATES } from "@/lib/plan-limits";

// GET /api/billing/usage — org-level billing usage with overage breakdown
export async function GET(_request: NextRequest) {
  const auth = await requireUser();
  if (isError(auth)) return auth;

  const orgCtx = await requireOrg(auth.user.userId);
  if (isError(orgCtx)) return orgCtx;

  const { org, svc } = orgCtx;

  // Fetch active addons
  const { data: addons } = await svc
    .from("addon_purchases")
    .select("addon_type, quantity, unit_price_cents, status, purchased_at, expires_at")
    .eq("organization_id", org.orgId)
    .eq("status", "active");

  // Fetch latest usage billing record
  const { data: billingRecord } = await svc
    .from("usage_billing_records")
    .select("*")
    .eq("organization_id", org.orgId)
    .order("billing_period_start", { ascending: false })
    .limit(1)
    .single();

  const planGates = PLAN_GATES[org.planId as keyof typeof PLAN_GATES] ?? PLAN_GATES.free;
  const totalIncluded = planGates.checksPerMonth === -1 ? Infinity : planGates.checksPerMonth;
  const scanOverage = totalIncluded === Infinity ? 0 : Math.max(0, org.scansUsed - totalIncluded);
  const toolCallOverage = totalIncluded === Infinity ? 0 : Math.max(0, org.toolCallsUsed - totalIncluded);
  const overageRate = getOverageRate(org.planId);

  return ok({
    plan: org.planId,
    billingPeriod: {
      start: org.currentPeriodStart,
      end: org.currentPeriodEnd,
    },
    usage: {
      scansUsed: org.scansUsed,
      toolCallsUsed: org.toolCallsUsed,
      scansIncluded: totalIncluded,
    },
    overage: {
      scans: scanOverage,
      toolCalls: toolCallOverage,
      ratePerUnit: overageRate,
      estimatedCost: (scanOverage + toolCallOverage) * overageRate,
    },
    addons: (addons ?? []).map((a) => ({
      type: a.addon_type,
      quantity: a.quantity,
      unitPriceCents: a.unit_price_cents,
      status: a.status,
      purchasedAt: a.purchased_at,
      expiresAt: a.expires_at,
    })),
    billingRecord: billingRecord
      ? {
          periodStart: billingRecord.billing_period_start,
          periodEnd: billingRecord.billing_period_end,
          scanOverages: billingRecord.scan_overages,
          toolCallOverages: billingRecord.tool_call_overages,
          totalChargeCents: billingRecord.total_charge_cents,
          status: billingRecord.status,
        }
      : null,
  });
}
