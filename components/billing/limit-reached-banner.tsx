"use client";

import { useState } from "react";
import { AlertTriangle, Bolt, X } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { openTopUpModal } from "@/lib/usage";

interface LimitReachedBannerProps {
  plan: string;
  checksUsed: number;
  checksIncluded: number;
  percentUsed: number;
  overageEnabled: boolean;
  overageRate: number;
  overageChecks: number;
  overageCostUsd: number;
}

export const LimitReachedBanner = ({
  plan,
  checksUsed,
  checksIncluded,
  percentUsed,
  overageEnabled,
  overageRate,
  overageChecks,
  overageCostUsd,
}: LimitReachedBannerProps) => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  if (percentUsed < 80 && overageChecks === 0) return null;

  // State A: Approaching limit (80-99%)
  if (percentUsed >= 80 && percentUsed < 100 && !overageEnabled) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/8 p-4 flex items-start gap-3">
        <AlertTriangle className="size-5 shrink-0 text-amber-400 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-300">
            You&apos;ve used {checksUsed} of your {checksIncluded} free checks
            this month.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="xs" variant="outline" className="gap-1" onClick={() => openTopUpModal()}>
              <Bolt className="size-3" />
              Top Up &mdash; from $5
            </Button>
            <Button size="xs" variant="default" asChild>
              <Link href="/billing/upgrade">Upgrade to Developer &mdash; $19/mo</Link>
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  // State C: Overage active for paid plans
  if (overageEnabled && overageChecks > 0) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/8 p-4 flex items-start gap-3">
        <AlertTriangle className="size-5 shrink-0 text-amber-400 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-300">
            Overage active &mdash; ${overageRate.toFixed(3)}/check beyond your{" "}
            {checksIncluded.toLocaleString()} included.
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            So far this month: {overageChecks} overage checks = $
            {overageCostUsd.toFixed(2)}
          </p>
          <div className="mt-2">
            <Button size="xs" variant="outline" asChild>
              <Link href="/billing/upgrade">
                Upgrade to reduce cost &rarr;
              </Link>
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  // Approaching limit for paid plans (80%)
  if (percentUsed >= 80 && percentUsed < 100 && overageEnabled) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/8 p-4 flex items-start gap-3">
        <AlertTriangle className="size-5 shrink-0 text-amber-400 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-300">
            You&apos;ve used {checksUsed} of your {checksIncluded.toLocaleString()}{" "}
            {plan === "developer"
              ? "Developer"
              : plan === "team"
                ? "Team"
                : "Startup"}{" "}
            checks.
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Overage kicks in after {checksIncluded.toLocaleString()} at $
            {overageRate.toFixed(3)}/check.
          </p>
          <div className="mt-2">
            <Button size="xs" variant="outline" asChild>
              <Link href="/billing/upgrade">Upgrade to next plan &rarr;</Link>
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return null;
};
