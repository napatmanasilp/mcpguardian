"use client";

import { useState } from "react";
import { Crown, Loader2, Lock, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getFeatureUnlockInfo,
  FEATURE_LABELS,
  type Feature,
  type Plan,
} from "@/lib/feature-gates";

// ─── Props ──────────────────────────────────────────────────────────────

interface UpgradePromptProps {
  /** The feature the user is trying to access */
  feature: Feature;
  /** The user's current plan ID */
  currentPlan: Plan;
  /** Compact inline variant (no border, smaller text) */
  compact?: boolean;
  /** Optional className override */
  className?: string;
  /** Called after the checkout redirect is initiated */
  onUpgrade?: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────

export function UpgradePrompt({
  feature,
  currentPlan,
  compact = false,
  className,
  onUpgrade,
}: UpgradePromptProps) {
  const [loading, setLoading] = useState(false);

  const { requiredPlan, displayName, priceMonthly } =
    getFeatureUnlockInfo(feature);
  const featureLabel = FEATURE_LABELS[feature];

  const isCurrentPlan =
    currentPlan === requiredPlan || currentPlan === "enterprise";
  if (isCurrentPlan) return null; // Already have access

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: requiredPlan, billing: "monthly" }),
      });

      if (!res.ok) throw new Error("Failed to create checkout session");

      const data = await res.json();
      if (data.url) {
        onUpgrade?.();
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Upgrade failed:", err);
      setLoading(false);
    }
  };

  if (compact) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-md bg-caution/10 border border-caution/20 px-3 py-2 text-xs",
          className,
        )}
      >
        <Lock className="size-3 text-caution shrink-0" />
        <span className="text-slate-300 flex-1 min-w-0">
          <span className="font-medium text-caution">{featureLabel}</span>{" "}
          requires {displayName} —{" "}
          {priceMonthly > 0 ? `from $${priceMonthly}/mo` : "contact sales"}
        </span>
        <Button
          size="sm"
          variant="outline"
          className="border-caution/30 text-caution text-[10px] h-6 shrink-0"
          disabled={loading}
          onClick={handleUpgrade}
        >
          {loading ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Crown className="size-3" />
          )}
          Upgrade
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-monitor/30 bg-gradient-to-br from-monitor/10 to-transparent p-6",
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <div className="size-10 rounded-full bg-monitor/20 flex items-center justify-center shrink-0">
          <Lock className="size-5 text-monitor" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Sparkles className="size-3.5 text-monitor" />
            Unlock {featureLabel}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Your current plan (<span className="font-medium capitalize">{currentPlan}</span>) does not
            include <span className="font-medium text-slate-300">{featureLabel}</span>. Upgrade to{" "}
            <span className="font-semibold text-monitor">{displayName}</span>
            {priceMonthly > 0 && (
              <>
                {" "}starting at <span className="font-mono text-slate-200">${priceMonthly}/mo</span>
              </>
            )}
            .
          </p>
          <div className="flex items-center gap-3 mt-4">
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
              disabled={loading}
              onClick={handleUpgrade}
            >
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Crown className="size-3.5" />
              )}
              {priceMonthly > 0
                ? `Upgrade to ${displayName} — $${priceMonthly}/mo`
                : "Contact Sales"}
            </Button>
            <p className="text-[10px] text-slate-500">
              No lock-in · Cancel anytime · Annual billing saves ~17%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
