import { NextRequest } from "next/server";

import { err, ok, isError, requireUser, requireOrg } from "@/lib/api-helpers";

const NSA_DOCUMENT_REFERENCE = "U/OO/6030316-26";

// GET /api/compliance/nsa-assessment — list NSA assessments for the org
export async function GET() {
  const auth = await requireUser();
  if (isError(auth)) return auth;

  const orgCtx = await requireOrg(auth.user.userId, "complianceExport");
  if (isError(orgCtx)) return orgCtx;

  const { org, svc } = orgCtx;

  const { data, error } = await svc
    .from("nsa_compliance_assessments")
    .select("*")
    .eq("organization_id", org.orgId)
    .order("assessed_at", { ascending: false });

  if (error) return err("FETCH_ERROR", "Failed to fetch NSA assessments", 500);

  return ok(data ?? []);
}

// POST /api/compliance/nsa-assessment — create a new NSA CSI assessment
// Computes scores based on current scan findings
export async function POST() {
  const auth = await requireUser();
  if (isError(auth)) return auth;

  const orgCtx = await requireOrg(auth.user.userId, "complianceExport");
  if (isError(orgCtx)) return orgCtx;

  const { org, svc } = orgCtx;

  // Analyze recent scans for each NSA CSI control
  const { data: recentScans } = await svc
    .from("scans")
    .select("findings, owasp_violations, nsa_csi_findings, risk_score")
    .eq("organization_id", org.orgId)
    .order("created_at", { ascending: false })
    .limit(10);

  const allFindings = recentScans?.flatMap((s) => s.findings as unknown[]) ?? [];
  const allNsaFindings = recentScans?.flatMap((s) => s.nsa_csi_findings as unknown[]) ?? [];

  // Score each control (0-100, 100 = fully compliant)
  const assessment = {
    parameter_validation_active: !allFindings.some((f: unknown) => (f as Record<string, unknown>)?.type === "COMMAND_EXECUTION"),
    tool_execution_sandboxed: !allFindings.some((f: unknown) => (f as Record<string, unknown>)?.type === "STDIO_TRANSPORT"),
    all_invocations_logged: true, // proxy logs all invocations
    injection_filtering_active: !allFindings.some((f: unknown) => (f as Record<string, unknown>)?.type === "INJECTION_ATTEMPT"),
    message_signing_configured: false, // not yet implemented
    least_privilege_tokens_enforced: !allFindings.some((f: unknown) => (f as Record<string, unknown>)?.type === "BROAD_PERMISSIONS"),
    network_scan_for_unauthorized_servers: allNsaFindings.length === 0,
    chained_output_filtering_active: !allFindings.some((f: unknown) => (f as Record<string, unknown>)?.type === "RETURN_VALUE_POISONING"),
  };

  const controlValues = Object.values(assessment);
  const overallScore = Math.round(
    (controlValues.filter(Boolean).length / controlValues.length) * 100,
  );

  const { data: result, error } = await svc
    .from("nsa_compliance_assessments")
    .insert({
      organization_id: org.orgId,
      document_reference: NSA_DOCUMENT_REFERENCE,
      parameter_validation_active: assessment.parameter_validation_active,
      tool_execution_sandboxed: assessment.tool_execution_sandboxed,
      all_invocations_logged: assessment.all_invocations_logged,
      injection_filtering_active: assessment.injection_filtering_active,
      message_signing_configured: assessment.message_signing_configured,
      least_privilege_tokens_enforced: assessment.least_privilege_tokens_enforced,
      network_scan_for_unauthorized_servers: assessment.network_scan_for_unauthorized_servers,
      chained_output_filtering_active: assessment.chained_output_filtering_active,
      overall_score: overallScore,
    })
    .select("id")
    .single();

  if (error) return err("INSERT_ERROR", "Failed to create NSA assessment", 500);

  return ok(
    {
      assessmentId: result.id,
      documentReference: NSA_DOCUMENT_REFERENCE,
      overallScore,
      controls: assessment,
    },
    201,
  );
}
