import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";

export function NSAComplianceTeaser() {
  return (
    <div className="rounded-lg border border-white/10 bg-bg-surface p-4">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[var(--monitor)]" />
        <div className="flex flex-1 flex-col gap-2">
          <p className="text-sm font-medium text-slate-200">
            NSA MCP Security CSI — 8 controls
          </p>
          <Button size="sm" variant="outline" className="w-fit border-white/10" asChild>
            <Link href="/upgrade">
              Upgrade to unlock full compliance reporting
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
