"use client";

import { useState } from "react";
import { Bolt, X } from "lucide-react";
import Link from "next/link";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { openTopUpModal } from "@/lib/usage";

interface UpgradeBannerProps {
  scansThisMonth: number;
  checksPurchased?: number;
}

export const UpgradeBanner = ({
  scansThisMonth,
  checksPurchased = 0,
}: UpgradeBannerProps) => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const remaining = Math.max(0, 100 + checksPurchased - scansThisMonth);
  const isOverLimit = remaining === 0;

  return (
    <Alert className="rounded-none border-x-0 border-t-0 bg-amber-950/20 border-amber-500/20">
      <AlertDescription className="flex items-center justify-between gap-4">
        <span className="text-sm">
          {isOverLimit
            ? "You've used all your checks this month."
            : `You've used ${scansThisMonth} of ${100 + checksPurchased} checks this month.`}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          {!isOverLimit && (
            <Button
              variant="link"
              size="sm"
              className="h-auto px-0 text-amber-400 gap-1"
              onClick={() => openTopUpModal()}
            >
              <Bolt className="size-3" />
              Top Up
            </Button>
          )}
          <Button
            variant="link"
            size="sm"
            className="h-auto px-0 text-amber-400"
            asChild
          >
            <Link href="/billing/upgrade">Upgrade</Link>
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
