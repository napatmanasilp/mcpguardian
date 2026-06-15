import { NextRequest } from "next/server";
import { z } from "zod";

import { err, ok, isError, requireUser, requireOrg, checkServerLimit } from "@/lib/api-helpers";
import { runScanPipeline } from "@/workers/scan-pipeline";

const AddServerSchema = z
  .object({
    name: z.string().min(1, "Server name is required").max(253),
    transportType: z.enum(["http", "stdio"]),
    endpointUrl: z.string().url("Must be a valid URL").optional(),
    stdioCommand: z.string().min(1).optional(),
  })
  .refine(
    (data) => {
      if (data.transportType === "http") return !!data.endpointUrl;
      return true;
    },
    { message: "Endpoint URL is required for HTTP transport", path: ["endpointUrl"] },
  )
  .refine(
    (data) => {
      if (data.transportType === "stdio") return !!data.stdioCommand;
      return true;
    },
    { message: "STDIO command is required for STDIO transport", path: ["stdioCommand"] },
  );

// POST /api/servers — register a new MCP server and trigger initial scan
export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (isError(auth)) return auth;

  const orgCtx = await requireOrg(auth.user.userId);
  if (isError(orgCtx)) return orgCtx;

  const { org, svc } = orgCtx;

  // Check server limit for this plan
  const { count: serverCount } = await svc
    .from("mcp_servers")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", org.orgId);

  const limitCheck = checkServerLimit(org, serverCount ?? 0);
  if (limitCheck) return limitCheck;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err("INVALID_BODY", "Invalid request body", 400);
  }

  const parsed = AddServerSchema.safeParse(body);
  if (!parsed.success) {
    return err(
      "VALIDATION_ERROR",
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      400,
    );
  }

  const { name, transportType, endpointUrl, stdioCommand } = parsed.data;

  // Insert new MCP server record
  const { data: mcpServer, error: serverError } = await svc
    .from("mcp_servers")
    .insert({
      organization_id: org.orgId,
      name,
      transport_type: transportType,
      endpoint_url: transportType === "http" ? endpointUrl ?? null : null,
      stdio_command: transportType === "stdio" ? stdioCommand ?? null : null,
      allowlist_status: "monitoring",
    })
    .select("id")
    .single();

  if (serverError || !mcpServer) {
    console.error("[POST /api/servers] Failed to create server:", serverError?.message);
    return err("SERVER_CREATE_FAILED", "Failed to create MCP server", 500);
  }

  // Enqueue initial scan
  let scanId: string | null = null;

  try {
    const { data: scan, error: scanError } = await svc
      .from("scans")
      .insert({
        organization_id: org.orgId,
        mcp_server_id: mcpServer.id,
        triggered_by: auth.user.userId,
        trigger_reason: "on_connect",
        status: "queued",
        pipeline_steps: [],
        findings: [],
        owasp_violations: [],
        mitre_atlas_mappings: [],
        nsa_csi_findings: [],
      })
      .select("id")
      .single();

    if (!scanError && scan) {
      scanId = scan.id;

      // Increment scan counter (async, non-blocking)
      svc.rpc("increment_org_scans", { org_id: org.orgId }).then(() => {});

      // Fire-and-forget the pipeline
      runScanPipeline({
        scanId: scan.id,
        organizationId: org.orgId,
        mcpServerId: mcpServer.id,
      }).catch((pipelineErr) => {
        console.error(
          `[POST /api/servers] Pipeline failed for scan ${scan.id}:`,
          pipelineErr,
        );
      });
    }
  } catch (scanErr) {
    // Non-critical — scan can be triggered later from the server detail page
    console.error("[POST /api/servers] Failed to enqueue scan:", scanErr);
  }

  return ok({ serverId: mcpServer.id, scanId }, 201);
}
