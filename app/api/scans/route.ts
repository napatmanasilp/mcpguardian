import { NextRequest } from "next/server";
import { z } from "zod";

import { err, ok, isError, requireUser, requireOrg, checkScanLimit } from "@/lib/api-helpers";
import { runScanPipeline } from "@/workers/scan-pipeline";
import type { ScanPipelinePayload } from "@/workers/scan-pipeline";

const CreateScanSchema = z.object({
  mcpServerId: z.string().uuid(),
  triggerReason: z.enum(["on_connect", "manual", "scheduled", "priority_rescan"]).default("manual"),
  isPriorityRescan: z.boolean().default(false),
});

// GET /api/scans?serverId=&limit=&cursor=
export async function GET(request: NextRequest) {
  const auth = await requireUser();
  if (isError(auth)) return auth;

  const orgCtx = await requireOrg(auth.user.userId);
  if (isError(orgCtx)) return orgCtx;

  const { org, svc } = orgCtx;
  const url = new URL(request.url);
  const serverId = url.searchParams.get("serverId");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
  const cursor = url.searchParams.get("cursor");

  let query = svc
    .from("scans")
    .select("id, mcp_server_id, status, overall_result, risk_score, trigger_reason, is_priority_rescan, duration_ms, created_at, completed_at")
    .eq("organization_id", org.orgId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (serverId) query = query.eq("mcp_server_id", serverId);
  if (cursor) query = query.lt("created_at", cursor);

  const { data, error } = await query;

  if (error) return err("FETCH_ERROR", "Failed to fetch scans", 500);

  const nextCursor = data && data.length === limit ? data[data.length - 1].created_at : null;

  return ok({
    scans: data ?? [],
    nextCursor,
  });
}

// POST /api/scans
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

  const parsed = CreateScanSchema.safeParse(body);
  if (!parsed.success) {
    return err("VALIDATION_ERROR", parsed.error.issues.map(i => i.message).join(", "), 400);
  }

  const { mcpServerId, triggerReason, isPriorityRescan } = parsed.data;

  // Priority rescan: requires addon or Startup+ plan
  if (isPriorityRescan && !["startup", "enterprise"].includes(org.planId)) {
    // Check for active addon
    const { data: addon } = await svc
      .from("addon_purchases")
      .select("id")
      .eq("organization_id", org.orgId)
      .eq("addon_type", "priority_rescan")
      .eq("status", "active")
      .maybeSingle();

    if (!addon) {
      return err("PRIORITY_RESCAN_REQUIRED", "Priority rescans require a Startup+ plan or a priority_rescan addon", 403);
    }
  }

  // Check scan limit against plan + addon purchases
  // User can have extra_scan_pack_100 addon as an alternative budget
  let effectiveLimit = org.planGates.checksPerMonth;
  if (effectiveLimit !== -1) {
    // Fetch active extra_scan_pack_100 addons for additional budget
    const { data: scanPacks } = await svc
      .from("addon_purchases")
      .select("quantity")
      .eq("organization_id", org.orgId)
      .eq("addon_type", "extra_scan_pack_100")
      .eq("status", "active");

    if (scanPacks && scanPacks.length > 0) {
      const addonChecks = scanPacks.reduce((sum, p) => sum + p.quantity * 100, 0);
      effectiveLimit += addonChecks;
    }
  }

  // Check scan limit with effective limit
  const limitCheck = checkScanLimit({
    ...org,
    planGates: {
      ...org.planGates,
      checksPerMonth: effectiveLimit as any,
    },
  });
  if (limitCheck) return limitCheck;

  // Create scan record
  const { data: scan, error: insertError } = await svc
    .from("scans")
    .insert({
      organization_id: org.orgId,
      mcp_server_id: mcpServerId,
      triggered_by: auth.user.userId,
      trigger_reason: triggerReason,
      is_priority_rescan: isPriorityRescan,
      status: "queued",
      pipeline_steps: [],
      findings: [],
      owasp_violations: [],
      mitre_atlas_mappings: [],
      nsa_csi_findings: [],
    })
    .select("id")
    .single();

  if (insertError) return err("INSERT_ERROR", "Failed to create scan", 500);

  // Increment scan counter (async)
  svc.rpc("increment_org_scans", { org_id: org.orgId }).then(() => {});

  // Trigger the scan pipeline as a background function
  const pipelinePayload: ScanPipelinePayload = {
    scanId: scan.id,
    organizationId: org.orgId,
    mcpServerId,
  };

  // Fire-and-forget: run pipeline in background
  runScanPipeline(pipelinePayload).catch((err) => {
    console.error(`[scans] Pipeline failed for scan ${scan.id}:`, err);
  });

  return ok(
    {
      scanId: scan.id,
      status: "queued",
      pipeline: {
        steps: ["static_analysis", "domain_verification", "sandbox_execution", "hash_comparison"],
      },
    },
    201,
  );
}
