import { NextRequest } from "next/server";

import { err, ok, isError, requireUser, requireOrg } from "@/lib/api-helpers";

// GET /api/scans/[scanId] — full scan detail (used for polling)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ scanId: string }> },
) {
  const { scanId } = await params;

  const auth = await requireUser();
  if (isError(auth)) return auth;

  const orgCtx = await requireOrg(auth.user.userId);
  if (isError(orgCtx)) return orgCtx;

  const { org, svc } = orgCtx;

  const { data: scan, error } = await svc
    .from("scans")
    .select("*")
    .eq("id", scanId)
    .eq("organization_id", org.orgId)
    .single();

  if (error || !scan) {
    return err("NOT_FOUND", "Scan not found", 404);
  }

  return ok(scan);
}
