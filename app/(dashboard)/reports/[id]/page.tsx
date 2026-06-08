import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ScanResults } from "@/components/scan-results";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import type { ScanResult } from "@/lib/scanner/types";

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

const ReportDetailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: scan } = await supabase
    .from("scans")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!scan) {
    notFound();
  }

  const scanRow = scan as unknown as ScanRow;
  const result = scanRow.results as ScanResult | null;

  return (
    <main className="flex flex-1 flex-col gap-8 p-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/reports">
            <ArrowLeft className="size-4" />
            Back to Reports
          </Link>
        </Button>
      </div>

      {result ? (
        <ScanResults result={result} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Could not load scan details for this report.
        </p>
      )}
    </main>
  );
};

export default ReportDetailPage;