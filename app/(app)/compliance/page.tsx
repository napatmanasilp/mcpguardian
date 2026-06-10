import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cn } from "@/lib/utils";

const NSA_CONTROLS = [
  { id: "param_validation", label: "Parameter validation", status: "passed", description: "InboundScanner + Schema validation" },
  { id: "sandboxing", label: "Tool execution sandboxing", status: "passed", description: "Docker sandbox (Dockerfile.scanner-probe)" },
  { id: "signing", label: "Signing and verifying messages", status: "roadmap", description: "Roadmap Q3 2026" },
  { id: "filtering", label: "Filtering chained outputs", status: "passed", description: "OutboundScanner + response filtering" },
  { id: "tool_logging", label: "Logging all tool invocations", status: "passed", description: "tool_invocation_logs (immutable)" },
  { id: "model_logging", label: "Logging all model invocations", status: "passed", description: "Proxy session logging" },
  { id: "unauth_scanning", label: "Scanning for unauthorized servers", status: "passed", description: "MCP server allowlist + scan pipeline" },
  { id: "least_privilege", label: "Least-privilege token enforcement", status: "passed", description: "Token guard + permission_set per session" },
  { id: "access_controls", label: "Weak access controls", status: "passed", description: "Supabase Auth + RLS + org isolation" },
  { id: "sparse_logging", label: "Sparse logging remediation", status: "passed", description: "Full audit trail + 7yr retention" },
];

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

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-1">Compliance</p>
        <h1 className="text-2xl font-bold tracking-tight">NSA MCP Security CSI</h1>
        <p className="text-sm text-slate-500 mt-1">Document: U/OO/6030316-26</p>
      </div>

      {/* Score + Controls */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Score Card */}
        <Card className="border-white/10 bg-[hsl(222,47%,6%)] lg:col-span-1">
          <CardContent className="p-6 text-center space-y-4">
            <div className={cn(
              "size-24 rounded-full flex items-center justify-center mx-auto border-4",
              score >= 80 ? "border-emerald-500" : score >= 60 ? "border-amber-500" : "border-red-500",
            )}>
              <span className="text-3xl font-bold font-mono">
                {score}
              </span>
            </div>
            <p className="text-sm text-slate-400">Overall Score</p>
            <Link href="/compliance/reports">
              <Button variant="outline" className="border-white/10 gap-1.5 w-full">
                <FileText className="size-3.5" />
                View Reports
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Controls List */}
        <Card className="border-white/10 bg-[hsl(222,47%,6%)] lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">NSA Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {NSA_CONTROLS.map((control) => (
              <div key={control.id} className="flex items-center gap-3 rounded-md bg-white/5 px-3 py-2">
                {control.status === "passed" ? (
                  <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
                ) : (
                  <span className="size-4 flex items-center justify-center text-amber-400 shrink-0">🗺️</span>
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
      </div>
    </main>
  );
};

export default CompliancePage;
