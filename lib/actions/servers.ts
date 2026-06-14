"use server";

import { redirect } from "next/navigation";

import { getOrgContext } from "@/lib/data/org-context";
import { createServiceClient } from "@/lib/supabase/service";
import { runScanPipeline } from "@/workers/scan-pipeline";
import { ActionState } from "@/lib/types/settings";
import { AddServerSchema } from "@/lib/validation/schemas";

// ─── Server Action ────────────────────────────────────────────────────

export async function addServer(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = {
    name: formData.get("name") as string | null ?? "",
    transport: formData.get("transport") as string | null ?? "",
    endpoint: formData.get("endpoint") as string | null ?? "",
    command: formData.get("command") as string | null ?? "",
    authHeader: formData.get("authHeader") as string | null ?? "",
  };

  const parsed = AddServerSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString();
      if (key && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    const firstError =
      parsed.error.issues[0]?.message ?? "Validation failed";
    return { error: firstError, fieldErrors };
  }

  // Resolve org context
  const ctx = await getOrgContext();
  if (!ctx) {
    return { error: "Not authenticated or no organization found." };
  }

  const svc = createServiceClient();
  const { name, transport, endpoint, command } = parsed.data;
  const authHeader = raw.authHeader?.trim() || null;

  // Build headers object if auth header is provided
  const headers: Record<string, string> = {};
  if (authHeader && transport === "http") {
    headers["Authorization"] = authHeader;
  }

  // Insert MCP server
  const { data: mcpServer, error: serverError } = await svc
    .from("mcp_servers")
    .insert({
      organization_id: ctx.organizationId,
      name,
      transport_type: transport,
      endpoint_url: transport === "http" ? (endpoint?.trim() ?? null) : null,
      stdio_command: transport === "stdio" ? (command?.trim() ?? null) : null,
      headers: Object.keys(headers).length > 0 ? headers : {},
      allowlist_status: "monitoring",
    })
    .select("id")
    .single();

  if (serverError || !mcpServer) {
    return { error: "Failed to create server. Please try again." };
  }

  // Trigger initial scan (non-blocking)
  try {
    const { data: scan } = await svc
      .from("scans")
      .insert({
        organization_id: ctx.organizationId,
        mcp_server_id: mcpServer.id,
        triggered_by: ctx.userId,
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

    if (scan) {
      svc.rpc("increment_org_scans", { org_id: ctx.organizationId }).then(() => {});

      runScanPipeline({
        scanId: scan.id,
        organizationId: ctx.organizationId,
        mcpServerId: mcpServer.id,
      }).catch((pipelineErr) => {
        console.error(
          `[addServer] Pipeline failed for scan ${scan.id}:`,
          pipelineErr,
        );
      });
    }
  } catch (scanErr) {
    // Non-critical — scan can be triggered later
    console.error("[addServer] Failed to enqueue initial scan:", scanErr);
  }

  redirect("/servers");
}
