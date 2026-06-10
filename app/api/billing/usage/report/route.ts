import { NextRequest } from "next/server";

import { err, ok, isError, requireUser, requireOrg } from "@/lib/api-helpers";
import { getOverageRate, PLAN_GATES } from "@/lib/plan-limits";

// POST /api/billing/usage/report — record usage billing snapshot for the period
// Called internally by cron or post-check to generate usage records
export async function POST(request: NextRequest) {
  const auth = await request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return err("UNAUTHORIZED", "Invalid or missing cron secret", 401);
  }

  let body: { organization_id?: string };
  try {
    body = await request.json();
  } catch {
    return err("INVALID_BODY", "Invalid request body", 400);
  }

  if (!body.organization_id) {
    return err("VALIDATION_ERROR", "organization_id is required", 400);
  }

  const { org, svc } = await getOrgAndSvc(body.organization_id);
  if (!org) return err("ORG_NOT_FOUND", "Organization not found", 404);

  // Build a usage billing record snapshot
  const planGates = PLAN_GATES[org.plan_id as keyof typeof PLAN_GATES] ?? PLAN_GATES.free;
  const includedScans = planGates.checksPerMonth === -1 ? Infinity : planGates.checksPerMonth;
  const includedToolCalls = planGates.checksPerMonth === -1 ? Infinity : planGates.checksPerMonth;

  const scansUsed = org.scans_used_this_period ?? 0;
  const toolCallsUsed = org.tool_calls_used_this_period ?? 0;

  const scanOverage = includedScans === Infinity ? 0 : Math.max(0, scansUsed - includedScans);
  const toolCallOverage = includedToolCalls === Infinity ? 0 : Math.max(0, toolCallsUsed - includedToolCalls);
  const overageRate = getOverageRate(org.plan_id);

  const scanOverageChargeCents = Math.round(scanOverage * overageRate * 100);
  const toolCallOverageChargeCents = Math.round(toolCallOverage * overageRate * 100);

  const { data: record, error } = await svc
    .from("usage_billing_records")
    .insert({
      organization_id: body.organization_id,
      billing_period_start: org.current_period_start ?? new Date().toISOString(),
      billing_period_end: org.current_period_end ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      plan_id: org.plan_id ?? "free",
      base_scans_included: includedScans === Infinity ? -1 : includedScans,
      base_tool_calls_included: includedToolCalls === Infinity ? -1 : includedToolCalls,
      scans_used: scansUsed,
      tool_calls_used: toolCallsUsed,
      scan_overages: scanOverage,
      tool_call_overages: toolCallOverage,
      scan_overage_charge_cents: scanOverageChargeCents,
      tool_call_overage_charge_cents: toolCallOverageChargeCents,
      total_charge_cents: scanOverageChargeCents + toolCallOverageChargeCents,
      status: "open",
    })
    .select("id")
    .single();

  if (error) return err("INSERT_ERROR", "Failed to create billing record", 500);

  return ok({
    recordId: record.id,
    scansUsed,
    toolCallsUsed,
    scanOverage,
    toolCallOverage,
    totalChargeCents: scanOverageChargeCents + toolCallOverageChargeCents,
    status: "open",
  });
}

async function getOrgAndSvc(orgId: string) {
  const { createServiceClient } = await import("@/lib/supabase/service");
  const svc = createServiceClient();
  const { data: org } = await svc.from("organizations").select("*").eq("id", orgId).single();
  return { org, svc };
}
