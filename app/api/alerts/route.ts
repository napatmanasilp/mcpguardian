import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { err, ok, isError, requireUser, requireOrg } from "@/lib/api-helpers";

const BulkActionSchema = z.object({
  action: z.literal("mark-all-read"),
});

// GET /api/alerts — list alerts for the authenticated user's org
export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if (isError(auth)) return auth;

  const orgCtx = await requireOrg(auth.user.userId);
  if (isError(orgCtx)) return orgCtx;

  const { org, svc } = orgCtx;
  const url = new URL(request.url);
  const severity = url.searchParams.get("severity");
  const unreadOnly = url.searchParams.get("unread") === "true";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);

  let query = svc
    .from("alerts")
    .select("id, alert_type, severity, title, message, read, session_id, server_id, created_at")
    .eq("organization_id", org.orgId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (severity) query = query.eq("severity", severity);
  if (unreadOnly) query = query.eq("read", false);

  const { data, error } = await query;
  if (error) return err("FETCH_ERROR", "Failed to fetch alerts", 500);

  return ok({ alerts: data ?? [] });
}

// PATCH /api/alerts?id=<uuid> — mark a single alert as read
export async function PATCH(request: NextRequest) {
  const auth = await requireUser();
  if (isError(auth)) return auth;

  const orgCtx = await requireOrg(auth.user.userId);
  if (isError(orgCtx)) return orgCtx;

  const { org, svc } = orgCtx;
  const { searchParams } = new URL(request.url);
  const alertId = searchParams.get("id");

  if (!alertId) {
    return err("MISSING_ID", "Alert id is required", 400);
  }

  const { error } = await svc
    .from("alerts")
    .update({ read: true })
    .eq("id", alertId)
    .eq("organization_id", org.orgId);

  if (error) {
    return err("UPDATE_FAILED", "Failed to update alert", 500);
  }

  return ok({ success: true });
}

// POST /api/alerts — bulk actions (mark-all-read)
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

  const parsed = BulkActionSchema.safeParse(body);
  if (!parsed.success) {
    return err("INVALID_ACTION", "Invalid action", 400);
  }

  const { data, error } = await svc
    .from("alerts")
    .update({ read: true })
    .eq("organization_id", org.orgId)
    .eq("read", false)
    .select("id");

  if (error) {
    return err("UPDATE_FAILED", "Failed to update alerts", 500);
  }

  return ok({ updated: data?.length ?? 0 });
}
