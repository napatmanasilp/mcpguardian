import { NextRequest } from "next/server";

import { err, ok, isError, requireUser, requireOrg } from "@/lib/api-helpers";

// GET /api/sessions/[sessionId] — get session detail
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;

  const auth = await requireUser();
  if (isError(auth)) return auth;

  const orgCtx = await requireOrg(auth.user.userId);
  if (isError(orgCtx)) return orgCtx;

  const { org, svc } = orgCtx;

  const { data: session, error } = await svc
    .from("proxy_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("organization_id", org.orgId)
    .single();

  if (error || !session) return err("NOT_FOUND", "Session not found", 404);

  return ok(session);
}

// DELETE /api/sessions/[sessionId] — terminate session
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const reason = request.nextUrl.searchParams.get("reason") || "Manually terminated";

  const auth = await requireUser();
  if (isError(auth)) return auth;

  const orgCtx = await requireOrg(auth.user.userId);
  if (isError(orgCtx)) return orgCtx;

  const { org, svc } = orgCtx;

  const { error } = await svc
    .from("proxy_sessions")
    .update({
      status: "terminated_clean",
      ended_at: new Date().toISOString(),
      termination_reason: reason,
    })
    .eq("id", sessionId)
    .eq("organization_id", org.orgId);

  if (error) return err("UPDATE_ERROR", "Failed to terminate session", 500);

  return ok({ terminated: true, reason });
}
