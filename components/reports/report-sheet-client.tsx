"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { DynamicErrorBoundary } from "@/components/ui/dynamic-error-boundary";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { PageSkeleton } from "@/components/ui/page-skeleton";
import type { ScanResult } from "@/lib/scanner/types";

// Code-split: ScanResults is a very large client component (500+ lines with sub-components,
// accordion, dropdowns, charts). Only rendered when user opens the report sheet.
// Requirement 20.1: code-split client components > 50 KB not needed on initial render
// Requirement 20.5: handle dynamic import failure with inline error + retry
const ScanResults = dynamic(
  () => import("@/components/scan-results").then((mod) => mod.ScanResults),
  {
    ssr: false,
    loading: () => (
      <PageSkeleton blocks={[{ type: "chart", height: "16rem" }, { type: "table", height: "12rem" }]} />
    ),
  },
);

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
  scanData: ScanRow;
  triggerLabel?: string;
  triggerVariant?: "button" | "card";
  children?: React.ReactNode;
}

export const ReportSheetClient = ({
  scanData,
  triggerLabel = "View",
  triggerVariant = "button",
  children,
}: ReportSheetClientProps) => {
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
        {triggerVariant === "card" ? (
          children
        ) : (
          <Button variant="ghost" size="sm">
            {triggerLabel}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="mb-6">
          <SheetTitle>Scan Report &mdash; {dateStr}</SheetTitle>
        </SheetHeader>
        {result ? (
          <DynamicErrorBoundary componentName="Scan Results">
            <ScanResults result={result} />
          </DynamicErrorBoundary>
        ) : (
          <p className="text-sm text-muted-foreground">No results data available.</p>
        )}
      </SheetContent>
    </Sheet>
  );
};
