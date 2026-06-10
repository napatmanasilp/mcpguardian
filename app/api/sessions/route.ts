import { NextRequest } from "next/server";
import { z } from "zod";

import { err, ok, isError, requireUser, requireOrg } from "@/lib/api-helpers";

const CreateSessionSchema = z.object({
  mcpServerId: z.string().uuid(),
  agentIdentifier: z.string().optional(),
});

// GET /api/sessions?serverId=&status=&limit=&cursor=
export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if (isError(auth)) return auth;

  const orgCtx = await requireOrg(auth.user.userId);
  if (isError(orgCtx)) return orgCtx;

  const { org, svc } = orgCtx;
  const url = new URL(request.url);
  const serverId = url.searchParams.get("serverId");
  const status = url.searchParams.get("status");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
  const cursor = url.searchParams.get("cursor");

  let query = svc
    .from("proxy_sessions")
    .select("id, mcp_server_id, agent_identifier, status, block_mode_active, watchdog_enabled, tool_call_count, threat_count, blocked_count, started_at, ended_at")
    .eq("organization_id", org.orgId)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (serverId) query = query.eq("mcp_server_id", serverId);
  if (status) query = query.eq("status", status);
  if (cursor) query = query.lt("started_at", cursor);

  const { data, error } = await query;
  if (error) return err("FETCH_ERROR", "Failed to fetch sessions", 500);

  return ok({
    sessions: data ?? [],
    nextCursor: data && data.length === limit ? data[data.length - 1].started_at : null,
  });
}

// POST /api/sessions — create new proxy session
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

  const parsed = CreateSessionSchema.safeParse(body);
  if (!parsed.success) {
    return err("VALIDATION_ERROR", parsed.error.issues.map(i => i.message).join(", "), 400);
  }

  const { mcpServerId, agentIdentifier } = parsed.data;

  // Verify the MCP server belongs to this org
  const { data: server } = await svc
    .from("mcp_servers")
    .select("id")
    .eq("id", mcpServerId)
    .eq("organization_id", org.orgId)
    .single();

  if (!server) return err("SERVER_NOT_FOUND", "MCP server not found in your organization", 404);

  // Enable block mode for Team+ plans, watchdog for all paid plans
  const blockModeActive = org.planGates.proxyGateway === true;
  const watchdogEnabled = org.planId !== "free" && org.subscriptionStatus === "active";

  const { data: session, error: insertError } = await svc
    .from("proxy_sessions")
    .insert({
      organization_id: org.orgId,
      mcp_server_id: mcpServerId,
      agent_identifier: agentIdentifier ?? null,
      status: "active",
      block_mode_active: blockModeActive,
      watchdog_enabled: watchdogEnabled,
      tool_call_count: 0,
      threat_count: 0,
      blocked_count: 0,
      permission_set: {},
      watchdog_next_verify_at: watchdogEnabled
        ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
        : null,
    })
    .select("id, session_token")
    .single();

  if (insertError) return err("INSERT_ERROR", "Failed to create session", 500);

  return ok({
    sessionId: session.id,
    sessionToken: session.session_token,
    blockModeActive,
    watchdogEnabled,
  }, 201);
}
