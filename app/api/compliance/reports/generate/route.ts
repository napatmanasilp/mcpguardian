import { NextRequest } from "next/server";
import { z } from "zod";

import { err, ok, isError, requireUser, requireOrg } from "@/lib/api-helpers";

const GenerateReportSchema = z.object({
  reportType: z.enum(["owasp_mcp_top10", "mitre_atlas", "nsa_csi", "bundle", "custom"]),
});

// POST /api/compliance/reports/generate — queue a compliance report generation
export async function POST(request: NextRequest) {
  const auth = await requireUser();
  if (isError(auth)) return auth;

  const orgCtx = await requireOrg(auth.user.userId, "complianceExport");
  if (isError(orgCtx)) return orgCtx;

  const { org, svc } = orgCtx;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err("INVALID_BODY", "Invalid request body", 400);
  }

  const parsed = GenerateReportSchema.safeParse(body);
  if (!parsed.success) {
    return err("VALIDATION_ERROR", parsed.error.issues.map((i) => i.message).join(", "), 400);
  }

  const { reportType } = parsed.data;

  // Check if this report type requires a paid addon
  const paidTypes = ["nsa_csi", "bundle"];
  let isPaidAddon = paidTypes.includes(reportType);
  let addonPurchaseId: string | null = null;

  if (isPaidAddon) {
    const { data: addon } = await svc
      .from("addon_purchases")
      .select("id")
      .eq("organization_id", org.orgId)
      .eq("addon_type", reportType === "nsa_csi" ? "nsa_compliance_report" : "compliance_report_bundle")
      .eq("status", "active")
      .maybeSingle();

    if (!addon) {
      return err(
        "ADDON_REQUIRED",
        `The ${reportType} report requires a paid addon. Purchase one from /billing/addons.`,
        403,
      );
    }
    addonPurchaseId = addon.id;
  }

  // Build storage path
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const storagePath = `reports/${org.orgId}/${reportType}/${timestamp}.json`;

  // Create the export record
  const { data: report, error } = await svc
    .from("compliance_report_exports")
    .insert({
      organization_id: org.orgId,
      report_type: reportType,
      generated_by: auth.user.userId,
      storage_path: storagePath,
      is_paid_addon: isPaidAddon,
      addon_purchase_id: addonPurchaseId,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    })
    .select("id")
    .single();

  if (error) return err("INSERT_ERROR", "Failed to create report export", 500);

  // In production, trigger async report generation job here
  // For now, mark as generated immediately
  await svc
    .from("compliance_report_exports")
    .update({
      download_url: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/compliance/reports/${report.id}/download`,
    })
    .eq("id", report.id);

  return ok(
    {
      reportId: report.id,
      reportType,
      status: "generated",
      downloadUrl: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/compliance/reports/${report.id}/download`,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    201,
  );
}
