import { NextRequest } from "next/server";
import { z } from "zod";

import { err, ok, isError, requireUser, requireOrg } from "@/lib/api-helpers";

const CreateRuleSchema = z.object({
  name: z.string().min(1).max(100),
  triggerEvent: z.enum([
    "threat_detected", "session_terminated_threat", "rug_pull_detected",
    "scan_completed_malicious", "tool_call_blocked", "watchdog_failed",
    "scan_limit_80pct", "tool_call_limit_80pct", "overage_started",
  ]),
  severityThreshold: z.string().optional(),
  notificationChannels: z.array(z.string().uuid()).default([]),
  cooldownMinutes: z.number().int().min(1).max(1440).default(15),
});

// GET /api/alerts/rules
export async function GET() {
  const auth = await requireUser();
  if (isError(auth)) return auth;

  const orgCtx = await requireOrg(auth.user.userId);
  if (isError(orgCtx)) return orgCtx;

  const { org, svc } = orgCtx;

  const { data, error } = await svc
    .from("alert_rules")
    .select("*")
    .eq("organization_id", org.orgId)
    .order("created_at", { ascending: false });

  if (error) return err("FETCH_ERROR", "Failed to fetch alert rules", 500);

  return ok(data ?? []);
}

// POST /api/alerts/rules
export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (isError(auth)) return auth;

  const orgCtx = await requireOrg(auth.user.userId);
  if (isError(orgCtx)) return orgCtx;

  const { org, svc } = orgCtx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err("INVALID_BODY", "Invalid request body", 400);
  }

  const parsed = CreateRuleSchema.safeParse(body);
  if (!parsed.success) {
    return err("VALIDATION_ERROR", parsed.error.issues.map(i => i.message).join(", "), 400);
  }

  const { data: rule, error } = await svc
    .from("alert_rules")
    .insert({
      organization_id: org.orgId,
      name: parsed.data.name,
      trigger_event: parsed.data.triggerEvent,
      severity_threshold: parsed.data.severityThreshold ?? null,
      notification_channels: parsed.data.notificationChannels,
      cooldown_minutes: parsed.data.cooldownMinutes,
    })
    .select("id")
    .single();

  if (error) return err("INSERT_ERROR", "Failed to create alert rule", 500);

  return ok({ ruleId: rule.id }, 201);
}

// PATCH /api/alerts/rules — toggle enable/disable
export async function PATCH(request: NextRequest) {
  const auth = await requireUser();
  if (isError(auth)) return auth;

  const orgCtx = await requireOrg(auth.user.userId);
  if (isError(orgCtx)) return orgCtx;

  const { org, svc } = orgCtx;

  let body: { ruleId?: string; enabled?: boolean };
  try {
    body = await request.json();
  } catch {
    return err("INVALID_BODY", "Invalid request body", 400);
  }

  if (!body.ruleId) return err("MISSING_RULE_ID", "ruleId is required", 400);

  const { error } = await svc
    .from("alert_rules")
    .update({ enabled: body.enabled ?? true })
    .eq("id", body.ruleId)
    .eq("organization_id", org.orgId);

  if (error) return err("UPDATE_ERROR", "Failed to update alert rule", 500);

  return ok({ updated: true });
}

// DELETE /api/alerts/rules?ruleId=
export async function DELETE(request: NextRequest) {
  const auth = await requireUser();
  if (isError(auth)) return auth;

  const orgCtx = await requireOrg(auth.user.userId);
  if (isError(orgCtx)) return orgCtx;

  const { org, svc } = orgCtx;
  const ruleId = request.nextUrl.searchParams.get("ruleId");
  if (!ruleId) return err("MISSING_RULE_ID", "ruleId query parameter required", 400);

  const { error } = await svc
    .from("alert_rules")
    .delete()
    .eq("id", ruleId)
    .eq("organization_id", org.orgId);

  if (error) return err("DELETE_ERROR", "Failed to delete alert rule", 500);

  return ok({ deleted: true });
}
