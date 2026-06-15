import { NextRequest } from "next/server";

import {
  err,
  ok,
  isError,
  requireUser,
  requireOrg,
  checkScanLimit,
} from "@/lib/api-helpers";
import { runScanPipeline } from "@/workers/scan-pipeline";
import type { ScanPipelinePayload } from "@/workers/scan-pipeline";

// POST /api/servers/[serverId]/rescan — trigger a new scan for a specific server
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ serverId: string }> },
) {
  const { serverId } = await params;

  const auth = await requireUser();
  if (isError(auth)) return auth;

  const orgCtx = await requireOrg(auth.user.userId);
  if (isError(orgCtx)) return orgCtx;

  const { org, svc } = orgCtx;

  // Verify server belongs to the user's organization (cross-org protection)
  const { data: server } = await svc
    .from("mcp_servers")
    .select("id")
    .eq("id", serverId)
    .eq("organization_id", org.orgId)
    .single();

  if (!server) {
    return err("FORBIDDEN", "Server not found or access denied", 403);
  }

  // Check scan limit
  const limitCheck = checkScanLimit(org);
  if (limitCheck) return limitCheck;

  // Insert new scan record
  const { data: scan, error: insertError } = await svc
    .from("scans")
    .insert({
      organization_id: org.orgId,
      mcp_server_id: serverId,
      triggered_by: auth.user.userId,
      trigger_reason: "manual",
      is_priority_rescan: false,
      status: "queued",
      pipeline_steps: [],
      findings: [],
      owasp_violations: [],
      mitre_atlas_mappings: [],
      nsa_csi_findings: [],
    })
    .select("id")
    .single();

  if (insertError || !scan) {
    return err("INSERT_ERROR", "Failed to create scan", 500);
  }

  // Increment scan counter (fire-and-forget)
  svc.rpc("increment_org_scans", { org_id: org.orgId }).then(() => {});

  // Run the scan pipeline inline (must complete before response on Vercel)
  const pipelinePayload: ScanPipelinePayload = {
    scanId: scan.id,
    organizationId: org.orgId,
    mcpServerId: serverId,
  };

  const pipelineResult = await runScanPipeline(pipelinePayload);

  if (!pipelineResult.success) {
    return ok({ scanId: scan.id, status: "failed", error: pipelineResult.error }, 200);
  }

  return ok({ scanId: scan.id, status: "completed" }, 201);
}
