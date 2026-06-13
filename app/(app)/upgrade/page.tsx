"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Loader2, Minus, Shield } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { FeatureComparisonTable } from "@/components/upgrade/feature-comparison-table";
import { SocialProofSection } from "@/components/upgrade/social-proof-section";
import { cn } from "@/lib/utils";
import {
  TIER_CATALOG,
  TierDefinition,
  TierId,
  VALID_TIER_IDS,
  getDisplayPrice,
  getAnnualTotalCents,
  isUnlimited,
} from "@/lib/tier-catalog";

interface PlanCardMeta {
  tierId: TierId;
  subtitle: string;
  features: string[];
  notIncluded: string[];
  overageScan: string;
  overageToolCall: string;
  popular?: boolean;
  ctatext: string;
}

/**
 * Static metadata per tier that isn't part of the tier catalog
 * (features, subtitles, overage rates, CTA text).
 */
const PLAN_META: PlanCardMeta[] = [
  {
    tierId: "free",
    subtitle: "For individual evaluation",
    features: [
      "Static config analysis",
      "OWASP MCP Top 10 checks",
      "Email alerts",
      "7-day scan retention",
    ],
    notIncluded: [
      "Runtime proxy protection",
      "DNS/cert verification",
      "Sandbox execution",
      "Compliance reports",
    ],
    overageScan: "—",
    overageToolCall: "—",
    ctatext: "Start Free — No Card Required",
  },
  {
    tierId: "developer",
    subtitle: "For individual developers",
    features: [
      "Everything in Free",
      "Runtime proxy protection",
      "DNS/cert verification",
      "Sandbox execution",
      "NSA compliance mapping",
      "30-day scan retention",
      "Webhook alerts",
    ],
    notIncluded: [
      "Team collaboration",
      "Priority support",
    ],
    overageScan: "$1.50 per additional scan",
    overageToolCall: "$0.012 per additional tool call",
    popular: true,
    ctatext: "Start Developer",
  },
  {
    tierId: "team",
    subtitle: "For small teams",
    features: [
      "Everything in Developer",
      "Team collaboration",
      "Custom alert rules",
      "90-day scan retention",
      "API access",
    ],
    notIncluded: [
      "Priority support",
      "Custom SLA",
    ],
    overageScan: "$1.00 per additional scan",
    overageToolCall: "$0.010 per additional tool call",
    ctatext: "Start Team",
  },
  {
    tierId: "startup",
    subtitle: "For growing companies",
    features: [
      "Everything in Team",
      "Unlimited seats",
      "LLM semantic classifier",
      "Priority support",
      "1-year scan retention",
      "Custom compliance reports",
    ],
    notIncluded: [
      "Custom SLA",
      "Self-hosted option",
    ],
    overageScan: "$0.50 per additional scan",
    overageToolCall: "$0.005 per additional tool call",
    ctatext: "Start Startup",
  },
  {
    tierId: "enterprise",
    subtitle: "For large organizations",
    features: [
      "Everything in Startup",
      "Custom SLA",
      "Self-hosted Docker Compose (Q4 2026)",
      "SOC 2 Type II (Q2 2027)",
      "OAuth 2.1 / SAML SSO (Q3 2026)",
      "7-year scan retention",
      "Dedicated support engineer",
    ],
    notIncluded: [],
    overageScan: "—",
    overageToolCall: "—",
    ctatext: "Contact Sales",
  },
];

function formatAllowance(value: number | null, label: string): string {
  if (isUnlimited(value)) return "Unlimited";
  return `${value!.toLocaleString()} ${label}`;
}

function formatSeats(tier: TierDefinition): string {
  if (isUnlimited(tier.seatLimit)) return "Unlimited";
  return `${tier.seatLimit} seat${tier.seatLimit !== 1 ? "s" : ""}`;
}

function formatServers(tier: TierDefinition): string {
  if (isUnlimited(tier.mcpServerLimit)) return "Unlimited";
  return `${tier.mcpServerLimit} MCP server${tier.mcpServerLimit !== 1 ? "s" : ""}`;
}

export default function UpgradePage() {
  const router = useRouter();
  const [annual, setAnnual] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const handleSelectPlan = async (tierId: TierId) => {
    if (tierId === "enterprise") {
      router.push("/contact");
      return;
    }
    if (tierId === "free") {
      router.push("/onboarding");
      return;
    }

    setLoading(tierId);
    try {
      const res = await fetch("/api/billing/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: tierId,
          billing: annual ? "annual" : "monthly",
        }),
      });

      if (!res.ok) throw new Error("Failed to create checkout");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(null);
    }
  };

  return (
    <main className="flex flex-1 flex-col gap-8 p-6">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <p className="text-xs font-mono text-slate-500 uppercase tracking-widest mb-2">Pricing</p>
        <h1 className="text-2xl font-bold tracking-tight">
          MCP Security That Prices Like Security, Not a Dev Tool
        </h1>
        <p className="text-sm text-slate-400 mt-2">
          Two billing dimensions: full scans + protected tool calls. No ambiguous &ldquo;checks.&rdquo; No surprise bills.
        </p>
      </div>

      {/* NSA Banner */}
      <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 max-w-3xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <Shield className="size-5 text-blue-400 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-blue-300">NSA MCP Security Guidance — Published May 2026</p>
            <p className="text-xs text-slate-400 mt-0.5">
              MCPGuardian addresses every listed control. <Link href="/nsa-mcp-compliance" className="text-blue-400 underline">Read how →</Link>
            </p>
          </div>
        </div>
      </div>

      {/* Annual toggle */}
      <div className="flex items-center justify-center gap-3">
        <span className={cn("text-sm", !annual ? "text-slate-200" : "text-slate-500")}>Monthly</span>
        <Switch checked={annual} onCheckedChange={setAnnual} />
        <span className={cn("text-sm", annual ? "text-slate-200" : "text-slate-500")}>
          Annual
          {annual && <Badge className="ml-2 text-[9px] bg-emerald-500/20 text-emerald-400 border-0">2 months free</Badge>}
        </span>
      </div>

      {/* Social Proof */}
      <SocialProofSection />

      {/* Pricing Cards */}
      <div className="grid gap-4 lg:grid-cols-5 max-w-6xl mx-auto w-full">
        {PLAN_META.map((meta) => {
          const tier = TIER_CATALOG[meta.tierId];
          const cycle = annual ? "annual" : "monthly";
          const displayPrice = getDisplayPrice(tier, cycle as "monthly" | "annual");
          const isCustom = tier.monthlyPriceCents === -1;
          const isFree = tier.monthlyPriceCents === 0;
          const isPaid = !isCustom && !isFree;

          // Annual total = 12x the annual rate
          const annualTotalCents = getAnnualTotalCents(tier);
          const annualTotalDollars = annualTotalCents > 0 ? annualTotalCents / 100 : 0;
          const monthlyTotalForYear = tier.monthlyPriceCents > 0 ? (tier.monthlyPriceCents * 12) / 100 : 0;
          const annualSavings = monthlyTotalForYear - annualTotalDollars;

          return (
            <Card
              key={meta.tierId}
              className={cn(
                "border-white/10 bg-[hsl(222,47%,6%)] relative flex flex-col",
                meta.popular && "ring-1 ring-blue-500",
                meta.tierId === "enterprise" && "bg-gradient-to-b from-blue-500/10 to-[hsl(222,47%,6%)] border-blue-500/30",
              )}
            >
              {meta.popular && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <Badge className="bg-blue-500 text-white text-[9px] px-2">Most Popular</Badge>
                </div>
              )}
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{tier.displayName}</CardTitle>
                <p className="text-[10px] text-slate-500">{meta.subtitle}</p>
                <div className="mt-2">
                  {isCustom ? (
                    <p className="text-lg font-bold">Custom</p>
                  ) : isFree ? (
                    <p className="text-lg font-bold">Free</p>
                  ) : (
                    <>
                      <p className="text-2xl font-bold">
                        {displayPrice}
                        <span className="text-sm font-normal text-slate-400">/mo</span>
                      </p>
                      {annual && (
                        <p className="text-[10px] text-slate-500">
                          ${annualTotalDollars}/year (save ${annualSavings})
                        </p>
                      )}
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-4">
                <div className="space-y-1 text-xs text-slate-400">
                  <p>{formatAllowance(tier.scanAllowance, "scans/month")}</p>
                  <p>
                    {tier.id === "free" && tier.toolCallAllowance !== null
                      ? `${tier.toolCallAllowance.toLocaleString()} tool calls/month`
                      : formatAllowance(tier.toolCallAllowance, "tool calls/month")}
                  </p>
                  <p>{formatSeats(tier)}</p>
                  <p>{formatServers(tier)}</p>
                </div>

                <Separator className="bg-white/5" />

                <div className="flex-1 space-y-2">
                  {meta.features.map((f) => (
                    <div key={f} className="flex items-start gap-2 text-xs">
                      <Check className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="text-slate-300">{f}</span>
                    </div>
                  ))}
                  {meta.notIncluded.map((f) => (
                    <div key={f} className="flex items-start gap-2 text-xs">
                      <Minus className="size-3.5 text-slate-600 shrink-0 mt-0.5" />
                      <span className="text-slate-600">{f}</span>
                    </div>
                  ))}
                </div>

                {meta.overageScan !== "—" && (
                  <p className="text-[10px] text-slate-500">
                    {meta.overageScan} · {meta.overageToolCall}
                  </p>
                )}

                <Button
                  className={cn(
                    "w-full gap-2 mt-auto",
                    meta.tierId === "enterprise" && "bg-blue-600 hover:bg-blue-700",
                    meta.popular && meta.tierId !== "enterprise" && "bg-blue-500 hover:bg-blue-600",
                  )}
                  variant={meta.popular ? "default" : "outline"}
                  disabled={loading === meta.tierId}
                  onClick={() => handleSelectPlan(meta.tierId)}
                >
                  {loading === meta.tierId ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    meta.ctatext
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Feature Comparison Table */}
      <FeatureComparisonTable />

      {/* Add-Ons Grid */}
      <div>
        <h2 className="text-lg font-semibold text-slate-300 mb-4">Add-Ons</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { name: "NSA MCP CSI Compliance Report", price: "$149 one-time", desc: "Full NSA compliance assessment as a downloadable PDF report." },
            { name: "Extra Scan Pack (100 scans)", price: "$50 one-time", desc: "Add 100 additional scans to any paid plan." },
            { name: "Compliance Report Bundle", price: "$99 one-time", desc: "NSA CSI + OWASP MCP + custom compliance reports." },
            { name: "Forensic Content Storage", price: "$20/mo per 10GB", desc: "Store forensic payload content for later analysis." },
            { name: "Priority Re-Scan", price: "$10 one-time", desc: "Skip the queue and get your scan results immediately." },
            { name: "LLM Semantic Classifier", price: "$79/mo", desc: "AI-powered semantic analysis of tool call patterns. Startup+ only." },
          ].map((addon) => (
            <Card key={addon.name} className="border-white/10 bg-[hsl(222,47%,6%)]">
              <CardContent className="p-4 space-y-2">
                <p className="text-sm font-semibold text-slate-200">{addon.name}</p>
                <p className="text-xs text-slate-400">{addon.desc}</p>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm font-bold text-blue-400">{addon.price}</span>
                  <Button size="sm" variant="outline" className="border-blue-500/30 text-blue-400 text-xs">
                    Add to Plan
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
