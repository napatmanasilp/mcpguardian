import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, AlertTriangle, ShieldCheck, ShieldAlert, Info, Clock, Server } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ scanId: string }>;
}): Promise<Metadata> {
  const { scanId } = await params;
  const shortId = scanId.slice(0, 8);
  return {
    title: `Scan ${shortId}… — Reports — MCPGuardian`,
    description: `Detailed scan report and findings for scan ${shortId}.`,
  };
}

interface Finding {
  type: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  title: string;
  description: string;
  fix: string;
  deduction: number;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const severityConfig = {
  CRITICAL: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", icon: ShieldAlert },
  HIGH: { color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", icon: AlertTriangle },
  MEDIUM: { color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", icon: Info },
  LOW: { color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/20", icon: Info },
};

const ScanReportPage = async ({
  params,
}: {
  params: Promise<{ scanId: string }>;
}) => {
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

  const { scanId } = await params;

  const { data: scan } = await svc
    .from("scans")
    .select("*")
    .eq("id", scanId)
    .eq("organization_id", membership.organization_id)
    .maybeSingle();

  if (!scan) notFound();

  // Get the server name
  let serverName = "Unknown server";
  if (scan.mcp_server_id) {
    const { data: server } = await svc
      .from("mcp_servers")
      .select("name, endpoint_url, transport_type")
      .eq("id", scan.mcp_server_id)
      .maybeSingle();
    if (server) serverName = server.name;
  }

  const findings = (scan.findings ?? []) as Finding[];
  const riskScore = scan.risk_score ?? 0;
  const safetyScore = Math.max(0, 100 - riskScore);
  const status = scan.status;
  const overallResult = scan.overall_result;
  const durationMs = scan.duration_ms;

  // Count by severity
  const critical = findings.filter((f) => f.severity === "CRITICAL").length;
  const high = findings.filter((f) => f.severity === "HIGH").length;
  const medium = findings.filter((f) => f.severity === "MEDIUM").length;
  const low = findings.filter((f) => f.severity === "LOW").length;

  // Sort: CRITICAL first, then HIGH, MEDIUM, LOW
  const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  const sortedFindings = [...findings].sort(
    (a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4)
  );

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/servers" className="hover:text-slate-300 transition-colors">Servers</Link>
        <span>/</span>
        <Link href={scan.mcp_server_id ? `/servers/${scan.mcp_server_id}` : "/servers"} className="hover:text-slate-300 transition-colors">
          {serverName}
        </Link>
        <span>/</span>
        <span className="text-slate-300">Scan Report</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Scan Report</h1>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <Server className="size-3" />
              <span>{serverName}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="size-3" />
              <span>{timeAgo(scan.created_at)}</span>
            </div>
            {durationMs && (
              <span>Duration: {durationMs}ms</span>
            )}
            {scan.trigger_reason && (
              <Badge variant="outline" className="text-[9px] border-white/10">{scan.trigger_reason}</Badge>
            )}
          </div>
        </div>
        <Link href={scan.mcp_server_id ? `/servers/${scan.mcp_server_id}` : "/servers"}>
          <Button variant="outline" size="sm" className="border-white/10 gap-1.5">
            <ArrowLeft className="size-3.5" />
            Back
          </Button>
        </Link>
      </div>

      {/* Score Overview */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-5">
        <Card className={cn(
          "border-white/10 col-span-2 sm:col-span-1",
          riskScore > 60 ? "bg-red-500/5" : riskScore > 30 ? "bg-amber-500/5" : "bg-emerald-500/5"
        )}>
          <CardContent className="p-4 text-center">
            <p className={cn(
              "text-3xl font-bold font-mono",
              riskScore > 60 ? "text-red-400" : riskScore > 30 ? "text-amber-400" : "text-emerald-400"
            )}>
              {safetyScore}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">Safety Score</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
          <CardContent className="p-4 text-center">
            <p className="text-lg font-bold font-mono text-red-400">{critical}</p>
            <p className="text-[10px] text-slate-500">Critical</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
          <CardContent className="p-4 text-center">
            <p className="text-lg font-bold font-mono text-orange-400">{high}</p>
            <p className="text-[10px] text-slate-500">High</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
          <CardContent className="p-4 text-center">
            <p className="text-lg font-bold font-mono text-amber-400">{medium}</p>
            <p className="text-[10px] text-slate-500">Medium</p>
          </CardContent>
        </Card>
        <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
          <CardContent className="p-4 text-center">
            <p className="text-lg font-bold font-mono text-slate-400">{low}</p>
            <p className="text-[10px] text-slate-500">Low</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Banner */}
      {status === "completed" && (
        <Card className={cn(
          "border-white/10",
          overallResult === "clean" ? "bg-emerald-500/5 border-emerald-500/20" :
          overallResult === "malicious" ? "bg-red-500/5 border-red-500/20" :
          "bg-amber-500/5 border-amber-500/20"
        )}>
          <CardContent className="p-4 flex items-center gap-3">
            {overallResult === "clean" ? (
              <ShieldCheck className="size-5 text-emerald-400" />
            ) : (
              <ShieldAlert className={cn("size-5", overallResult === "malicious" ? "text-red-400" : "text-amber-400")} />
            )}
            <div>
              <p className="text-sm font-medium text-slate-200">
                {overallResult === "clean" && "No significant security issues found"}
                {overallResult === "suspicious" && "Potential security concerns detected"}
                {overallResult === "malicious" && "Critical security threats identified"}
                {!overallResult && `Scan ${status}`}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {findings.length === 0 ? "No findings to report." : `${findings.length} finding${findings.length > 1 ? "s" : ""} identified across the scan.`}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {status !== "completed" && (
        <Card className="border-white/10 bg-blue-500/5 border-blue-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="size-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-slate-200">
              Scan is {status}. Results will appear once the scan completes.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Findings List */}
      {sortedFindings.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-300">Findings</h2>
          {sortedFindings.map((finding, i) => {
            const config = severityConfig[finding.severity] ?? severityConfig.LOW;
            const Icon = config.icon;
            return (
              <Card key={i} className={cn("border-white/10", config.bg, config.border)}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Icon className={cn("size-4 mt-0.5 shrink-0", config.color)} />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn("text-[9px]", config.color, config.border)}>
                          {finding.severity}
                        </Badge>
                        <span className="text-xs text-slate-500 font-mono">{finding.type}</span>
                        {finding.deduction > 0 && (
                          <span className="text-[10px] text-slate-500">-{finding.deduction} pts</span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-slate-200">{finding.title}</p>
                      <p className="text-xs text-slate-400 leading-relaxed">{finding.description}</p>
                      {finding.fix && (
                        <div className="mt-2 rounded-md bg-white/5 border border-white/10 px-3 py-2">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Recommendation</p>
                          <p className="text-xs text-slate-300">{finding.fix}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {sortedFindings.length === 0 && status === "completed" && (
        <Card className="border-white/10 bg-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-8 text-center">
            <ShieldCheck className="size-12 text-emerald-400 mx-auto mb-3" />
            <p className="text-lg font-medium text-slate-200">All clear</p>
            <p className="text-sm text-slate-500 mt-1">No security issues were found during this scan.</p>
          </CardContent>
        </Card>
      )}

      {/* Metadata */}
      <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">Scan Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <p className="text-slate-500">Scan ID</p>
              <p className="font-mono text-slate-400 truncate">{scanId.slice(0, 12)}…</p>
            </div>
            <div>
              <p className="text-slate-500">Status</p>
              <p className="text-slate-300 capitalize">{status}</p>
            </div>
            <div>
              <p className="text-slate-500">Trigger</p>
              <p className="text-slate-300 capitalize">{scan.trigger_reason ?? "—"}</p>
            </div>
            <div>
              <p className="text-slate-500">Created</p>
              <p className="text-slate-300">{new Date(scan.created_at).toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </main>
  );
};

export default ScanReportPage;
