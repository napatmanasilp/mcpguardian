// SECTION 4.1 — Scan Pipeline Worker
// Triggered by: POST /api/scans (enqueued as Vercel background function)
//
// Pipeline steps in order:
//   Step 1: static_analysis
//   Step 2: domain_verification
//   Step 3: sandbox_execution
//   Step 4: hash_comparison
//
// After all steps:
//   - Calculate overall risk_score (0–100) from weighted findings
//   - Set overall_result: clean (<20) | suspicious (20–60) | malicious (>60)
//   - Update mcp_servers.last_scan_id, last_scan_at, last_scan_result, risk_score
//   - Trigger alert if result='malicious' or risk_score > 70
//   - Update nsa_compliance_assessments for org
//   - Set scan.status = 'completed'

import { createServiceClient } from "@/lib/supabase/service";
import { scanMcpConfig } from "@/lib/scanner";
import { loadVulnerabilities } from "@/lib/scanner/cve-loader";
import { computeConfigHash } from "@/lib/scanner/rug-pull";
import { buildAgentDirective } from "@/lib/scanner/report-builder";
import { buildComplianceSummary } from "@/lib/compliance-mappings";
import type { ExtendedScanResult, Issue } from "@/lib/scanner/types";

export interface ScanPipelinePayload {
  scanId: string;
  organizationId: string;
  mcpServerId: string;
}

/**
 * Run the full 4-step scan pipeline for a single scan record.
 * Called by POST /api/scans as a background function (fire-and-forget).
 */
export async function runScanPipeline(payload: ScanPipelinePayload): Promise<{ success: boolean; error?: string }> {
  const { scanId, organizationId, mcpServerId } = payload;
  const svc = createServiceClient();

  try {
    // ── Fetch MCP server config ─────────────────────────────────────
    const { data: server, error: serverError } = await svc
      .from("mcp_servers")
      .select("name, endpoint_url, transport_type, stdio_command, stdio_args, headers, allowlist_status")
      .eq("id", mcpServerId)
      .eq("organization_id", organizationId)
      .single();

    if (serverError || !server) {
      await failScan(scanId, "MCP server not found");
      return { success: false, error: "MCP server not found" };
    }

    // Build McpServerInput from the server config
    const serverInput: Record<string, unknown> = {
      name: server.name,
      url: server.endpoint_url ?? undefined,
      command: server.stdio_command ?? undefined,
      args: (server.stdio_args as string[]) ?? undefined,
    };

    // Include headers if configured (so scanner knows auth is present)
    const serverHeaders = server.headers as Record<string, string> | null;
    if (serverHeaders && Object.keys(serverHeaders).length > 0) {
      serverInput.headers = serverHeaders;
    }

    // Wrap in a minimal MCP config JSON for scanMcpConfig
    const configJson = JSON.stringify({
      mcpServers: {
        [server.name]: serverInput,
      },
    });

    // Mark scan as running
    await svc
      .from("scans")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", scanId);

    // ── Step 1 + 2 + 3 + 4: Run the full pipeline ───────────────────
    const vulnerabilities = await loadVulnerabilities();
    const scanResult: ExtendedScanResult = await scanMcpConfig(configJson, vulnerabilities);

    // ── Hash comparison with previous snapshot ───────────────────────
    const configHash = await computeConfigHash(configJson);
    for (const srv of scanResult.servers) {
      if (!srv.toolsHash || !srv.serverUrl) continue;
      const { data: snapshot } = await svc
        .from("tool_definition_snapshots")
        .select("*")
        .eq("config_hash", configHash)
        .eq("server_url", srv.serverUrl)
        .maybeSingle();

      if (snapshot) {
        await svc
          .from("tool_definition_snapshots")
          .update({
            tools_hash: srv.toolsHash,
            tools_snapshot: srv.rawTools ?? [],
            last_seen_at: new Date().toISOString(),
            change_count:
              snapshot.change_count + (snapshot.tools_hash !== srv.toolsHash ? 1 : 0),
          })
          .eq("id", snapshot.id);
      } else {
        await svc
          .from("tool_definition_snapshots")
          .insert({
            config_hash: configHash,
            server_url: srv.serverUrl,
            tools_hash: srv.toolsHash,
            tools_snapshot: srv.rawTools ?? [],
            first_seen_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
            change_count: 0,
          });
      }
    }

    // ── Calculate overall result ────────────────────────────────────
    // scanResult.score is a SAFETY score (100 = safe, 0 = dangerous)
    // risk_score in DB is RISK (100 = dangerous, 0 = safe)
    const safetyScore = scanResult.score;
    const riskScore = 100 - safetyScore;
    let overallResult: "clean" | "suspicious" | "malicious" | "error";
    if (riskScore <= 20) {
      overallResult = "clean";
    } else if (riskScore <= 50) {
      overallResult = "suspicious";
    } else {
      overallResult = "malicious";
    }

    // Collect all issues for compliance mapping
    const allIssues: Issue[] = scanResult.servers.flatMap((s) => s.issues);
    const crossServerIssues: Issue[] = (scanResult.crossServerRisks ?? []) as unknown as Issue[];
    const complianceSummary = buildComplianceSummary(allIssues, crossServerIssues);

    // Build pipeline steps summary
    const pipelineSteps = (scanResult.pipelineReports ?? []).flatMap((pr) =>
      pr.steps.map((s) => ({
        step_name: s.stepName,
        status: s.status,
        details: s.details,
        issues_count: s.issues.length,
      })),
    );

    // Build OWASP violations list
    const owaspViolations = complianceSummary.owasp_mcp ?? [];

    // Build MITRE ATLAS mappings
    const mitreAtlasMappings = complianceSummary.mitre_atlas ?? [];

    // Build NSA CSI findings
    const nsaCsiFindings = complianceSummary.nsa_csi ?? [];

    // Compute duration
    const completedAt = new Date().toISOString();
    const pipelineStartTime = new Date(scanResult.scannedAt).getTime();
    const durationMs = Math.max(0, Date.now() - pipelineStartTime);

    // ── Update scan record ──────────────────────────────────────────
    const { error: updateError } = await svc
      .from("scans")
      .update({
        status: "completed",
        overall_result: overallResult,
        risk_score: riskScore,
        pipeline_steps: pipelineSteps as unknown as Record<string, unknown>[],
        findings: allIssues as unknown as Record<string, unknown>[],
        owasp_violations: owaspViolations as unknown as Record<string, unknown>[],
        mitre_atlas_mappings: mitreAtlasMappings as unknown as Record<string, unknown>[],
        nsa_csi_findings: nsaCsiFindings as unknown as Record<string, unknown>[],
        duration_ms: durationMs,
        completed_at: completedAt,
      })
      .eq("id", scanId);

    if (updateError) {
      console.error(`[scan-pipeline] Failed to update scan ${scanId}:`, updateError.message);
      return { success: false, error: updateError.message };
    }

    // ── Update mcp_servers metadata ─────────────────────────────────
    await svc
      .from("mcp_servers")
      .update({
        last_scan_id: scanId,
        last_scan_at: completedAt,
        last_scan_result: overallResult,
        risk_score: riskScore,
        updated_at: completedAt,
      })
      .eq("id", mcpServerId);

    // ── Trigger alert if malicious or high risk ─────────────────────
    if (overallResult === "malicious" || riskScore > 70) {
      await svc
        .from("alerts")
        .insert({
          organization_id: organizationId,
          severity: riskScore > 80 ? "CRITICAL" : "HIGH",
          alert_type: overallResult === "malicious" ? "SCAN_MALICIOUS" : "HIGH_RISK_SCORE",
          title:
            overallResult === "malicious"
              ? "Malicious MCP server detected"
              : "High-risk MCP server detected",
          message: `Scan ${scanId} for server "${server.name}" returned risk score ${riskScore} (${overallResult}). ${scanResult.criticalIssues} critical, ${scanResult.highIssues} high issues found.`,
          server_id: mcpServerId,
          scan_id: scanId,
          metadata: { issue_key: `scan_${scanId}` },
        })
        .then(() => {});
    }

    // ── Update NSA compliance assessment ────────────────────────────
    try {
      await svc
        .from("nsa_compliance_assessments")
        .insert({
          organization_id: organizationId,
          document_reference: "U/OO/6030316-26",
          parameter_validation_active: !allIssues.some(
            (i) => i.type === "COMMAND_EXECUTION",
          ),
          tool_execution_sandboxed: !allIssues.some((i) => i.type === "STDIO_TRANSPORT"),
          all_invocations_logged: true,
          injection_filtering_active: !allIssues.some((i) => i.type === "INJECTION_ATTEMPT"),
          message_signing_configured: false,
          least_privilege_tokens_enforced: !allIssues.some(
            (i) => i.type === "BROAD_PERMISSIONS",
          ),
          network_scan_for_unauthorized_servers: false,
          chained_output_filtering_active: !allIssues.some(
            (i) => i.type === "RETURN_VALUE_POISONING",
          ),
          overall_score: riskScore,
        })
        .then(() => {});
    } catch {
      // Non-critical — compliance assessment update is best-effort
    }

    console.log(
      `[scan-pipeline] Completed scan ${scanId}: score=${riskScore} result=${overallResult} critical=${scanResult.criticalIssues} high=${scanResult.highIssues}`,
    );

    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown pipeline error";
    console.error(`[scan-pipeline] Fatal error for scan ${scanId}:`, errorMessage);
    await failScan(scanId, errorMessage);
    return { success: false, error: errorMessage };
  }
}

async function failScan(scanId: string, reason: string): Promise<void> {
  try {
    const svc = createServiceClient();
    await svc
      .from("scans")
      .update({
        status: "failed",
        overall_result: "error",
        completed_at: new Date().toISOString(),
      })
      .eq("id", scanId);
  } catch {
    // best-effort
  }
}
