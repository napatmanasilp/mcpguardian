import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { err, isError, requireOrgById } from "@/lib/api-helpers";
import {
  checkServerAllowlist,
  resolveSessionToken,
  incrementToolCallsUsed,
  incrementProxySessionToolCalls,
  checkToolCallLimit,
} from "@/lib/api-helpers";
import { inspectOutboundRequest, buildSanitizedRequest, scanToolResponse, logOutboundToolCall } from "@/lib/proxy/outbound";
import { inspectInboundResponse } from "@/lib/proxy/inbound";
import { validateOutboundToken, scanResponseForTokens, TOKEN_DETECTION_PATTERNS } from "@/lib/proxy/token-guard";
import { detectExfiltrationSequence, logToolCall, createSession } from "@/lib/proxy/session";
import { isSessionTerminated, getWatchdog } from "@/lib/monitor/session-watchdog";
import type { ProxyMode, ProxyFlag, JsonRpcRequest } from "@/lib/proxy/types";

const ProxyBodySchema = z.object({
  jsonrpc: z.literal("2.0"),
  method: z.string(),
  id: z.union([z.string(), z.number()]).optional(),
  params: z.unknown().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ serverId: string }> },
) {
  const { serverId } = await params;

  // ── Step 1: Authenticate via session token ────────────────────────
  const sessionToken = request.headers.get("Authorization")?.replace("Bearer ", "");
  if (!sessionToken) {
    return err("MISSING_AUTH", "Authorization header required", 401);
  }

  const session = await resolveSessionToken(sessionToken);
  if (!session || session.mcpServerId !== serverId) {
    return err("INVALID_SESSION", "Invalid or expired session", 401);
  }

  const { orgId, sessionId } = session;

  // ── Step 2: Resolve org context from session token ────────────────
  const orgCtx = await requireOrgById(orgId);
  if (isError(orgCtx)) return orgCtx;

  const { org, svc } = orgCtx;

  // ── Step 3: Check allowlist (block mode enforcement) ─────────────
  const allowlist = await checkServerAllowlist(orgId, serverId);
  if (allowlist.status === "blocked") {
    return err("SERVER_BLOCKED", "This server is blocked by your organization", 403);
  }
  const blockModeActive = allowlist.status !== "approved" && org.planGates.proxyGateway === true;
  const mode: ProxyMode = blockModeActive ? "block" : "monitor";

  // ── Step 4: Parse and validate JSON-RPC body ─────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err("INVALID_JSON", "Invalid JSON body", 400);
  }

  const parsed = ProxyBodySchema.safeParse(body);
  if (!parsed.success) {
    return err("INVALID_JSONRPC", "Not a valid JSON-RPC 2.0 request", 400);
  }

  const rpc = parsed.data as unknown as JsonRpcRequest;

  // ── Step 5: Kill switch check ────────────────────────────────────
  const killCheck = isSessionTerminated(sessionId);
  if (killCheck.terminated) {
    return err("SESSION_TERMINATED", killCheck.reason ?? "Session terminated by watchdog", 503);
  }

  // ── Step 6: Lookup upstream URL ──────────────────────────────────
  const { data: mcpserver } = await svc
    .from("mcp_servers")
    .select("endpoint_url, transport_type")
    .eq("id", serverId)
    .single();

  if (!mcpserver || !mcpserver.endpoint_url) {
    return err("SERVER_NOT_FOUND", "MCP server configuration not found", 404);
  }

  const upstreamUrl = mcpserver.endpoint_url;

  // ── Step 7: Check rate limit for tool calls ──────────────────────
  const { overage } = checkToolCallLimit(org);

  // ── Step 8: Outbound inspection (SSRF, injection, credential detection) ──
  const allFlags: ProxyFlag[] = [];
  const outboundFlags = inspectOutboundRequest(rpc);
  allFlags.push(...outboundFlags);

  // ── Step 9: Token guard — upstream auth is separate from proxy session token ──
  const upstreamAuth = request.headers.get("x-mcp-upstream-authorization") ?? undefined;
  const tokenResult = validateOutboundToken(upstreamAuth, upstreamUrl);
  if (!tokenResult.safe) {
    for (const f of tokenResult.findings) {
      allFlags.push({
        type: f.type,
        severity: f.severity as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
        title: `${f.type.replace(/_/g, " ")} detected`,
        description: f.detail,
        blocked: f.severity === "CRITICAL",
      });
    }
  }

  // ── Step 10: Check if blocked flags should prevent forwarding ────
  const criticalBlocked = allFlags.filter((f) => f.blocked);
  const shouldBlock = mode === "block" && criticalBlocked.length > 0;

  if (shouldBlock) {
    const firstFlag = criticalBlocked[0];
    return err("PROXY_BLOCKED", firstFlag.description, 403);
  }

  // ── Step 11: Forward to upstream (with sanitized body in block mode) ──
  const forwardedBody = mode === "block" ? buildSanitizedRequest(rpc, outboundFlags) : rpc;

  let upstreamResponse: Response;
  const startTime = Date.now();
  try {
    upstreamResponse = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(upstreamAuth ? { authorization: upstreamAuth } : {}),
      },
      body: JSON.stringify(forwardedBody),
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    return err("UPSTREAM_ERROR", "MCP server unreachable", 502);
  }

  const latencyMs = Date.now() - startTime;
  const responseData = await upstreamResponse.json();

  // ── Step 12: Increment tool call counter (tools/call only) ───────
  if (rpc.method === "tools/call") {
    await incrementToolCallsUsed(orgId);
    await incrementProxySessionToolCalls(sessionId);
  }

  // ── Step 13: Inbound inspection (response poisoning detection) ───
  if (rpc.method === "tools/call") {
    const { flags: inboundFlags, sanitizedResponse } = inspectInboundResponse(responseData);
    if (inboundFlags.length > 0) {
      allFlags.push(...inboundFlags);
      responseData.result = sanitizedResponse.result;
    }

    // ── Response content scan (PII, exfil, encoded payloads) ────────
    const serverDomain = upstreamUrl ? new URL(upstreamUrl).hostname : undefined;
    const responseScan = scanToolResponse(responseData.result, mode, serverDomain);
    if (!responseScan.clean) {
      for (const flag of responseScan.flags) {
        allFlags.push({
          type: flag.type,
          severity: flag.severity as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
          title: `${flag.type.replace(/_/g, " ")} detected`,
          description: `Matched "${flag.matchedPattern}" at position ${flag.position}`,
          blocked: flag.severity === "CRITICAL",
        });
      }
      if (mode === "block" && responseScan.sanitizedContent && responseData.result) {
        responseData.result = {
          ...responseData.result,
          content: [{ type: "text", text: responseScan.sanitizedContent }],
        };
      }
    }

    // ── Response token scan (leaked credentials) ────────────────────
    const responseTokenResult = scanResponseForTokens(
      JSON.stringify(responseData),
      upstreamAuth,
      upstreamUrl,
    );
    if (!responseTokenResult.safe) {
      for (const f of responseTokenResult.findings) {
        allFlags.push({
          type: f.type,
          severity: f.severity as "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
          title: `${f.type.replace(/_/g, " ")} detected`,
          description: f.detail,
          blocked: f.severity === "CRITICAL",
        });
      }

      // Block mode: redact matched tokens
      if (mode === "block" && responseData.result) {
        const bodyStr = JSON.stringify(responseData);
        const redacted = bodyStr
          .replace(TOKEN_DETECTION_PATTERNS.bearerHeader, "Bearer [TOKEN_REDACTED]")
          .replace(TOKEN_DETECTION_PATTERNS.githubPat, "[TOKEN_REDACTED]")
          .replace(TOKEN_DETECTION_PATTERNS.openaiKey, "[TOKEN_REDACTED]")
          .replace(TOKEN_DETECTION_PATTERNS.jwtToken, "[TOKEN_REDACTED]");
        if (redacted !== bodyStr) {
          try {
            Object.assign(responseData, JSON.parse(redacted));
          } catch {
            // If redaction corrupts JSON, keep original
          }
        }
      }
    }

    // ── Log tool call to in-memory session ──────────────────────────
    const proxySession = createSession(upstreamUrl, { mode });
    const toolArgs = (rpc.params as Record<string, unknown> | undefined)?.arguments ?? {};
    logToolCall(
      proxySession,
      (rpc.params as Record<string, string | undefined> | undefined)?.name ?? "unknown",
      toolArgs,
      responseData.result,
      allFlags,
    );

    // ── Exfiltration sequence detection ─────────────────────────────
    const exfilFlag = detectExfiltrationSequence(proxySession);
    if (exfilFlag) allFlags.push(exfilFlag);

    // ── Log to Supabase (fire-and-forget) ───────────────────────────
    logOutboundToolCall(
      rpc,
      responseData,
      allFlags,
      sessionId,
      mode,
      upstreamUrl,
      latencyMs,
    );

    // ── Register session with watchdog (fire-and-forget) ────────────
    getWatchdog()
      .registerSession(upstreamUrl, "", undefined, sessionId)
      .catch(() => {});
  }

  // ── Step 14: Record invocation log (fire-and-forget) ─────────────
  svc
    .from("tool_invocation_logs")
    .insert({
      organization_id: orgId,
      session_id: sessionId,
      mcp_server_id: serverId,
      tool_name: rpc.method,
      direction: "outbound",
      request_payload: rpc.params ?? {},
      response_payload: responseData,
      was_blocked: shouldBlock,
      threats_detected: allFlags.filter((f) => f.severity === "CRITICAL" || f.severity === "HIGH"),
      latency_ms: latencyMs,
      invoked_at: new Date().toISOString(),
      billed: overage,
    })
    .then(() => {});

  // ── Step 15: Return raw JSON-RPC (MCP clients cannot parse API envelopes) ──
  return NextResponse.json(
    {
      ...responseData,
      _mcpguardian: {
        session_id: sessionId,
        mode,
        flags_raised: allFlags.map((f) => ({
          type: f.type,
          severity: f.severity,
          title: f.title,
        })),
        latency_ms: latencyMs,
        overage_active: overage,
        token_guard: {
          outbound_safe: tokenResult.safe,
          outbound_findings: tokenResult.findings,
        },
      },
    },
    { status: upstreamResponse.status },
  );
}


