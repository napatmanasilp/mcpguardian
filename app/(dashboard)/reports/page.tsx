import { Shield } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ReportSheetClient } from "@/components/reports/report-sheet-client";
import { createClient } from "@/lib/supabase/server";

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

const gradeBadgeVariant = (grade: string) => {
  if (grade === "A" || grade === "B") return "default" as const;
  return "destructive" as const;
};

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
  const { data: { user } } = await supabase.auth.getUser();

  let query = supabase
    .from("scans")
    .select("*", { count: "exact" })
    .eq("user_id", user!.id);

  if (gradeFilter && ["A", "B", "C", "D", "F"].includes(gradeFilter)) {
    query = query.eq("overall_grade", gradeFilter);
  }

  const { data: scans, count: totalCount } = await query
    .order("created_at", { ascending: false })
    .range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

  const totalPages = Math.ceil((totalCount || 0) / pageSize);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const buildPageUrl = (grade: string, page: number) => {
    const params = new URLSearchParams();
    if (grade) params.set("grade", grade);
    if (page > 1) params.set("page", String(page));
    const qs = params.toString();
    return qs ? `/reports?${qs}` : "/reports";
  };

  return (
    <main className="flex flex-1 flex-col gap-8 p-8">
      <div>
        <h1 className="text-xl font-semibold">Scan Reports</h1>
        <p className="text-muted-foreground">View and manage your security scan history</p>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">Filter by grade:</span>
        <div className="flex gap-2">
          {["", "A", "B", "C", "D", "F"].map((grade) => {
            const isActive = gradeFilter === grade;
            return (
              <Link
                key={grade}
                href={buildPageUrl(grade, 1)}
                className={`inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-input hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                {grade || "All Grades"}
              </Link>
            );
          })}
        </div>
      </div>

      {scans && scans.length > 0 ? (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Servers</TableHead>
                  <TableHead>Critical</TableHead>
                  <TableHead>High</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(scans as ScanRow[]).map((scan) => (
                  <TableRow key={scan.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDate(scan.created_at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={gradeBadgeVariant(scan.overall_grade)}>
                        {scan.overall_grade}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium tabular-nums">
                      {scan.overall_score}/100
                    </TableCell>
                    <TableCell>{scan.servers_scanned}</TableCell>
                    <TableCell className={scan.critical_issues > 0 ? "font-bold text-red-500" : ""}>
                      {scan.critical_issues}
                    </TableCell>
                    <TableCell className={scan.high_issues > 0 ? "font-bold text-orange-500" : ""}>
                      {scan.high_issues}
                    </TableCell>
                    <TableCell>
                      <ReportSheetClient
                        scanId={scan.id}
                        scanData={scan as unknown as ScanRow}
                        triggerLabel="View"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-center gap-4">
            <Link
              href={buildPageUrl(gradeFilter, currentPage - 1)}
              className={`inline-flex h-8 items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors ${
                currentPage <= 1
                  ? "pointer-events-none opacity-50"
                  : "bg-background text-foreground border-input hover:bg-accent"
              }`}
              aria-disabled={currentPage <= 1}
            >
              Previous
            </Link>
            <span className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <Link
              href={buildPageUrl(gradeFilter, currentPage + 1)}
              className={`inline-flex h-8 items-center justify-center rounded-md border px-3 text-sm font-medium transition-colors ${
                currentPage >= totalPages
                  ? "pointer-events-none opacity-50"
                  : "bg-background text-foreground border-input hover:bg-accent"
              }`}
              aria-disabled={currentPage >= totalPages}
            >
              Next
            </Link>
          </div>
        </>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <Shield className="size-12 text-muted-foreground/40" />
            <div>
              <p className="text-lg font-medium">No scan reports found</p>
              <p className="text-sm text-muted-foreground">
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