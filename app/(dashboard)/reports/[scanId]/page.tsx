import { ArrowLeft, RotateCcw } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { notFound, redirect } from "next/navigation";

import { SecurityGradeBadge } from "@/components/security-grade-badge";
import { ExportReportButton } from "@/components/reports/export-report-button";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import { createClient } from "@/lib/supabase/server";
import type { ScanResult } from "@/lib/scanner/types";
import type { SecurityGrade } from "@/lib/security-grade";

// Code-split: ScanResults is a very large client component (500+ lines).
// Requirement 20.1: code-split client components > 50 KB not needed on initial render
const ScanResults = dynamic(
  () => import("@/components/scan-results").then((mod) => mod.ScanResults),
  {
    loading: () => (
      <PageSkeleton blocks={[{ type: "chart", height: "16rem" }, { type: "table", height: "12rem" }]} />
    ),
  },
);

// ─── Types ─────────────────────────────────────────────────────────────

interface ScanRow {
  id: string;
  overall_grade: string;
  overall_score: number;
  servers_scanned: number;
  critical_issues: number;
  high_issues: number;
  results: unknown;
  created_at: string;
}

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

// ─── Component ─────────────────────────────────────────────────────────

const ReportDetailPage = async ({
  params,
}: {
  params: Promise<{ scanId: string }>;
}) => {
  const { scanId: id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Try scan_results first (free scan tool), fall back to scans (pipeline scans)
  let scan = null as ScanRow | null;

  const { data: scanResult } = await supabase
    .from("scan_results")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (scanResult) {
    scan = scanResult as unknown as ScanRow;
  } else {
    // Fall back to scans table for pipeline-based scans
    const { data: pipelineScan } = await supabase
      .from("scans")
      .select("*")
      .eq("id", id)
      .single();

    if (pipelineScan) {
      // Transform pipeline scan shape to ScanRow-compatible shape
      scan = {
        id: pipelineScan.id,
        overall_grade: pipelineScan.overall_result === 'clean' ? 'A' : pipelineScan.overall_result === 'suspicious' ? 'C' : pipelineScan.overall_result === 'malicious' ? 'F' : 'B',
        overall_score: pipelineScan.risk_score ?? 0,
        servers_scanned: 1,
        critical_issues: 0,
        high_issues: 0,
        results: pipelineScan.raw_output,
        created_at: pipelineScan.created_at,
      };
    }
  }

  if (!scan) {
    notFound();
  }

  const scanRow = scan as unknown as ScanRow;
  const result = scanRow.results as ScanResult | null;
  const { full: fullDate, time: timeStr } = formatDate(scanRow.created_at);

  return (
    <main className="flex flex-1 flex-col p-8">
      {/* ── Page Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pb-6 border-b border-white/10 mb-6">
        <div className="flex items-center gap-3">
          <Link href="/reports">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="size-4" />
              Reports
            </Button>
          </Link>
          <div className="w-px h-5 bg-white/10" />
          <div>
            <div className="flex items-center gap-2">
              <SecurityGradeBadge grade={scanRow.overall_grade as SecurityGrade} size="sm" />
              <span className="text-sm font-mono text-slate-400">
                Score: {scanRow.overall_score}/100
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Scanned {fullDate} at {timeStr}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {result && <ExportReportButton result={result} />}
          <Link href="/scan">
            <Button size="sm" className="gap-2">
              <RotateCcw className="size-4" />
              Re-scan
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Scan Results ─────────────────────────────────────────────── */}
      {result ? (
        <ScanResults result={result} />
      ) : (
        <p className="text-sm text-slate-400">
          Could not load scan details for this report.
        </p>
      )}
    </main>
  );
};

export default ReportDetailPage;
