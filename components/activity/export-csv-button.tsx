"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { exportCsv } from "@/lib/utils/csv";
import type { MergedEvent } from "@/lib/types/activity";

interface ExportCsvButtonProps {
  events: MergedEvent[];
}

export function ExportCsvButton({ events }: ExportCsvButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => exportCsv(events)}
    >
      <Download className="size-4 mr-1.5" />
      Export CSV
    </Button>
  );
}
