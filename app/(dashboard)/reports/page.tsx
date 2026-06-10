import { ArrowRight, Plus, Shield } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ReportSheetClient } from "@/components/reports/report-sheet-client";
import { SecurityGradeBadge } from "@/components/security-grade-badge";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { SecurityGrade } from "@/lib/security-grade";

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

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// ─── Component ─────────────────────────────────────────────────────────

const ReportsPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string; page?: string }>;
}) => {
  const params = await searchParams;
  const gradeFilter = params.grade || "";
  const currentPage = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const pageSize = 10;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let query = supabase
    .from("scan_results")
    .select("*", { count: "exact" })
    .eq("user_id", user!.id);

  if (gradeFilter && ["A", "B", "C", "D", "F"].includes(gradeFilter)) {
    query = query.eq("overall_grade", gradeFilter);
  }

  const { data: scans, count: totalCount } = await query
    .order("created_at", { ascending: false })
    .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

  const totalPages = Math.ceil((totalCount || 0) / pageSize);
  const gradeList = ["All", "A", "B", "C", "D", "F"];

  const buildUrl = (grade: string, page: number) => {
    const p = new URLSearchParams();
    if (grade && grade !== "All") p.set("grade", grade);
    if (page > 1) p.set("page", String(page));
    const qs = p.toString();
    return qs ? `/reports?${qs}` : "/reports";
  };

  const GRADE_BG: Record<string, string> = {
    A: "bg-emerald-500",
    B: "bg-blue-500",
    C: "bg-amber-500",
    D: "bg-orange-500",
    F: "bg-red-500",
    All: "bg-white/15",
  };

  return (
    <main className="flex flex-1 flex-col gap-8 p-8">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Scan Reports</h1>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            {totalCount ?? 0} report{(totalCount ?? 0) !== 1 ? "s" : ""}
            {totalPages > 1 && ` — showing page ${currentPage} of ${totalPages}`}
          </p>
        </div>
        <Link href="/scan">
          <Button size="sm" className="gap-2">
            <Plus className="size-4" />
            New Scan
          </Button>
        </Link>
      </div>

      {/* ── Grade Filter Button Group ────────────────────────────────── */}
      <div className="flex items-center gap-1 p-1 rounded-lg border border-white/10 bg-white/[0.03] w-fit">
        {gradeList.map((grade) => {
          const isActive =
            gradeFilter === grade || (grade === "All" && !gradeFilter);
          return (
            <Link
              key={grade}
              href={buildUrl(grade, 1)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-mono font-bold transition-all",
                isActive
                  ? cn("text-white shadow-sm", GRADE_BG[grade] ?? "bg-white/15")
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5",
              )}
            >
              {grade}
            </Link>
          );
        })}
      </div>

      {/* ── Scan Cards ───────────────────────────────────────────────── */}
      {scans && scans.length > 0 ? (
        <>
          <div className="space-y-3">
            {(scans as ScanRow[]).map((scan) => (
              <ReportSheetClient
                key={scan.id}
                scanData={scan as unknown as ScanRow}
                triggerVariant="card"
              >
                <div className="rounded-lg border border-white/10 bg-[hsl(222,47%,6%)] p-4 flex items-center gap-4 hover:bg-white/[0.02] hover:border-white/15 transition-all cursor-pointer group w-full">
                  {/* Grade ring */}
                  <SecurityGradeBadge
                    grade={scan.overall_grade as SecurityGrade}
                    size="md"
                  />

                  {/* Score + date + meta */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-bold text-slate-200 tabular-nums">
                        {scan.overall_score}/100
                      </span>
                      <span className="text-xs text-slate-500">
                        {relativeTime(scan.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-slate-400">
                        {scan.servers_scanned} server
                        {scan.servers_scanned !== 1 ? "s" : ""}
                      </span>
                      {scan.critical_issues > 0 && (
                        <span className="text-xs font-mono text-red-400">
                          {scan.critical_issues} critical
                        </span>
                      )}
                      {scan.critical_issues === 0 && scan.high_issues > 0 && (
                        <span className="text-xs font-mono text-orange-400">
                          {scan.high_issues} high
                        </span>
                      )}
                    </div>
                  </div>

                  {/* View arrow */}
                  <ArrowRight className="size-4 text-slate-600 group-hover:text-blue-400 transition-colors flex-shrink-0" />
                </div>
              </ReportSheetClient>
            ))}
          </div>

          {/* ── Pagination ──────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4">
              <Link
                href={buildUrl(gradeFilter, currentPage - 1)}
                className={cn(
                  "inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs font-medium transition-colors",
                  currentPage <= 1
                    ? "pointer-events-none opacity-50 border-white/10 text-slate-600"
                    : "border-white/10 text-slate-400 hover:bg-white/5 hover:text-slate-200",
                )}
                aria-disabled={currentPage <= 1}
              >
                Previous
              </Link>
              <span className="text-xs text-slate-500 font-mono">
                Page {currentPage} of {totalPages}
              </span>
              <Link
                href={buildUrl(gradeFilter, currentPage + 1)}
                className={cn(
                  "inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs font-medium transition-colors",
                  currentPage >= totalPages
                    ? "pointer-events-none opacity-50 border-white/10 text-slate-600"
                    : "border-white/10 text-slate-400 hover:bg-white/5 hover:text-slate-200",
                )}
                aria-disabled={currentPage >= totalPages}
              >
                Next
              </Link>
            </div>
          )}
        </>
      ) : (
        /* ── Empty State ──────────────────────────────────────────────── */
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <Shield className="size-12 text-slate-600/40" />
            <div>
              <p className="text-lg font-medium text-slate-200">No scan reports found</p>
              <p className="text-sm text-slate-400">
                {gradeFilter
                  ? "Try changing the filter"
                  : "Run your first scan to check your MCP configuration"}
              </p>
            </div>
            {!gradeFilter && (
              <Button asChild>
                <Link href="/scan">Run your first scan</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
};

export default ReportsPage;
