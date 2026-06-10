"use client";

import { useState } from "react";
import { Check, ChevronRight, Zap } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TOP_UP_BUNDLES } from "@/lib/plan-limits";
import { useUsage } from "@/lib/usage";
import { cn } from "@/lib/utils";

interface UpgradeTier {
  name: string;
  monthly: number;
  annual: number;
  checks: string;
  tagline: string;
  savings: string;
  features: string[];
  cta: string;
}

const tiers: UpgradeTier[] = [
  {
    name: "Developer",
    monthly: 19,
    annual: 15,
    checks: "2,000 checks/mo",
    tagline: "For indie builders and power developers",
    savings: "Save 21%",
    features: [
      "3 API keys",
      "1 seat",
      "5 monitors",
      "30-day history",
      "Email alerts",
      "Full SBOM + compliance",
      "MCPGuardian as MCP tool",
      "Full API access",
    ],
    cta: "Upgrade to Developer",
  },
  {
    name: "Team",
    monthly: 99,
    annual: 79,
    checks: "20,000 checks/mo",
    tagline: "For small teams shipping with AI agents",
    savings: "Save 20%",
    features: [
      "10 API keys",
      "5 seats",
      "25 monitors",
      "1-year history",
      "Slack/webhook alerts",
      "Proxy gateway",
      "Shared monitors + reports",
      "All Developer features",
    ],
    cta: "Upgrade to Team",
  },
  {
    name: "Startup",
    monthly: 399,
    annual: 299,
    checks: "200,000 checks/mo",
    tagline: "For scaling companies with 20\u2013100 developers",
    savings: "Save 25%",
    features: [
      "Unlimited API keys",
      "20 seats",
      "Unlimited monitors",
      "2-year history",
      "Priority support",
      "Basic SSO (Google/GitHub)",
      "All Team features",
    ],
    cta: "Upgrade to Startup",
  },
  {
    name: "Enterprise",
    monthly: -1,
    annual: -1,
    checks: "1,000,000+ checks/mo",
    tagline: "For orgs that need full control, compliance, and scale",
    savings: "",
    features: [
      "Unlimited API keys",
      "Custom seats",
      "Unlimited monitors",
      "Custom history",
      "Full SSO (SAML/OIDC)",
      "Dedicated support + SLA",
      "Custom integrations",
      "Negotiated overage rate",
    ],
    cta: "Contact Sales",
  },
];

const UpgradePage = () => {
  const [annual, setAnnual] = useState(true);
  const { usage } = useUsage();
  const hasToppedUp = (usage?.checksPurchased ?? 0) > 0;
  const spentOnCredits = usage?.topUpBalanceUsd ?? 0;

  // Determine recommended tier
  let recommendedTier = "developer";
  if (usage) {
    if (usage.checksUsed >= 80) recommendedTier = "developer";
    if (hasToppedUp && spentOnCredits >= 19) recommendedTier = "developer";
  }

  const handleCheckout = async (plan: string) => {
    if (plan === "enterprise") {
      window.location.href = "#contact-sales";
      return;
    }

    if (plan === "developer" || plan === "team" || plan === "startup") {
      try {
        const res = await fetch("/api/billing/create-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            plan,
            billing: annual ? "annual" : "monthly",
          }),
        });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        } else {
          toast.error("Checkout unavailable. Please try again.");
        }
      } catch {
        toast.error("Checkout unavailable. Please try again.");
      }
    }
  };

  return (
    <main className="flex flex-1 flex-col items-center gap-10 px-6 py-10">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-bold tracking-tight">Upgrade Your Plan</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {hasToppedUp
            ? `You've spent $${spentOnCredits.toFixed(2)} on credits. A Developer plan would cost $${annual ? 15 : 19}/mo.`
            : "Choose the plan that fits your team."}
        </p>
      </div>

      {/* ── Billing Toggle ──────────────────────────────────────────── */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted p-1">
          <button
            type="button"
            onClick={() => setAnnual(true)}
            className={cn(
              "rounded-md px-5 py-2.5 text-sm font-medium transition-colors",
              annual
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Annual
          </button>
          <button
            type="button"
            onClick={() => setAnnual(false)}
            className={cn(
              "rounded-md px-5 py-2.5 text-sm font-medium transition-colors",
              !annual
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Monthly
          </button>
        </div>
      </div>

      {/* ── Plan Cards ──────────────────────────────────────────────── */}
      <div className="mx-auto grid w-full max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {tiers.map((tier) => {
          const price = annual ? tier.annual : tier.monthly;
          const isRecommended = tier.name.toLowerCase() === recommendedTier;

          return (
            <Card
              key={tier.name}
              className={cn(
                "relative flex flex-col",
                isRecommended &&
                  "border-primary/50 shadow-lg shadow-primary/5 ring-1 ring-primary/20",
              )}
            >
              {isRecommended && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Recommended
                </Badge>
              )}

              <CardHeader>
                <CardTitle>{tier.name}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {tier.tagline}
                </CardDescription>
                <div className="pt-2">
                  {price > 0 ? (
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-3xl font-bold">${price}</span>
                      <span className="text-sm text-muted-foreground">
                        /mo
                      </span>
                      {annual && tier.monthly !== tier.annual && (
                        <span className="text-sm text-muted-foreground/50 line-through">
                          ${tier.monthly}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-3xl font-bold">Custom</span>
                  )}
                  {annual && tier.savings && (
                    <Badge
                      variant="secondary"
                      className="mt-1.5 text-[10px]"
                    >
                      {tier.savings}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {tier.checks}
                </p>
              </CardHeader>

              <CardContent className="flex-1">
                <ul className="space-y-2.5">
                  {tier.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-xs"
                    >
                      <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Button
                  variant={isRecommended ? "default" : "outline"}
                  className="w-full gap-1.5"
                  size="lg"
                  onClick={() => handleCheckout(tier.name.toLowerCase())}
                >
                  {tier.cta}
                  {tier.name !== "Enterprise" && (
                    <ChevronRight className="size-4" />
                  )}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* ── Footnote ────────────────────────────────────────────────── */}
      <p className="text-xs text-muted-foreground max-w-md text-center">
        All plans include full scan reports, OWASP MCP Top 10 coverage, and CVE
        matching. Upgrade takes effect immediately. Cancel anytime.
      </p>
    </main>
  );
};

export default UpgradePage;
