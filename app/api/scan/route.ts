import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { scanMcpConfig } from "@/lib/scanner";
import { loadVulnerabilities } from "@/lib/scanner/cve-loader";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { computeConfigHash, computeToolDiff, generateRugPullIssue } from "@/lib/scanner/rug-pull";
import { validateApiKey, rateLimitResponse } from "@/lib/api-key-auth";
import { recordCheck } from "@/lib/check-counter";
import { buildAgentDirective } from "@/lib/scanner/report-builder";
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

    // ── Save scan to DB (now includes allowlist findings) ────────────
    let scanResultId: string | undefined;

    // For API-key-authenticated requests `userId` is already set above.
    // Only fall back to session auth when apiKeyId is null (browser session path).
    let dbUserId: string | null = apiKeyId ? userId : null;

    if (!dbUserId) {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) dbUserId = user.id;
    }

    if (dbUserId) {
      // Use the anon Supabase client only for the session-auth path since RLS
      // requires the user's JWT. For API-key paths we use the service client
      // (already created as `svc` above) to bypass RLS.
      const supabase = apiKeyId ? svc : await createClient();
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("plan, scans_this_month, max_scans, checks_purchased")
        .eq("id", dbUserId)
        .single();
      let profile = profileData;

      if (profileError && profileError.code === "PGRST116") {
        const { error: createError } = await svc.from("profiles").insert({
          id: dbUserId,
          email: "",
        });
        if (createError) {
          console.error("Failed to create profile:", createError);
          return NextResponse.json(
            { error: "Account setup incomplete. Try signing out and back in." },
            { status: 500 },
          );
        }
        profile = { plan: "free", scans_this_month: 0, max_scans: 100, checks_purchased: 0 };
      } else if (profileError) {
        console.error("Failed to fetch profile:", profileError);
      }

      if (profile) {
        const plan = profile.plan ?? "free";
        const planLimits: Record<string, number> = {
          free: 100,
          developer: 2_000,
          team: 20_000,
          startup: 200_000,
        };
        const checksLimit = planLimits[plan] ?? 100;
        const checksPurchased = profile.checks_purchased ?? 0;
        const totalAvailable = checksLimit + checksPurchased;

        // Free plan: block if limit reached + no top-up credits
        if (plan === "free" && profile.scans_this_month >= totalAvailable) {
          const resetDate = new Date();
          resetDate.setMonth(resetDate.getMonth() + 1, 1);
          resetDate.setHours(0, 1, 0, 0);

          return NextResponse.json(
            {
              error: "check_limit_reached",
              message: `You have used all ${totalAvailable} free checks this month.`,
              reset_date: resetDate.toISOString(),
              top_up_url: "https://app.mcpguardian.com/billing/top-up",
              upgrade_url: "https://app.mcpguardian.com/billing/upgrade",
            },
            { status: 403 },
          );
        }
      }

      const { data: insertedScan, error: insertError } = await supabase
        .from("scan_results")
        .insert({
          user_id: dbUserId,
          overall_grade: scanResult.grade,
          overall_score: scanResult.score,
          servers_scanned: scanResult.serversScanned,
          critical_issues: scanResult.criticalIssues,
          high_issues: scanResult.highIssues,
          medium_issues: scanResult.mediumIssues ?? 0,
          results: JSON.parse(JSON.stringify(scanResult)),
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Failed to save scan result:", insertError);
        return NextResponse.json(
          { error: "Scan completed but failed to save." },
          { status: 500 },
        );
      }

      scanResultId = insertedScan?.id;

      // Increment scan counter atomically
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ scans_this_month: (profile?.scans_this_month || 0) + 1 })
        .eq("id", dbUserId);

      if (updateError) {
        console.error("Failed to increment scan count:", updateError);
      }
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
