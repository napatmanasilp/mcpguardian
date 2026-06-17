"use client";

import { useState } from "react";
import { Crown, Lock, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Feature, Plan } from "@/lib/feature-gates";
import { FEATURE_LABELS, getFeatureUnlockInfo } from "@/lib/feature-gates";

// ─── Props ──────────────────────────────────────────────────────────────

interface FeatureGateSectionProps {
  /** Whether the feature is accessible on the current plan */
  hasAccess: boolean;
  /** The feature key being gated */
  feature: Feature;
  /** The user's current plan */
  currentPlan: Plan;
  /** Optional heading to display above the gated content */
  heading?: string;
  /** Optional description for the gate message */
  description?: string;
  /** Children to render when accessible */
  children: React.ReactNode;
  /** 
   * Preview content to show behind the blur overlay.
   * If not provided, uses children with a blur overlay.
   */
  preview?: React.ReactNode;
  /** Whether to show a blurred preview of the content (default: true) */
  showPreview?: boolean;
  /** Additional className */
  className?: string;
}

// ─── Component ──────────────────────────────────────────────────────────

/**
 * Wraps a section of a page that requires a specific plan.
 * Shows the content normally for users with access.
 * Shows a blurred preview + upgrade prompt for users without access.
 */
export function FeatureGateSection({
  hasAccess,
  feature,
  currentPlan,
  heading,
  description,
  children,
  preview,
  showPreview = true,
  className,
}: FeatureGateSectionProps) {
  const [loading, setLoading] = useState(false);

  if (hasAccess) {
    return <>{children}</>;
  }

  const { requiredPlan, displayName, priceMonthly } = getFeatureUnlockInfo(feature);
  const featureLabel = FEATURE_LABELS[feature];

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
        window.location.href = data.url;
      }
    } catch (err) {
      console.error("Upgrade failed:", err);
      setLoading(false);
    }
  };

  return (
    <div className={cn("relative", className)}>
      {/* Blurred preview */}
      {showPreview && (
        <div className="pointer-events-none select-none" aria-hidden="true">
          <div className="blur-[3px] opacity-40 max-h-[300px] overflow-hidden">
            {preview ?? children}
          </div>
          {/* Fade-out gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[hsl(222,47%,8%)]" />
        </div>
      )}

      {/* Upgrade overlay */}
      <div
        className={cn(
          "rounded-lg border border-monitor/30 bg-gradient-to-br from-monitor/5 via-[hsl(222,47%,8%)] to-transparent p-6",
          showPreview && "absolute inset-x-0 bottom-0 top-1/3",
          !showPreview && "mt-2",
        )}
      >
        <div className="flex flex-col items-center text-center gap-4 py-4">
          <div className="size-12 rounded-full bg-monitor/15 flex items-center justify-center">
            <Lock className="size-6 text-monitor" />
          </div>
          <div className="space-y-2 max-w-md">
            {heading && (
              <h3 className="text-base font-semibold text-slate-200 flex items-center justify-center gap-2">
                <Sparkles className="size-4 text-monitor" />
                {heading}
              </h3>
            )}
            {!heading && (
              <h3 className="text-base font-semibold text-slate-200 flex items-center justify-center gap-2">
                <Sparkles className="size-4 text-monitor" />
                Unlock {featureLabel}
              </h3>
            )}
            <p className="text-sm text-slate-400">
              {description ??
                `This feature requires the ${displayName} plan${priceMonthly > 0 ? ` ($${priceMonthly}/mo)` : ""}. Upgrade to access ${featureLabel.toLowerCase()} and more.`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white gap-1.5"
              disabled={loading}
              onClick={handleUpgrade}
            >
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Crown className="size-4" />
              )}
              {priceMonthly > 0
                ? `Upgrade to ${displayName} — $${priceMonthly}/mo`
                : "Contact Sales"}
            </Button>
            <Link href="/upgrade">
              <Button variant="outline" size="sm" className="border-white/10 text-slate-400">
                Compare Plans
              </Button>
            </Link>
          </div>
          <p className="text-[10px] text-slate-600">
            No lock-in · Cancel anytime · Annual billing saves ~17%
          </p>
        </div>
      </div>
    </div>
  );
}
