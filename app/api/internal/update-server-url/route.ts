import { NextRequest } from "next/server";

import { err, ok, isError, requireUser } from "@/lib/api-helpers";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/internal/update-server-url
 * Quick admin endpoint to update a server's endpoint_url.
 * Body: { serverId, endpointUrl }
 */
export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (isError(auth)) return auth;

  const svc = createServiceClient();

  let body: { serverId?: string; endpointUrl?: string };
  try {
    body = await request.json();
  } catch {
    return err("INVALID_BODY", "Invalid request body", 400);
  }

  const { serverId, endpointUrl } = body;
  if (!serverId || !endpointUrl) {
    return err("MISSING_PARAMS", "serverId and endpointUrl are required", 400);
  }

  // Verify user owns this server
  const { data: membership } = await svc
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", auth.user.userId)
    .eq("invitation_status", "accepted")
    .limit(1)
    .maybeSingle();

  if (!membership) {
    return err("NO_ORG", "No organization found", 403);
  }

  const { data: server, error: serverError } = await svc
    .from("mcp_servers")
    .update({ endpoint_url: endpointUrl })
    .eq("id", serverId)
    .eq("organization_id", membership.organization_id)
    .select("id, name, endpoint_url")
    .single();

  if (serverError || !server) {
    return err("UPDATE_FAILED", serverError?.message ?? "Server not found", 404);
  }

  return ok({ server });
}
