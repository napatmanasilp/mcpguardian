import { NextRequest } from "next/server";
import { z } from "zod";

import { err, ok, isError, requireUser } from "@/lib/api-helpers";
import { createServiceClient } from "@/lib/supabase/service";
import { runScanPipeline } from "@/workers/scan-pipeline";

const OnboardingSchema = z
  .object({
    orgName: z.string().min(1, "Organization name is required").max(100),
    serverName: z.string().min(1, "Server name is required").max(100),
    transportType: z.enum(["http", "stdio"]),
    endpointUrl: z.string().optional(),
    stdioCommand: z.string().optional(),
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

// POST /api/onboarding — create org + server + trigger scan
export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (isError(auth)) return auth;

  const svc = createServiceClient();
  const userId = auth.user.userId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err("INVALID_BODY", "Invalid request body", 400);
  }

  const parsed = OnboardingSchema.safeParse(body);
  if (!parsed.success) {
    return err(
      "VALIDATION_ERROR",
      parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      400,
    );
  }

  const { orgName, serverName, transportType, endpointUrl, stdioCommand } = parsed.data;

  try {
    // ── Step 1: Find or create organization ─────────────────────────
    const { data: membership } = await svc
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", userId)
      .eq("invitation_status", "accepted")
      .maybeSingle();

    let orgId: string;

    if (membership) {
      orgId = membership.organization_id;
    } else {
      // Create new org
      const slug =
        orgName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 40) || `org-${Date.now()}`;

      const { data: org, error: orgError } = await svc
        .from("organizations")
        .insert({ name: orgName, slug, plan_id: "free", seats_used: 1 })
        .select("id")
        .single();

      if (orgError || !org) {
        console.error("[onboarding] Failed to create org:", orgError?.message);
        return err("ORG_CREATE_FAILED", "Failed to create organization", 500);
      }

      orgId = org.id;

      const { error: memberError } = await svc
        .from("organization_members")
        .insert({
          organization_id: orgId,
          user_id: userId,
          role: "owner",
          invitation_status: "accepted",
        });

      if (memberError) {
        console.error("[onboarding] Failed to create membership:", memberError.message);
        return err("MEMBER_CREATE_FAILED", "Failed to create membership", 500);
      }
    }

    // ── Step 2: Create MCP server ────────────────────────────────────
    const { data: mcpServer, error: serverError } = await svc
      .from("mcp_servers")
      .insert({
        organization_id: orgId,
        name: serverName,
        transport_type: transportType,
        endpoint_url: transportType === "http" ? endpointUrl ?? null : null,
        stdio_command: transportType === "stdio" ? stdioCommand ?? null : null,
        allowlist_status: "monitoring",
      })
      .select("id")
      .single();

    if (serverError || !mcpServer) {
      console.error("[onboarding] Failed to create server:", serverError?.message);
      return err("SERVER_CREATE_FAILED", "Failed to create MCP server", 500);
    }

    // ── Step 3: Create scan record + run pipeline ────────────────────
    let scanId: string | null = null;

    try {
      const { data: scan, error: scanError } = await svc
        .from("scans")
        .insert({
          organization_id: orgId,
          mcp_server_id: mcpServer.id,
          triggered_by: userId,
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

        // Increment scan counter (async)
        svc.rpc("increment_org_scans", { org_id: orgId }).then(() => {});

        // Fire-and-forget the pipeline
        runScanPipeline({
          scanId: scan.id,
          organizationId: orgId,
          mcpServerId: mcpServer.id,
        }).catch((err) => {
          console.error(`[onboarding] Pipeline failed for scan ${scan.id}:`, err);
        });
      }
    } catch (scanErr) {
      // Non-critical — scan can be triggered later from the dashboard
      console.error("[onboarding] Failed to create scan:", scanErr);
    }

    return ok(
      {
        orgId,
        mcpServerId: mcpServer.id,
        scanId,
        status: "success",
      },
      201,
    );
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Unknown error";
    console.error("[onboarding] Fatal error:", message);
    return err("INTERNAL_ERROR", "An unexpected error occurred", 500);
  }
}
