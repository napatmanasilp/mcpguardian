import Link from "next/link";
import { ScanSearch } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function ScanReportNotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center p-6 text-center">
      <ScanSearch className="size-12 text-slate-600 mb-4" />
      <h2 className="text-lg font-semibold text-slate-300 mb-1">
        Scan report not found
      </h2>
      <p className="text-sm text-slate-500 mb-6">
        This scan report doesn&apos;t exist or you don&apos;t have access to it.
      </p>
      <Link href="/servers">
        <Button variant="outline" className="border-white/10">
          Back to servers
        </Button>
      </Link>
    </main>
  );
}
