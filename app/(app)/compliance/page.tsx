import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Clock, ExternalLink, FileText, RefreshCw } from "lucide-react";

export const metadata: Metadata = {
  title: "Compliance — MCPGuardian",
  description: "NSA MCP Security CSI compliance status and OWASP MCP Top 10 assessment.",
};

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FrameworkTabs } from "@/components/compliance/framework-tabs";
import { RequestPdfButton } from "@/components/compliance/request-pdf-button";
import { computeComplianceScore } from "@/lib/compliance-score";
import { getOwaspMcpControls, getTriggeredOwaspIds } from "@/lib/compliance-mappings";
import { getOrgContext } from "@/lib/data/org-context";
import { createServiceClient } from "@/lib/supabase/service";
import { EMPTY_STATES } from "@/lib/ui/empty-states";
import { cn } from "@/lib/utils";

// Static control definitions — status is overridden by live assessment when available
const NSA_CONTROLS: Array<{
  id: keyof NonNullable<Assessment>;
  label: string;
  defaultStatus: "passed" | "roadmap";
  description: string;
  action: string;
  link?: string;
  deliveryDate?: string;
}> = [
  { id: "parameter_validation_active", label: "Parameter validation", defaultStatus: "passed", description: "InboundScanner + Schema validation", action: "Maintain current InboundScanner configuration" },
  { id: "tool_execution_sandboxed", label: "Tool execution sandboxing", defaultStatus: "passed", description: "Docker sandbox (Dockerfile.scanner-probe)", action: "Ensure sandbox image is up to date" },
  { id: "injection_filtering_active", label: "Filtering chained outputs", defaultStatus: "passed", description: "OutboundScanner + response filtering", action: "Verify OutboundScanner rules are active" },
  { id: "all_invocations_logged", label: "Logging all tool invocations", defaultStatus: "passed", description: "tool_invocation_logs (immutable)", action: "Verify audit trail retention policy" },
  { id: "network_scan_for_unauthorized_servers", label: "Scanning for unauthorized servers", defaultStatus: "passed", description: "MCP server allowlist + scan pipeline", action: "Review allowlist periodically" },
  { id: "least_privilege_tokens_enforced", label: "Least-privilege token enforcement", defaultStatus: "passed", description: "Token guard + permission_set per session", action: "Review permission sets" },
  { id: "chained_output_filtering_active", label: "Chained output filtering", defaultStatus: "passed", description: "Proxy outbound filter + response scanner", action: "Confirm outbound scanner is enabled" },
  { id: "message_signing_configured", label: "Signing and verifying messages", defaultStatus: "roadmap", description: "Cryptographic signing of MCP messages for tamper detection", action: "No action required until feature ships", link: "https://docs.mcpguardian.com/roadmap", deliveryDate: "Q3 2026" },
];

type Assessment = {
  parameter_validation_active: boolean;
  tool_execution_sandboxed: boolean;
  all_invocations_logged: boolean;
  injection_filtering_active: boolean;
  message_signing_configured: boolean;
  least_privilege_tokens_enforced: boolean;
  network_scan_for_unauthorized_servers: boolean;
  chained_output_filtering_active: boolean;
  overall_score: number | null;
  pdf_report_url: string | null;
  pdf_generated_at: string | null;
  assessed_at: string;
};

function CircularProgress({ value, size = 140, strokeWidth = 10 }: { value: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = value >= 80 ? "var(--secure)" : value >= 60 ? "var(--caution)" : "var(--threat)";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(.16,1,.3,1)" }}
        />
      </svg>
      <div className="absolute text-center">
        <p className="font-mono text-3xl font-bold text-white">{value}</p>
        <p className="text-xs text-white/40">/ 100</p>
      </div>
    </div>
  );
}

const CompliancePage = async () => {
  const orgContext = await getOrgContext();
  if (!orgContext) redirect("/onboarding");

  const svc = createServiceClient();

  // Check if org has any servers — no servers means no compliance data possible
  const { count: serverCount } = await svc
    .from("mcp_servers")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgContext.organizationId);

  // Fetch most recent NSA compliance assessment
  const { data: assessment } = await svc
    .from("nsa_compliance_assessments")
    .select("parameter_validation_active, tool_execution_sandboxed, all_invocations_logged, injection_filtering_active, message_signing_configured, least_privilege_tokens_enforced, network_scan_for_unauthorized_servers, chained_output_filtering_active, overall_score, pdf_report_url, pdf_generated_at, assessed_at")
    .eq("organization_id", orgContext.organizationId)
    .order("assessed_at", { ascending: false })
    .limit(1)
    .maybeSingle() as { data: Assessment | null };

  // If no servers AND no assessment, show the empty state
  if ((serverCount ?? 0) === 0 && !assessment) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center p-6">
        <EmptyState {...EMPTY_STATES["compliance"]} />
      </main>
    );
  }

  // Resolve each control's live status from the DB assessment, falling back to default
  const controls = NSA_CONTROLS.map((ctrl) => {
    let passed: boolean;
    if (assessment && ctrl.id in assessment) {
      const val = assessment[ctrl.id as keyof Assessment];
      if (typeof val === "boolean") passed = val;
      else passed = ctrl.defaultStatus === "passed";
    } else {
      passed = ctrl.defaultStatus === "passed";
    }
    return { ...ctrl, passed };
  });

  // Separate active controls from roadmap controls
  const activeControls = controls.filter((c) => c.defaultStatus !== "roadmap");
  const roadmapControls = controls.filter((c) => c.defaultStatus === "roadmap");

  const passedCount = activeControls.filter((c) => c.passed).length;
  // Use DB score if available, otherwise compute from controls (excluding roadmap)
  const score = assessment?.overall_score ?? computeComplianceScore(controls);
  const failedControls = activeControls.filter((c) => !c.passed);
  const assessedAt = assessment?.assessed_at
    ? new Date(assessment.assessed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  // Fetch recent scan issues to compute OWASP MCP Top 10 pass/fail status
  const { data: recentIssues } = await svc
    .from("scan_issues")
    .select("type")
    .eq("organization_id", orgContext.organizationId);

  const issueTypes = (recentIssues ?? []).map((i: { type: string }) => i.type);
  const triggeredOwaspIds = getTriggeredOwaspIds(issueTypes);
  const owaspControls = getOwaspMcpControls(triggeredOwaspIds);

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-1">Compliance</p>
          <h1 className="text-2xl font-bold tracking-tight">NSA MCP Security CSI</h1>
          <p className="text-sm text-slate-500 mt-1">Document: U/OO/6030316-26</p>
        </div>
        {assessedAt && (
          <p className="text-xs text-slate-500 shrink-0 mt-1">Last assessed {assessedAt}</p>
        )}
      </div>

      {/* Notice when no assessment exists but servers exist — using platform defaults */}
      {!assessment && (
        <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
          <p className="text-sm text-slate-400">
            No assessment on record yet — scores below reflect platform defaults.
            Run a scan on one of your servers to generate a compliance assessment.
          </p>
        </div>
      )}

      {/* 3-column layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Col 1: Score + Badges + PDF */}
        <Card className="border-white/10 bg-bg-surface lg:col-span-1">
          <CardContent className="p-6 text-center space-y-4">
            <CircularProgress value={score} />
            <p className="text-sm text-slate-400">
              {passedCount} / {activeControls.length} controls active
            </p>
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              <Badge variant="outline" className="border-monitor/30 text-monitor text-xs">
                NSA MCP CSI
              </Badge>
              <Badge variant="outline" className="border-caution/30 text-caution text-xs">
                OWASP MCP Top 10
              </Badge>
            </div>

            {/* PDF report download if available */}
            {assessment?.pdf_report_url ? (
              <a href={assessment.pdf_report_url} target="_blank" rel="noopener noreferrer" className="block w-full">
                <Button variant="outline" className="border-white/10 gap-1.5 w-full">
                  <FileText className="size-3.5" />
                  Download PDF Report
                </Button>
              </a>
            ) : (
              <Link href="/compliance/reports" className="block w-full">
                <Button variant="outline" className="border-white/10 gap-1.5 w-full">
                  <FileText className="size-3.5" />
                  View Reports
                </Button>
              </Link>
            )}

            {/* Request PDF Report */}
            <RequestPdfButton />
          </CardContent>
        </Card>

        {/* Col 2: Framework Tabs (NSA + OWASP) */}
        <Card className="border-white/10 bg-bg-surface lg:col-span-1">
          <CardContent className="p-4">
            <FrameworkTabs nsaControls={controls} owaspControls={owaspControls} />
          </CardContent>
        </Card>

        {/* Col 3: Remediation */}
        <Card className="border-white/10 bg-bg-surface lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Remediation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {failedControls.length > 0 ? (
              failedControls.map((control) => (
                <div key={control.id} className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
                  <p className="text-sm font-medium text-slate-200">{control.label}</p>
                  <p className="text-xs text-slate-500">{control.action}</p>
                  {control.link && (
                    <a
                      href={control.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      View guidance <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm flex items-center gap-2" style={{ color: "var(--secure)" }}>
                <CheckCircle2 className="size-4" />
                All controls passing
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Coming Soon — Roadmap Controls */}
      {roadmapControls.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-slate-400 flex items-center gap-2">
            <Clock className="size-4" />
            Coming Soon
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {roadmapControls.map((control) => (
              <Card key={control.id} className="border-dashed border-white/10 bg-white/[0.02]">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-300">{control.label}</p>
                    <Badge variant="outline" className="border-purple-500/30 text-purple-400 text-[10px] shrink-0">
                      {control.deliveryDate ?? "TBD"}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500">{control.description}</p>
                  {control.link && (
                    <a
                      href={control.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                    >
                      Learn more <ExternalLink className="size-3" />
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </main>
  );
};

export default CompliancePage;
