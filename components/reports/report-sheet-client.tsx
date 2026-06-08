"use client";

import { useState } from "react";
import { ScanResults } from "@/components/scan-results";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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

interface ReportSheetClientProps {
  scanId: string;
  scanData: ScanRow;
  triggerLabel: string;
}

export const ReportSheetClient = ({ scanId, scanData, triggerLabel }: ReportSheetClientProps) => {
  const [open, setOpen] = useState(false);

  const result = scanData.results as ScanResult | null;

  const dateStr = new Date(scanData.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm">
          {triggerLabel}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="mb-6">
          <SheetTitle>Scan Report &mdash; {dateStr}</SheetTitle>
        </SheetHeader>
        {result ? (
          <ScanResults result={result} />
        ) : (
          <p className="text-sm text-muted-foreground">No results data available.</p>
        )}
      </SheetContent>
    </Sheet>
  );
};