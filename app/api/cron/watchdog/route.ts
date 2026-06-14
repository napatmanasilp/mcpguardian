// SECTION 4.2 — Session Watchdog Cron
// Schedule: every 15 minutes (vercel.json)
//
// For each active session where:
//   watchdog_enabled = true AND watchdog_next_verify_at < NOW()
//
// 1. Re-fetch MCP server tool manifest
// 2. Hash it and compare to scan baseline
// 3. If changed:
//    a. Create scan with trigger_reason='watchdog_triggered'
//    b. Terminate session: status='terminated_threat', termination_reason='tool_list_changed'
//    c. Dispatch alert: event_type='watchdog_failed'
// 4. If unchanged:
//    a. session.watchdog_last_verified_at = NOW()
//    b. session.watchdog_next_verify_at = NOW() + 15 minutes

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const svc = createServiceClient();
  const now = new Date().toISOString();
  let sessionsChecked = 0;
  let sessionsTerminated = 0;
  let scansCreated = 0;
  let alertsDispatched = 0;
  let errors = 0;

  // Fetch sessions due for watchdog verification
  const { data: sessions } = await svc
    .from("proxy_sessions")
    .select("id, mcp_server_id, organization_id, session_token")
    .eq("status", "active")
    .eq("watchdog_enabled", true)
    .lt("watchdog_next_verify_at", now);

  if (!sessions || sessions.length === 0) {
    return NextResponse.json({
      success: true,
      sessionsChecked: 0,
      sessionsTerminated: 0,
      scansCreated: 0,
      alertsDispatched: 0,
      errors: 0,
    });
  }

  for (const session of sessions) {
    try {
      sessionsChecked++;

      // Fetch server config + latest scan snapshot
      const { data: server } = await svc
        .from("mcp_servers")
        .select("id, endpoint_url, last_scan_id")
        .eq("id", session.mcp_server_id)
        .single();

      if (!server || !server.endpoint_url) {
        // Server gone — terminate session
        await svc
          .from("proxy_sessions")
          .update({
            status: "terminated_threat",
            ended_at: now,
            termination_reason: "mcp_server_config_not_found",
          })
          .eq("id", session.id);
        sessionsTerminated++;
        continue;
      }

      // Fetch expected tool hash from the last completed scan
      let expectedToolsHash: string | null = null;
      if (server.last_scan_id) {
        const { data: lastScan } = await svc
          .from("scans")
          .select("results")
          .eq("id", server.last_scan_id)
          .single();

        if (lastScan?.results) {
          try {
            const scanResults =
              typeof lastScan.results === "string"
                ? JSON.parse(lastScan.results)
                : lastScan.results;
            expectedToolsHash = scanResults.servers?.[0]?.toolsHash ?? null;
          } catch {
            // ignore parse errors
          }
        }
      }

      // Probe the server for current tools
      let toolsChanged = false;
      try {
        const toolsResponse = await fetch(server.endpoint_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            method: "tools/list",
            id: `watchdog-${session.id}-${Date.now()}`,
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (toolsResponse.ok) {
          const toolsData = (await toolsResponse.json()) as {
            result?: { tools?: Array<{ name: string; description?: string; inputSchema?: unknown }> };
          };
          const currentTools = toolsData.result?.tools ?? [];

          if (expectedToolsHash && currentTools.length > 0) {
            const currentHash = hashToolsList(currentTools);
            toolsChanged = currentHash !== expectedToolsHash;
          }
        }
      } catch {
        // Server unreachable — treat as potential threat
        toolsChanged = true;
      }

      if (toolsChanged) {
        // 3a. Create scan with trigger_reason='watchdog_triggered'
        const { data: newScan } = await svc
          .from("scans")
          .insert({
            organization_id: session.organization_id,
            mcp_server_id: session.mcp_server_id,
            trigger_reason: "watchdog_triggered",
            status: "queued",
            is_priority_rescan: false,
            pipeline_steps: [],
            findings: [],
            owasp_violations: [],
            mitre_atlas_mappings: [],
            nsa_csi_findings: [],
          })
          .select("id")
          .single();

        if (newScan) scansCreated++;

        // 3b. Terminate session
        await svc
          .from("proxy_sessions")
          .update({
            status: "terminated_rug_pull",
            ended_at: now,
            termination_reason: "tool_list_changed_during_watchdog",
          })
          .eq("id", session.id);
        sessionsTerminated++;

        // 3c. Dispatch alert
        await svc
          .from("alerts")
          .insert({
            organization_id: session.organization_id,
            alert_type: "WATCHDOG_FAILED",
            severity: "CRITICAL",
            title: "Watchdog detected tool list change — session terminated",
            message: `Active session ${session.id} for server ${server.id} was terminated because the tool manifest changed since last scan. This may indicate a rug-pull attack.`,
            session_id: session.id,
            server_id: server.id,
            metadata: { issue_key: `watchdog_${session.id}` },
          })
          .then(() => {});
        alertsDispatched++;
      } else {
        // 4. Session is clean — update timestamps
        await svc
          .from("proxy_sessions")
          .update({
            watchdog_last_verified_at: now,
            watchdog_next_verify_at: new Date(
              Date.now() + 15 * 60 * 1000,
            ).toISOString(),
          })
          .eq("id", session.id);
      }
    } catch {
      errors++;
    }
  }

  console.log(
    `[watchdog-cron] checked=${sessionsChecked} terminated=${sessionsTerminated} scans=${scansCreated} alerts=${alertsDispatched} errors=${errors}`,
  );

  return NextResponse.json({
    success: true,
    sessionsChecked,
    sessionsTerminated,
    scansCreated,
    alertsDispatched,
    errors,
  });
}

function hashToolsList(
  tools: Array<{ name: string; description?: string; inputSchema?: unknown }>,
): string {
  const sorted = [...tools]
    .filter((t) => t.name)
    .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  const concatenated = sorted
    .map((t) => `${t.name}|${t.description || ""}|${JSON.stringify(t.inputSchema || {})}`)
    .join("||");
  return createHash("sha256").update(concatenated, "utf-8").digest("hex");
}
