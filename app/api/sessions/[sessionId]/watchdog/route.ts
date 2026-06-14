import { NextRequest } from "next/server";

import { createHash } from "crypto";

import { err, ok } from "@/lib/api-helpers";
import { createServiceClient } from "@/lib/supabase/service";

// ─── Helpers ──────────────────────────────────────────────────────────

async function terminateSession(
  svc: ReturnType<typeof createServiceClient>,
  sessionId: string,
  organizationId: string,
  reason: string,
  reasonType: "upstream_unreachable" | "tools_hash_mismatch" | "probe_failed",
): Promise<void> {
  const statusMap = {
    upstream_unreachable: "terminated_threat",
    tools_hash_mismatch: "terminated_rug_pull",
    probe_failed: "terminated_threat",
  };

  await svc
    .from("proxy_sessions")
    .update({
      status: statusMap[reasonType],
      ended_at: new Date().toISOString(),
      termination_reason: reason,
    })
    .eq("id", sessionId);

  // Fire-and-forget: insert alert
  svc
    .from("alerts")
    .insert({
      organization_id: organizationId,
      alert_type:
        reasonType === "tools_hash_mismatch"
          ? "RUG_PULL_DETECTED"
          : "WATCHDOG_FAILED",
      severity:
        reasonType === "tools_hash_mismatch" ? "CRITICAL" : "HIGH",
      title:
        reasonType === "tools_hash_mismatch"
          ? "Rug-pull detected — session terminated"
          : "Watchdog verification failed — session terminated",
      message: reason,
      session_id: sessionId,
      metadata: { issue_key: `watchdog_${sessionId}` },
    })
    .then(() => {});
}

function hashToolsList(
  tools: Array<{ name?: string; description?: string; inputSchema?: unknown }>,
): string {
  const sorted = [...tools]
    .filter((t) => t.name)
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  const concatenated = sorted
    .map((t) => `${t.name}|${t.description || ""}|${JSON.stringify(t.inputSchema || {})}`)
    .join("||");
  return createHash("sha256").update(concatenated, "utf-8").digest("hex");
}

// POST /api/sessions/[sessionId]/watchdog — re-verify server
// Spec: If verification fails (unreachable, tools changed) → terminate session + trigger alert
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;

  // Auth: cron secret or admin user
  const svc = createServiceClient();

  // Fetch session
  const { data: session } = await svc
    .from("proxy_sessions")
    .select("id, mcp_server_id, organization_id, watchdog_enabled, status")
    .eq("id", sessionId)
    .single();

  if (!session) return err("NOT_FOUND", "Session not found", 404);
  if (!session.watchdog_enabled)
    return err("WATCHDOG_DISABLED", "Watchdog not enabled for this session", 400);
  if (session.status !== "active")
    return err("SESSION_NOT_ACTIVE", "Session is not active", 400);

  // Fetch MCP server config + latest scan snapshot for tool hash comparison
  const { data: server } = await svc
    .from("mcp_servers")
    .select("endpoint_url, last_scan_id")
    .eq("id", session.mcp_server_id)
    .single();

  if (!server || !server.endpoint_url) {
    await terminateSession(
      svc,
      sessionId,
      session.organization_id,
      "MCP server configuration not found — terminating session",
      "probe_failed",
    );
    return err("SERVER_NOT_FOUND", "MCP server config not found — session terminated", 404);
  }

  // Fetch the latest scan result to get the expected tool hash
  const { data: latestScan } = server.last_scan_id
    ? await svc.from("scans").select("results").eq("id", server.last_scan_id).single()
    : { data: null };

  // Probe the server for current tools
  let toolsResponse: Response;
  try {
    toolsResponse = await fetch(server.endpoint_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/list",
        id: "watchdog-" + Date.now(),
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    // Server unreachable — terminate per spec
    await terminateSession(
      svc,
      sessionId,
      session.organization_id,
      "MCP server unreachable during watchdog verification — terminating session",
      "upstream_unreachable",
    );

    return ok({
      verified: false,
      reason: "upstream_unreachable",
      session_terminated: true,
    });
  }

  const toolsData = (await toolsResponse.json()) as {
    result?: { tools?: Array<{ name?: string; description?: string; inputSchema?: unknown }> };
  };
  const currentTools = toolsData.result?.tools ?? [];

  // Compare tool hash against the stored snapshot if available
  let hashMismatch = false;
  if (latestScan?.results) {
    try {
      const scanResults =
        typeof latestScan.results === "string"
          ? JSON.parse(latestScan.results)
          : latestScan.results;

      const expectedToolsHash =
        scanResults.servers?.[0]?.toolsHash ?? null;

      if (expectedToolsHash && currentTools.length > 0) {
        const currentHash = hashToolsList(currentTools);
        hashMismatch = currentHash !== expectedToolsHash;
      }
    } catch {
      // If parsing fails, continue without hash comparison
    }
  }

  if (hashMismatch) {
    await terminateSession(
      svc,
      sessionId,
      session.organization_id,
      "Tool definitions changed since last scan — possible rug-pull or server compromise. Session terminated.",
      "tools_hash_mismatch",
    );

    return ok({
      verified: false,
      reason: "tools_hash_mismatch",
      session_terminated: true,
    });
  }

  // Mark last verified time
  await svc
    .from("proxy_sessions")
    .update({
      watchdog_last_verified_at: new Date().toISOString(),
      watchdog_next_verify_at: new Date(
        Date.now() + 15 * 60 * 1000,
      ).toISOString(),
    })
    .eq("id", sessionId);

  return ok({ verified: true, sessionId });
}
