"use client";

import { cn } from "@/lib/utils";

export interface UsageMeterProps {
  /** Label describing the metric (e.g. "Scans", "Tool Calls") */
  label: string;
  /** Number of units consumed in the current period */
  used: number;
  /** Maximum allowance for the period, or null for unlimited */
  allowance: number | null;
  /** Fraction of allowance at which to show a warning color (default 0.8) */
  warningThreshold?: number;
}

/**
 * Reusable progress bar component for displaying usage against an allowance.
 * Color transitions: blue (<80%), amber (80-99%), red (>=100%).
 * Shows "Unlimited" when allowance is null.
 */
export function UsageMeter({
  label,
  used,
  allowance,
  warningThreshold = 0.8,
}: UsageMeterProps) {
  const isUnlimited = allowance === null;
  const percentage = isUnlimited ? 0 : Math.min(100, (used / allowance) * 100);
  const ratio = isUnlimited ? 0 : used / allowance;

  // Determine bar color based on thresholds
  const barColor =
    isUnlimited || ratio < warningThreshold
      ? "bg-monitor"
      : ratio < 1
        ? "bg-caution"
        : "bg-threat";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">
          {isUnlimited ? (
            "Unlimited"
          ) : (
            <>
              {used.toLocaleString()} / {allowance.toLocaleString()}
            </>
          )}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${label} usage`}
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={allowance ?? undefined}
        className="relative h-2 w-full overflow-hidden rounded-full bg-secondary"
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            barColor
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
