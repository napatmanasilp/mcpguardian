"use client";

import { useEffect, useState } from "react";
import { Bolt, ChevronUp, Zap } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  canScan,
  getPlanDisplayName,
  getUsageColor,
  getUsageTextColor,
  openTopUpModal,
  useUsage,
} from "@/lib/usage";
import { cn } from "@/lib/utils";

export const UsageSidebarWidget = () => {
  const { usage, loading } = useUsage();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
  }, []);

  if (loading || !usage) return null;

  // Enterprise: hide or show unlimited
  if (usage.plan === "enterprise") {
    return (
      <div className="border-t border-sidebar-border p-3">
        <div className="rounded-md bg-muted/30 px-3 py-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Zap className="size-3.5 text-blue-400" />
            <span className="font-medium text-sidebar-foreground">
              Enterprise Plan
            </span>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Unlimited checks
          </p>
        </div>
      </div>
    );
  }

  const percent = Math.min(usage.percentUsed, 100);
  const isOverLimit = usage.checksUsed >= usage.checksIncluded + usage.checksPurchased;
  const barColor = getUsageColor(percent);

  return (
    <div className="border-t border-sidebar-border p-3">
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center justify-between rounded-md px-1 py-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>Checks this month</span>
        <ChevronUp
          className={cn(
            "size-3 transition-transform",
            collapsed && "rotate-180",
          )}
        />
      </button>

      {!collapsed && (
        <div className="mt-1.5 rounded-md bg-muted/30 px-3 py-2">
          {/* Progress bar with mount animation */}
          <div className="mb-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500 ease-out",
                barColor,
                percent >= 100 && "animate-pulse",
              )}
              style={{ width: mounted ? `${Math.min(percent, 100)}%` : "0%" }}
            />
          </div>

          {/* Counts */}
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-mono tabular-nums text-sidebar-foreground">
              {usage.checksUsed.toLocaleString()}
              <span className="text-muted-foreground">
                /{(usage.checksIncluded + usage.checksPurchased).toLocaleString()}
              </span>
            </span>
            <span
              className={cn(
                "font-mono text-[10px]",
                getUsageTextColor(percent),
              )}
            >
              {percent}%
            </span>
          </div>

          {/* Plan name */}
          <p className="mt-1 text-[10px] text-muted-foreground">
            {getPlanDisplayName(usage.plan)} Plan
          </p>

          {/* Action buttons */}
          <div className="mt-2 flex gap-1.5">
            {usage.plan === "free" && (
              <Button
                variant="outline"
                size="xs"
                className="flex-1 h-7 gap-1 text-[10px]"
                onClick={() => openTopUpModal()}
              >
                <Bolt className="size-3" />
                Top Up
              </Button>
            )}
            {usage.plan !== "enterprise" && (
              <Button
                variant={usage.plan === "free" ? "default" : "outline"}
                size="xs"
                className="flex-1 h-7 text-[10px]"
                asChild
              >
                <Link href="/billing/upgrade">Upgrade</Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
