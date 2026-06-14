import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { scanMcpConfig } from "@/lib/scanner";
import type { McpServerInput } from "@/lib/scanner/types";
import { loadVulnerabilities } from "@/lib/scanner/cve-loader";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { computeConfigHash, computeToolDiff, generateRugPullIssue } from "@/lib/scanner/rug-pull";
import { validateApiKey, rateLimitResponse } from "@/lib/api-key-auth";
import { recordCheck } from "@/lib/check-counter";
import { buildAgentDirective } from "@/lib/scanner/report-builder";
import { generateRemediation } from "@/lib/scanner/remediation";
import { checkAllowlist, submitForApproval } from "@/lib/registry/allowlist-manager";

const requestTimestamps = new Map<string, number[]>();

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

const ConfigSchema = z.object({
  config: z.string().min(2, "Config must be at least 2 characters").max(102400, "Config too large"),
});

export const POST = async (request: NextRequest) => {
  // ── API key auth (takes priority over session auth) ────────────────
  let userId: string;
  let apiKeyId: string | null = null;

  const apiKeyResult = await validateApiKey(request);

  if (apiKeyResult) {
    userId = apiKeyResult.userId;
    apiKeyId = apiKeyResult.apiKeyId;

    // Parse servers from config to count checks
    let configObj: Record<string, unknown> = {};
    try {
      const body = await request.clone().json();
      configObj = body.config?.mcpServers ?? {};
    } catch {}

    // Count 1 check per server per 24h
    const servers = Object.values(configObj) as Array<{
      url?: string;
      command?: string;
      args?: string[];
    }>;

    let blocked = false;
    for (const server of servers) {
      const result = await recordCheck(apiKeyId, userId, server, "daily_rescan");
      if (result.blocked) {
        blocked = true;
        return rateLimitResponse(
          apiKeyResult.plan,
          result.checksUsed,
          result.checksLimit,
          result.checksPurchased,
          result.resetDate,
        );
      }
    }
  } else {
    // Fall back to Supabase session auth
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    userId = user.id;
  }

  // ── Rate limiting ─────────────────────────────────────────────────
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const now = Date.now();
    const timestamps = requestTimestamps.get(ip) || [];
    const recentTimestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

    if (recentTimestamps.length >= RATE_LIMIT_MAX) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a minute." },
        { status: 429 },
      );
    }

    requestTimestamps.set(ip, [...recentTimestamps, now]);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Please provide a valid MCP configuration JSON string." },
        { status: 400 },
      );
    }

    const parsed = ConfigSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please provide a valid MCP configuration JSON string." },
        { status: 400 },
      );
    }

    const { config } = parsed.data;

    // Parse the mcpServers from config for remediation engine
    let mcpServers: Record<string, McpServerInput> = {};
    try {
      const configObj = JSON.parse(config);
      mcpServers = configObj.mcpServers ?? {};
    } catch {
      // Will fail later in scanMcpConfig if truly invalid
    }

    const vulnerabilities = await loadVulnerabilities();

    let scanResult;
    try {
      scanResult = await scanMcpConfig(config, vulnerabilities);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Invalid configuration" },
        { status: 400 },
      );
    }

    const configHash = await computeConfigHash(config);
    const svc = createServiceClient();

    for (const server of scanResult.servers) {
      if (!server.toolsHash || !server.serverUrl) continue;
      const { data: snapshot } = await svc
        .from("tool_definition_snapshots")
        .select("*")
        .eq("config_hash", configHash)
        .eq("server_url", server.serverUrl)
        .maybeSingle();

      if (snapshot) {
        if (snapshot.tools_hash !== server.toolsHash) {
          const priorTools = snapshot.tools_snapshot as unknown[];
          const diff = computeToolDiff(priorTools, server.rawTools ?? []);
          const issue = generateRugPullIssue(server.serverUrl, diff, snapshot.tools_hash, server.toolsHash);
          server.issues.push(issue);
          const totalDeduction = server.issues.reduce((sum: number, i) => sum + i.deduction, 0);
          server.score = Math.max(0, 100 - totalDeduction);
        }
        await svc.from("tool_definition_snapshots").update({
          tools_hash: server.toolsHash,
          tools_snapshot: server.rawTools ?? [],
          last_seen_at: new Date().toISOString(),
          change_count: snapshot.change_count + (snapshot.tools_hash !== server.toolsHash ? 1 : 0),
        }).eq("id", snapshot.id);
      } else {
        await svc.from("tool_definition_snapshots").insert({
          config_hash: configHash,
          server_url: server.serverUrl,
          tools_hash: server.toolsHash,
          tools_snapshot: server.rawTools ?? [],
          first_seen_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
          change_count: 0,
        });
      }
    }

    const orgId = request.nextUrl.searchParams.get('organization_id');
    const agentDirective = buildAgentDirective(scanResult);

    // ── Generate remediation (corrected config + predicted score) ─────
    const remediation = generateRemediation(
      mcpServers as Record<string, McpServerInput>,
      scanResult,
    );

    // ── Allowlist check for each server ──────────────────────────────
    // Run BEFORE saving to DB so the stored scan includes allowlist findings
    const allowlistStatuses: Record<string, unknown>[] = [];
    for (const server of scanResult.servers) {
      if (!server.serverUrl || !orgId) continue;
      const checkResult = await checkAllowlist(orgId, server.serverUrl);
      allowlistStatuses.push({
        server_url: server.serverUrl,
        allowed: checkResult.allowed,
        enforcement_mode: checkResult.enforcementMode,
        status: checkResult.status,
        message: checkResult.message,
      });
      if (!checkResult.allowed) {
        // Add CRITICAL finding for blocked servers
        server.issues.push({
          type: 'SERVER_NOT_ALLOWLISTED',
          severity: 'CRITICAL' as const,
          title: 'Server not in approved registry',
          description: checkResult.message,
          fix: 'Submit this server for approval in the registry, or switch enforcement mode to "warn" or "off".',
          deduction: 0,
        });
        // Recalculate score
        const totalDeduction = server.issues.reduce((sum: number, i) => sum + i.deduction, 0);
        server.score = Math.max(0, 100 - totalDeduction);
      }
    }

    // Recalculate overall score after allowlist adjustments
    if (scanResult.servers.length > 0) {
      const totalScore = scanResult.servers.reduce((sum: number, s) => sum + (s.score ?? 0), 0);
      scanResult.score = Math.round(totalScore / scanResult.servers.length);
    }

    // ── Save scan to DB (org-based `scans` table) ──────────────────────
    let scanResultId: string | undefined;

    // Resolve org context for the authenticated user (API key or session)
    let resolvedOrgId = orgId; // from query param

    if (!resolvedOrgId) {
      // Try to resolve from user's membership
      const { data: membership } = await svc
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", userId)
        .eq("invitation_status", "accepted")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      resolvedOrgId = membership?.organization_id ?? null;
    }

    if (resolvedOrgId) {
      // Check org scan quota using tier-catalog limits
      const { data: orgData } = await svc
        .from("organizations")
        .select("plan_id, scans_used_this_period")
        .eq("id", resolvedOrgId)
        .single();

      if (orgData) {
        const orgPlan = orgData.plan_id ?? "free";
        const tierLimits: Record<string, number> = {
          free: 50,
          developer: 100,
          team: 500,
          startup: 2_000,
          enterprise: -1,
        };
        const scanLimit = tierLimits[orgPlan] ?? 50;
        const scansUsed = orgData.scans_used_this_period ?? 0;

        // Free plan: block if limit reached
        if (orgPlan === "free" && scanLimit !== -1 && scansUsed >= scanLimit) {
          const resetDate = new Date();
          resetDate.setMonth(resetDate.getMonth() + 1, 1);
          resetDate.setHours(0, 1, 0, 0);

          return NextResponse.json(
            {
              error: "check_limit_reached",
              message: `You have used all ${scanLimit} free scans this month.`,
              reset_date: resetDate.toISOString(),
              upgrade_url: "https://mcpguardian.com/upgrade",
            },
            { status: 403 },
          );
        }
      }

      // Pick the first server for the scan record (use first scanned server)
      const firstServer = scanResult.servers[0];
      let mcpServerId: string | null = null;

      // Try to match by URL to an existing registered server
      if (firstServer?.serverUrl) {
        const { data: existingServer } = await svc
          .from("mcp_servers")
          .select("id")
          .eq("organization_id", resolvedOrgId)
          .eq("endpoint_url", firstServer.serverUrl)
          .limit(1)
          .maybeSingle();
        mcpServerId = existingServer?.id ?? null;
      }

      // Save to org-based `scans` table
      const { data: insertedScan, error: insertError } = await svc
        .from("scans")
        .insert({
          organization_id: resolvedOrgId,
          mcp_server_id: mcpServerId || null,
          triggered_by: userId,
          trigger_reason: "manual",
          status: "completed",
          overall_result:
            scanResult.score >= 80 ? "clean" : scanResult.score >= 40 ? "suspicious" : "malicious",
          risk_score: 100 - scanResult.score, // invert: scan score is safety, risk_score is danger
          pipeline_steps: [],
          findings: scanResult.servers.flatMap((s) => s.issues) as unknown as Record<string, unknown>[],
          owasp_violations: (scanResult.complianceSummary?.owasp_mcp ?? []) as unknown as Record<string, unknown>[],
          mitre_atlas_mappings: (scanResult.complianceSummary?.mitre_atlas ?? []) as unknown as Record<string, unknown>[],
          nsa_csi_findings: (scanResult.complianceSummary?.nsa_csi ?? []) as unknown as Record<string, unknown>[],
          completed_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Failed to save scan result:", insertError);
        // Non-fatal — still return the scan result to the user
      } else {
        scanResultId = insertedScan?.id;
      }

      // Increment scan counter atomically
      svc.rpc("increment_org_scans", { org_id: resolvedOrgId }).then(() => {}).then(undefined, (err: unknown) => {
        console.error("Failed to increment scan count:", err);
      });
    }

    // ── Fire-and-forget: submit for auto-approval ────────────────────
    if (orgId) {
      for (const server of scanResult.servers) {
        if (server.serverUrl && server.toolsHash) {
          submitForApproval(orgId, server.serverUrl, '', server.score, server.toolsHash);
        }
      }
    }

    // Build response — spread scan result fields at top level plus id and metadata
    const responseBody: Record<string, unknown> = {
      ...JSON.parse(JSON.stringify(scanResult)),
      agent_directive: agentDirective,
      remediation,
    } as Record<string, unknown>;

    if (scanResultId) {
      responseBody.id = scanResultId;
    }

    if (allowlistStatuses.length > 0) {
      responseBody.allowlist_status = allowlistStatuses;
    }

    return NextResponse.json(responseBody, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 },
    );
  }
};
