"use client";

import { Bolt, ChevronRight, Zap } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  canScan,
  getOverageRateDisplay,
  getPlanDisplayName,
  getUsageColor,
  getUsageTextColor,
  openTopUpModal,
  useUsage,
} from "@/lib/usage";
import { cn } from "@/lib/utils";

export const UsageCard = () => {
  const { usage, loading } = useUsage();

  if (loading) {
    return (
      <Card className="border-white/10 bg-[hsl(222,47%,6%)]">
        <CardContent className="p-5">
          <div className="h-20 animate-pulse rounded-md bg-muted/30" />
        </CardContent>
      </Card>
    );
  }

  if (!usage) return null;

  const percent = Math.min(usage.percentUsed, 100);
  const isOverLimit =
    usage.checksUsed >= usage.checksIncluded + usage.checksPurchased;
  const barColor = getUsageColor(percent);
  const month = new Date().toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
  const resetDays = Math.max(
    0,
    Math.ceil(
      (new Date(usage.resetDate).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24),
    ),
  );

  return (
    <Card
      className={cn(
        "border-white/10 bg-[hsl(222,47%,6%)]",
        isOverLimit && "border-red-500/30",
      )}
    >
      <CardContent className="p-5">
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-blue-400" />
            <span className="text-sm font-semibold text-slate-200">
              Usage — {month}
            </span>
          </div>
          <Badge
            variant={usage.plan === "free" ? "outline" : "default"}
            className="text-[10px]"
          >
            {getPlanDisplayName(usage.plan)} Plan
          </Badge>
        </div>

        {/* Included checks bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Included checks</span>
            <span className="font-mono tabular-nums text-slate-300">
              {usage.checksUsed.toLocaleString()} /{" "}
              {usage.checksIncluded === -1
                ? "Unlimited"
                : usage.checksIncluded.toLocaleString()}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                barColor,
                percent >= 100 && "animate-pulse",
              )}
              style={{
                width: `${Math.min(
                  (usage.checksUsed / Math.max(usage.checksIncluded, 1)) *
                    100,
                  100,
                )}%`,
              }}
            />
          </div>
        </div>

        {/* Top-up credits row (Free only) */}
        {usage.plan === "free" && (
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Top-up credits</span>
              <span className="font-mono tabular-nums text-slate-300">
                {usage.checksPurchased === 0
                  ? "0 / 0"
                  : `${Math.max(0, usage.checksPurchased).toLocaleString()} available`}
              </span>
            </div>
            {usage.checksPurchased > 0 && (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-purple-500 transition-all duration-500"
                  style={{
                    width: `${Math.min((usage.checksUsed / Math.max(usage.checksIncluded + usage.checksPurchased, 1)) * 100, 100)}%`,
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Overage row (paid plans) */}
        {usage.overageEnabled && (
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-slate-400">Overage rate</span>
            <span className="font-mono text-slate-300">
              {getOverageRateDisplay(usage.plan, usage.overageRate)}
              {usage.overageChecks > 0 && (
                <span className="ml-1 text-amber-400">
                  ({usage.overageChecks} checks = $
                  {usage.overageCostUsd.toFixed(2)})
                </span>
              )}
            </span>
          </div>
        )}

        {/* Reset info */}
        <p className="mt-2 text-[10px] text-slate-500">
          Resets in {resetDays} day{resetDays !== 1 ? "s" : ""}
        </p>

        {/* Action buttons */}
        <div className="mt-4 flex flex-wrap gap-2">
          {usage.plan === "free" && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => openTopUpModal()}
            >
              <Bolt className="size-3.5" />
              Buy Top-Up Credits
            </Button>
          )}
          {usage.plan !== "enterprise" && (
            <Button size="sm" className="gap-1.5" asChild>
              <Link href="/billing/upgrade">
                <ChevronRight className="size-3.5" />
                Upgrade Plan
              </Link>
            </Button>
          )}
          {usage.plan === "enterprise" && (
            <Button variant="outline" size="sm" asChild>
              <Link href="/settings">Manage Plan</Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
