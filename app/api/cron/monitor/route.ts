import { NextRequest, NextResponse } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";
import { runScanPipeline } from "@/workers/scan-pipeline";

/**
 * GET /api/cron/monitor — Scheduled rescan cron
 *
 * Re-scans all registered MCP servers that haven't been scanned in 24h.
 * Replaces the legacy monitored_configs-based cron.
 * Schedule: every 6 hours (vercel.json)
 *
 * For each org's servers where last_scan_at is null or > 24h ago:
 *   1. Create a new scan record with trigger_reason='scheduled'
 *   2. Fire the scan pipeline (async)
 *   3. The pipeline handles alerts, compliance, and risk scoring
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const svc = createServiceClient();
  let serversScanned = 0;
  let scansEnqueued = 0;
  let errors = 0;

  try {
    // Find servers that haven't been scanned in the last 24h
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: servers } = await svc
      .from("mcp_servers")
      .select("id, organization_id, name, last_scan_at")
      .or(`last_scan_at.is.null,last_scan_at.lt.${twentyFourHoursAgo}`)
      .limit(50); // Process max 50 per cron run to avoid timeouts

    if (!servers || servers.length === 0) {
      return NextResponse.json({
        success: true,
        serversScanned: 0,
        scansEnqueued: 0,
        errors: 0,
        executionTimeMs: Date.now() - startTime,
      });
    }

    for (const server of servers) {
      try {
        serversScanned++;

        // Create scan record
        const { data: scan, error: scanError } = await svc
          .from("scans")
          .insert({
            organization_id: server.organization_id,
            mcp_server_id: server.id,
            trigger_reason: "scheduled",
            status: "queued",
            pipeline_steps: [],
            findings: [],
            owasp_violations: [],
            mitre_atlas_mappings: [],
            nsa_csi_findings: [],
          })
          .select("id")
          .single();

        if (scanError || !scan) {
          errors++;
          continue;
        }

        // Increment scan counter
        svc.rpc("increment_org_scans", { org_id: server.organization_id }).then(() => {});

        // Fire pipeline (non-blocking)
        runScanPipeline({
          scanId: scan.id,
          organizationId: server.organization_id,
          mcpServerId: server.id,
        }).catch((err) => {
          console.error(`[cron/monitor] Pipeline failed for server ${server.id}:`, err);
        });

        scansEnqueued++;
      } catch {
        errors++;
      }
    }

    const executionTimeMs = Date.now() - startTime;
    console.log(
      `[cron/monitor] servers=${serversScanned} enqueued=${scansEnqueued} errors=${errors} time=${executionTimeMs}ms`,
    );

    return NextResponse.json({
      success: true,
      serversScanned,
      scansEnqueued,
      errors,
      executionTimeMs,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
