import { NextRequest } from "next/server";

import { err, ok, isError, requireUser, requireOrg } from "@/lib/api-helpers";

// GET /api/compliance/reports — list saved compliance report exports
// Supports: ?type=&limit=&cursor=
export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if (isError(auth)) return auth;

  const orgCtx = await requireOrg(auth.user.userId, "complianceExport");
  if (isError(orgCtx)) return orgCtx;

  const { org, svc } = orgCtx;
  const url = new URL(request.url);
  const reportType = url.searchParams.get("type");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
  const cursor = url.searchParams.get("cursor");

  let query = svc
    .from("compliance_report_exports")
    .select("id, report_type, storage_path, download_url, is_paid_addon, generated_at, expires_at")
    .eq("organization_id", org.orgId)
    .order("generated_at", { ascending: false })
    .limit(limit);

  if (reportType) query = query.eq("report_type", reportType);
  if (cursor) query = query.lt("generated_at", cursor);

  const { data, error } = await query;
  if (error) return err("FETCH_ERROR", "Failed to fetch compliance reports", 500);

  const nextCursor = data && data.length === limit ? data[data.length - 1].generated_at : null;

  return ok({ reports: data ?? [], nextCursor });
}
