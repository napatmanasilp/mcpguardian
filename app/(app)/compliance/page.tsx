import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, ExternalLink, FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cn } from "@/lib/utils";

const NSA_CONTROLS = [
  { id: "param_validation", label: "Parameter validation", status: "passed", description: "InboundScanner + Schema validation", action: "Maintain current InboundScanner configuration" },
  { id: "sandboxing", label: "Tool execution sandboxing", status: "passed", description: "Docker sandbox (Dockerfile.scanner-probe)", action: "Ensure sandbox image is up to date" },
  { id: "signing", label: "Signing and verifying messages", status: "roadmap", description: "Roadmap Q3 2026", action: "No action required until feature ships", link: "https://docs.mcpguardian.com/roadmap" },
  { id: "filtering", label: "Filtering chained outputs", status: "passed", description: "OutboundScanner + response filtering", action: "Verify OutboundScanner rules are active" },
  { id: "tool_logging", label: "Logging all tool invocations", status: "passed", description: "tool_invocation_logs (immutable)", action: "Verify audit trail retention policy" },
  { id: "model_logging", label: "Logging all model invocations", status: "passed", description: "Proxy session logging", action: "Confirm session logging is enabled" },
  { id: "unauth_scanning", label: "Scanning for unauthorized servers", status: "passed", description: "MCP server allowlist + scan pipeline", action: "Review allowlist periodically" },
  { id: "least_privilege", label: "Least-privilege token enforcement", status: "passed", description: "Token guard + permission_set per session", action: "Review permission sets" },
  { id: "access_controls", label: "Weak access controls", status: "passed", description: "Supabase Auth + RLS + org isolation", action: "Audit team members quarterly" },
  { id: "sparse_logging", label: "Sparse logging remediation", status: "passed", description: "Full audit trail + 7yr retention", action: "Verify retention compliance" },
];

function CircularProgress({ value, size = 140, strokeWidth = 10 }: { value: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const color = value >= 80 ? "#34d399" : value >= 60 ? "#fbbf24" : "#f87171";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const svc = createServiceClient();
  const { data: membership } = await svc
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("invitation_status", "accepted")
    .single();

  if (!membership) redirect("/onboarding");

  const { data: assessment } = await svc
    .from("nsa_compliance_assessments")
    .select("*")
    .eq("organization_id", membership.organization_id)
    .order("assessed_at", { ascending: false })
    .limit(1)
    .single();

  const passed = NSA_CONTROLS.filter((c) => c.status === "passed").length;
  const score = Math.round((passed / NSA_CONTROLS.length) * 100);
  const failedControls = NSA_CONTROLS.filter((c) => c.status !== "passed");

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-1">Compliance</p>
        <h1 className="text-2xl font-bold tracking-tight">NSA MCP Security CSI</h1>
        <p className="text-sm text-slate-500 mt-1">Document: U/OO/6030316-26</p>
      </div>

      {/* 3-column layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Col 1: Score + Badges */}
        <Card className="border-white/10 bg-bg-surface lg:col-span-1">
          <CardContent className="p-6 text-center space-y-4">
            <CircularProgress value={score} />
            <p className="text-sm text-slate-400">Overall Score</p>
            {/* Framework badges */}
            <div className="flex flex-wrap gap-2 mt-4 justify-center">
              <Badge variant="outline" className="border-blue-500/30 text-blue-400 text-xs">
                NSA MCP CSI
              </Badge>
              <Badge variant="outline" className="border-orange-500/30 text-orange-400 text-xs">
                OWASP MCP Top 10
              </Badge>
            </div>
            <Link href="/compliance/reports">
              <Button variant="outline" className="border-white/10 gap-1.5 w-full">
                <FileText className="size-3.5" />
                View Reports
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Col 2: Controls List */}
        <Card className="border-white/10 bg-bg-surface lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">NSA Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {NSA_CONTROLS.map((control) => (
              <div key={control.id} className="flex items-center gap-3 rounded-md bg-white/5 px-3 py-2">
                {control.status === "passed" ? (
                  <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                ) : (
                  <span className="size-4 flex items-center justify-center text-amber-400 shrink-0 text-xs">○</span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-300">{control.label}</p>
                  <p className="text-[10px] text-slate-500">{control.description}</p>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[9px] shrink-0",
                    control.status === "passed" ? "border-emerald-500/30 text-emerald-400" : "border-amber-500/30 text-amber-400",
                  )}
                >
                  {control.status === "passed" ? "Active" : "Roadmap"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Col 3: Remediation Actions */}
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
              <p className="text-sm text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="size-4" />
                All controls passing
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default CompliancePage;
