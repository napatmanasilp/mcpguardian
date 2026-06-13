import type { Metadata } from "next";
import Link from "next/link";
import dynamic from "next/dynamic";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { MiniScoreRing } from "@/components/scan/mini-score-ring";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { cn } from "@/lib/utils";
import type { Grade, ScanResult } from "@/lib/scanner/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ scanId: string }>;
}): Promise<Metadata> {
  const { scanId } = await params;
  const shortId = scanId.slice(0, 8);
  return {
    title: `Scan ${shortId}… — Reports — MCPGuardian`,
    description: `Detailed scan report and findings for scan ${shortId}.`.slice(0, 160),
  };
}

// Code-split: ScanResults is a very large client component (500+ lines with sub-components).
// Requirement 20.1: code-split client components > 50 KB not needed on initial render
const ScanResults = dynamic(
  () => import("@/components/scan-results").then((mod) => mod.ScanResults),
  {
    loading: () => (
      <PageSkeleton blocks={[{ type: "chart", height: "16rem" }, { type: "table", height: "12rem" }]} />
    ),
  },
);

// ─── Helpers ───────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  return {
    full: date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

function mapOverallResultToGrade(overallResult: string | null): Grade {
  switch (overallResult) {
    case "clean":
      return "A";
    case "suspicious":
      return "C";
    case "malicious":
      return "F";
    default:
      return "B";
  }
}

// ─── Page Component ────────────────────────────────────────────────────

const ScanReportPage = async ({
  params,
}: {
  params: Promise<{ scanId: string }>;
}) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  // Fetch scan record scoped to the user's organization
  const { data: scan } = await svc
    .from("scans")
    .select("*")
    .eq("id", scanId)
    .eq("organization_id", membership.organization_id)
    .maybeSingle();

  if (!scan) {
    notFound();
  }

  // Parse the scan result data
  const result = scan.raw_output as ScanResult | null;
  const grade = mapOverallResultToGrade(scan.overall_result);
  const score = scan.overall_score ?? scan.risk_score ?? 0;
  const { full: fullDate, time: timeStr } = formatDate(scan.created_at);

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link href="/servers" className="hover:text-slate-300 transition-colors">
          Servers
        </Link>
        <span>/</span>
        <span className="text-slate-300">Scan Report</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <MiniScoreRing grade={grade} score={score} size={48} />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Scan Report
              </h1>
              <p className="text-sm text-slate-500">
                Scanned {fullDate} at {timeStr}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
            <span
              className={cn(
                "font-mono font-bold",
                score >= 80
                  ? "text-emerald-400"
                  : score >= 60
                    ? "text-amber-400"
                    : "text-red-400"
              )}
            >
              Score: {score}/100
            </span>
            <span className="capitalize">
              Result: {scan.overall_result ?? "unknown"}
            </span>
            {scan.servers_scanned && (
              <span>Servers: {scan.servers_scanned}</span>
            )}
            {scan.trigger_reason && (
              <span>Trigger: {scan.trigger_reason}</span>
            )}
          </div>
        </div>
        <Link href="/servers">
          <Button
            variant="outline"
            size="sm"
            className="border-white/10 gap-1.5"
          >
            <ArrowLeft className="size-3.5" />
            Back to servers
          </Button>
        </Link>
      </div>

      {/* Full Scan Results */}
      {result ? (
        <ScanResults result={result} />
      ) : (
        <div className="rounded-lg border border-white/10 bg-white/5 p-6 text-center">
          <p className="text-sm text-slate-400">
            Detailed scan results are not available for this report.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <p className="text-lg font-bold font-mono text-slate-200">
                {score}/100
              </p>
              <p className="text-[10px] text-slate-500">Overall Score</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <p className="text-lg font-bold font-mono text-slate-200 capitalize">
                {scan.overall_result ?? "unknown"}
              </p>
              <p className="text-[10px] text-slate-500">Result</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <p className="text-lg font-bold font-mono text-slate-200">
                {scan.risk_score ?? "—"}
              </p>
              <p className="text-[10px] text-slate-500">Risk Score</p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default ScanReportPage;
