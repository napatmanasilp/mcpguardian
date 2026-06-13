import { NextRequest } from "next/server";

import { err, ok, isError, requireUser, requireOrg } from "@/lib/api-helpers";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ alertId: string }> },
) {
  const auth = await requireUser();
  if (isError(auth)) return auth;

  const orgCtx = await requireOrg(auth.user.userId);
  if (isError(orgCtx)) return orgCtx;

  const { org, svc } = orgCtx;
  const { alertId } = await params;

  // Update the alert only if it belongs to this organization
  const { data, error } = await svc
    .from("alerts")
    .update({ read: true })
    .eq("id", alertId)
    .eq("organization_id", org.orgId)
    .select("id")
    .single();

  if (error || !data) {
    return err("NOT_FOUND", "Alert not found", 404);
  }

  return ok({ ok: true });
}
