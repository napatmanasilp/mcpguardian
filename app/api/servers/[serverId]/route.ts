import { NextRequest } from "next/server";
import { z } from "zod";

import { err, ok, isError, requireUser, requireOrg } from "@/lib/api-helpers";

const UpdateServerSchema = z.object({
  name: z.string().min(1).max(253).optional(),
  endpointUrl: z.string().url().optional(),
  stdioCommand: z.string().min(1).optional(),
});

// PATCH /api/servers/[serverId] — update server details
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string }> },
) {
  const { serverId } = await params;

  const auth = await requireUser();
  if (isError(auth)) return auth;

  const orgCtx = await requireOrg(auth.user.userId);
  if (isError(orgCtx)) return orgCtx;

  const { org, svc } = orgCtx;

  // Verify server belongs to user's org
  const { data: server } = await svc
    .from("mcp_servers")
    .select("id, transport_type")
    .eq("id", serverId)
    .eq("organization_id", org.orgId)
    .single();

  if (!server) {
    return err("NOT_FOUND", "Server not found or access denied", 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err("INVALID_BODY", "Invalid request body", 400);
  }

  const parsed = UpdateServerSchema.safeParse(body);
  if (!parsed.success) {
    return err(
      "VALIDATION_ERROR",
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      400,
    );
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.name) updates.name = parsed.data.name;
  if (parsed.data.endpointUrl && server.transport_type === "http") {
    updates.endpoint_url = parsed.data.endpointUrl;
  }
  if (parsed.data.stdioCommand && server.transport_type === "stdio") {
    updates.stdio_command = parsed.data.stdioCommand;
  }

  const { error: updateError } = await svc
    .from("mcp_servers")
    .update(updates)
    .eq("id", serverId);

  if (updateError) {
    return err("UPDATE_FAILED", "Failed to update server", 500);
  }

  return ok({ serverId, updated: Object.keys(updates).filter((k) => k !== "updated_at") });
}

// DELETE /api/servers/[serverId] — remove a server
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ serverId: string }> },
) {
  const { serverId } = await params;

  const auth = await requireUser();
  if (isError(auth)) return auth;

  const orgCtx = await requireOrg(auth.user.userId);
  if (isError(orgCtx)) return orgCtx;

  const { org, svc } = orgCtx;

  // Verify server belongs to user's org
  const { data: server } = await svc
    .from("mcp_servers")
    .select("id")
    .eq("id", serverId)
    .eq("organization_id", org.orgId)
    .single();

  if (!server) {
    return err("NOT_FOUND", "Server not found or access denied", 404);
  }

  const { error: deleteError } = await svc
    .from("mcp_servers")
    .delete()
    .eq("id", serverId);

  if (deleteError) {
    return err("DELETE_FAILED", "Failed to delete server", 500);
  }

  return ok({ deleted: true });
}
