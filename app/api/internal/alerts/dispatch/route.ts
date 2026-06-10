import { NextRequest } from "next/server";

import { err, ok } from "@/lib/api-helpers";
import { createServiceClient } from "@/lib/supabase/service";

const VALID_EVENTS = [
  "threat_detected", "session_terminated_threat", "rug_pull_detected",
  "scan_completed_malicious", "tool_call_blocked", "watchdog_failed",
  "scan_limit_80pct", "tool_call_limit_80pct", "overage_started",
] as const;

// POST /api/internal/alerts/dispatch — internal: match rules, dispatch via channels
// Body: { organization_id, event_type, severity, title, message }
// Protected by CRON_SECRET or service role (internal use only)
export async function POST(request: NextRequest) {
  // Auth: cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return err("UNAUTHORIZED", "Invalid or missing cron secret", 401);
  }

  let body: {
    organization_id: string;
    event_type: string;
    severity?: string;
    title?: string;
    message?: string;
  };
  try {
    body = await request.json();
  } catch {
    return err("INVALID_BODY", "Invalid request body", 400);
  }

  if (!body.organization_id || !body.event_type) {
    return err("VALIDATION_ERROR", "organization_id and event_type are required", 400);
  }

  if (!VALID_EVENTS.includes(body.event_type as typeof VALID_EVENTS[number])) {
    return err("INVALID_EVENT", `Invalid event type. Must be one of: ${VALID_EVENTS.join(", ")}`, 400);
  }

  const svc = createServiceClient();
  const { org } = await getOrgContext(svc, body.organization_id);
  if (!org) return err("ORG_NOT_FOUND", "Organization not found", 404);

  // Find matching alert rules
  const { data: rules } = await svc
    .from("alert_rules")
    .select("id, name, trigger_event, severity_threshold, notification_channels, cooldown_minutes")
    .eq("organization_id", body.organization_id)
    .eq("enabled", true);

  if (!rules || rules.length === 0) {
    return ok({ dispatched: false, reason: "No matching alert rules configured" });
  }

  const matchedRules = rules.filter((rule) => {
    if (rule.trigger_event !== body.event_type) return false;
    if (rule.severity_threshold && body.severity) {
      const severityOrder = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
      const ruleIdx = severityOrder.indexOf(rule.severity_threshold);
      const eventIdx = severityOrder.indexOf(body.severity);
      if (eventIdx < ruleIdx) return false;
    }
    return true;
  });

  if (matchedRules.length === 0) {
    return ok({ dispatched: false, reason: "No rules matched the event/severity" });
  }

  // Create delivery records and dispatch
  const deliveries: Array<{ ruleId: string; channelId: string; status: string }> = [];

  for (const rule of matchedRules) {
    const channels = (rule.notification_channels as string[]) ?? [];

    for (const channelId of channels) {
      // Fetch channel config
      const { data: channel } = await svc
        .from("alert_channels")
        .select("id, type, config, verified")
        .eq("id", channelId)
        .eq("organization_id", body.organization_id)
        .single();

      if (!channel || !channel.verified) continue;

      // Create delivery record
      const { data: delivery } = await svc
        .from("alert_deliveries")
        .insert({
          organization_id: body.organization_id,
          alert_rule_id: rule.id,
          channel_id: channel.id,
          event_type: body.event_type,
          payload: {
            event_type: body.event_type,
            severity: body.severity ?? "MEDIUM",
            title: body.title ?? `Alert: ${body.event_type}`,
            message: body.message ?? "",
            rule_name: rule.name,
            triggered_at: new Date().toISOString(),
          },
          status: "delivered",
          attempts: 1,
          delivered_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      // Attempt to dispatch (fire-and-forget for webhooks)
      if (channel.type === "webhook" || channel.type === "slack_webhook") {
        const webhookUrl = (channel.config as Record<string, string>)?.url;
        if (webhookUrl) {
          fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              event: body.event_type,
              severity: body.severity ?? "MEDIUM",
              title: body.title ?? `Alert: ${body.event_type}`,
              message: body.message ?? "",
              rule: rule.name,
              timestamp: new Date().toISOString(),
            }),
          }).catch(() => {});
        }
      }

      deliveries.push({
        ruleId: rule.id,
        channelId: channel.id,
        status: "delivered",
      });

      // Update channel last_used_at
      await svc.from("alert_channels").update({ last_used_at: new Date().toISOString() }).eq("id", channel.id);
    }
  }

  return ok({
    dispatched: deliveries.length > 0,
    rules_matched: matchedRules.length,
    deliveries,
  });
}

async function getOrgContext(svc: ReturnType<typeof createServiceClient>, orgId: string) {
  const { data: org } = await svc
    .from("organizations")
    .select("id, plan_id, subscription_status")
    .eq("id", orgId)
    .single();

  return { org, svc };
}
