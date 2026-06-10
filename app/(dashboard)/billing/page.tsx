"use client";

import { Bolt, ChevronRight, Clock, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  getOverageRateDisplay,
  getPlanDisplayName,
  getUsageColor,
  openTopUpModal,
  useUsage,
} from "@/lib/usage";
import { cn } from "@/lib/utils";

// Mock top-up history (in production, fetched from DB)
interface TopUpRecord {
  date: string;
  bundle: string;
  checks: number;
  amount: number;
  remaining: number;
}

const MOCK_HISTORY: TopUpRecord[] = [];

const BillingPage = () => {
  const { usage, loading } = useUsage();
  const [history, setHistory] = useState<TopUpRecord[]>(MOCK_HISTORY);

  useEffect(() => {
    // In production: fetch top-up history from API
    // fetch('/api/billing/history').then(res => res.json()).then(setHistory)
  }, []);

  if (loading) {
    return (
      <main className="flex flex-1 flex-col gap-8 p-8">
        <div className="h-8 w-48 animate-pulse rounded bg-muted/30" />
        <div className="h-40 animate-pulse rounded-lg bg-muted/30" />
      </main>
    );
  }

  if (!usage) return null;

  const percent = Math.min(usage.percentUsed, 100);

  return (
    <main className="flex flex-1 flex-col gap-8 p-8">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage your plan, usage, and payment details
        </p>
      </div>

      <div className="max-w-2xl space-y-8">
        {/* ── Section 1: Current Plan ──────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Current Plan</CardTitle>
              <Badge
                variant={usage.plan === "free" ? "outline" : "default"}
              >
                {getPlanDisplayName(usage.plan)}
              </Badge>
            </div>
            <CardDescription>
              {usage.plan === "free" && "100 checks/month — Resets "}
              {usage.plan === "developer" && "2,000 checks/month — "}
              {usage.plan === "team" && "20,000 checks/month — "}
              {usage.plan === "startup" && "200,000 checks/month — "}
              {usage.plan === "enterprise" && "Custom plan — "}
              {usage.plan !== "enterprise" &&
                new Date(usage.resetDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Usage bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Checks used
                </span>
                <span className="font-medium">
                  {usage.checksUsed.toLocaleString()} /{" "}
                  {usage.checksIncluded === -1
                    ? "Unlimited"
                    : (
                        usage.checksIncluded + usage.checksPurchased
                      ).toLocaleString()}
                </span>
              </div>
              <Progress
                value={percent}
                max={100}
                className={cn(
                  "h-2",
                  percent >= 100 && "animate-pulse",
                )}
              />
              <p className="text-xs text-right">{percent}%</p>
            </div>

            {/* Top-up balance (Free only) */}
            {usage.plan === "free" && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Top-up balance
                </span>
                <span className="font-medium">
                  {usage.checksPurchased.toLocaleString()} checks
                </span>
              </div>
            )}

            {/* Overage info (paid plans) */}
            {usage.overageEnabled && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Overage this month
                  </span>
                  <span
                    className={cn(
                      "font-medium",
                      usage.overageChecks > 0 && "text-amber-400",
                    )}
                  >
                    ${usage.overageCostUsd.toFixed(2)} (
                    {usage.overageChecks} checks over limit)
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Overage rate
                  </span>
                  <span className="font-mono text-xs">
                    {getOverageRateDisplay(usage.plan, usage.overageRate)}
                  </span>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              {usage.plan === "free" && (
                <Button
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => openTopUpModal()}
                >
                  <Bolt className="size-4" />
                  Buy Top-Up Credits
                </Button>
              )}
              {usage.plan !== "enterprise" && (
                <Button className="gap-1.5" asChild>
                  <Link href="/billing/upgrade">
                    <ChevronRight className="size-4" />
                    Upgrade Plan
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Section 2: Top-Up History (Free only) ──────────────────── */}
        {usage.plan === "free" && history.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="size-4" />
                Top-Up History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">Date</th>
                      <th className="pb-2 pr-4 font-medium">Bundle</th>
                      <th className="pb-2 pr-4 font-medium">Checks</th>
                      <th className="pb-2 pr-4 font-medium">Amount</th>
                      <th className="pb-2 font-medium">Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((record, i) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 pr-4">{record.date}</td>
                        <td className="py-2 pr-4">{record.bundle}</td>
                        <td className="py-2 pr-4">+{record.checks.toLocaleString()}</td>
                        <td className="py-2 pr-4">${record.amount.toFixed(2)}</td>
                        <td className="py-2">{record.remaining.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── Section 3: Plan Comparison CTA ─────────────────────────── */}
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="size-10 rounded-full bg-blue-500/15 flex items-center justify-center shrink-0">
                <TrendingUp className="size-5 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-blue-300">
                  Upgrade and stop counting checks
                </p>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">
                      Developer &mdash; $19/mo
                    </span>
                    <span className="text-slate-300">
                      2,000 checks, 3 API keys, SBOM
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">
                      Team &mdash; $99/mo
                    </span>
                    <span className="text-slate-300">
                      20,000 checks, 5 seats, Slack
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">
                      Startup &mdash; $299/mo
                    </span>
                    <span className="text-slate-300">
                      200,000 checks, SSO, priority
                    </span>
                  </div>
                </div>
                <Button size="sm" className="mt-4 gap-1" asChild>
                  <Link href="/pricing">
                    See all plans &rarr;
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default BillingPage;
