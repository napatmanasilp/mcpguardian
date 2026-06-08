"use client";

import { useState } from "react";
import Link from "next/link";
import { Info, X } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface UpgradeBannerProps {
  scansThisMonth: number;
}

export const UpgradeBanner = ({ scansThisMonth }: UpgradeBannerProps) => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <Alert className="rounded-none border-x-0 border-t-0 bg-indigo-50 dark:bg-indigo-950/30">
      <Info className="size-4 text-indigo-500" />
      <AlertDescription className="flex items-center justify-between gap-4">
        <span>
          You&apos;ve used {scansThisMonth} of 3 free scans this month. Upgrade to Pro for unlimited scans.
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="link" size="sm" className="h-auto px-0 text-indigo-600 dark:text-indigo-400" asChild>
            <Link href="/pricing">Upgrade</Link>
          </Button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="size-4" />
          </button>
        </div>
      </AlertDescription>
    </Alert>
  );
};