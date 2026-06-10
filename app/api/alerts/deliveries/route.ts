import { NextRequest } from "next/server";

import { err, ok, isError, requireUser, requireOrg } from "@/lib/api-helpers";

// GET /api/alerts/deliveries — list alert delivery attempts
// Supports: ?status=&ruleId=&channelId=&limit=&cursor=
export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if (isError(auth)) return auth;

  const orgCtx = await requireOrg(auth.user.userId);
  if (isError(orgCtx)) return orgCtx;

  const { org, svc } = orgCtx;
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const ruleId = url.searchParams.get("ruleId");
  const channelId = url.searchParams.get("channelId");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
  const cursor = url.searchParams.get("cursor");

  let query = svc
    .from("alert_deliveries")
    .select("id, alert_rule_id, channel_id, event_type, status, attempts, last_error, delivered_at, created_at")
    .eq("organization_id", org.orgId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) query = query.eq("status", status);
  if (ruleId) query = query.eq("alert_rule_id", ruleId);
  if (channelId) query = query.eq("channel_id", channelId);
  if (cursor) query = query.lt("created_at", cursor);

  const { data, error } = await query;
  if (error) return err("FETCH_ERROR", "Failed to fetch alert deliveries", 500);

  const nextCursor = data && data.length === limit ? data[data.length - 1].created_at : null;

  return ok({ deliveries: data ?? [], nextCursor });
}
