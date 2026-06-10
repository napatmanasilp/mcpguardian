"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import Link from "next/link";

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
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────

interface TierFeature {
  text: string;
  included: boolean | string;
}

interface TierPricing {
  monthly: number | null; // null = custom
  annual: number | null;
  annualBadge?: string;
}

interface PricingTier {
  name: string;
  tagline: string;
  pricing: TierPricing;
  checks: string;
  cta: string;
  ctaHref: string;
  highlighted?: boolean;
  features: TierFeature[];
}

// ─── Data ──────────────────────────────────────────────────────────────

const tiers: PricingTier[] = [
  {
    name: "Free",
    tagline: "For solo devs trying MCP security for the first time",
    pricing: { monthly: 0, annual: 0 },
    checks: "100 checks/mo",
    cta: "Get Started Free",
    ctaHref: "/signup",
    features: [
      { text: "1 API key", included: true },
      { text: "1 seat", included: true },
      { text: "0 monitors", included: true },
      { text: "7-day history", included: true },
    ],
  },
  {
    name: "Developer",
    tagline: "For indie builders and power developers",
    pricing: { monthly: 19, annual: 15, annualBadge: "Save 21%" },
    checks: "2,000 checks/mo",
    cta: "Start Developer Plan",
    ctaHref: "/signup",
    features: [
      { text: "3 API keys", included: true },
      { text: "1 seat", included: true },
      { text: "5 monitors", included: true },
      { text: "30-day history", included: true },
    ],
  },
  {
    name: "Team",
    tagline: "For small teams shipping with AI agents",
    pricing: { monthly: 99, annual: 79, annualBadge: "Save 20%" },
    checks: "20,000 checks/mo",
    cta: "Start Team Plan",
    ctaHref: "/signup",
    highlighted: true,
    features: [
      { text: "10 API keys", included: true },
      { text: "5 seats", included: true },
      { text: "25 monitors", included: true },
      { text: "1-year history", included: true },
    ],
  },
  {
    name: "Startup",
    tagline: "For scaling companies with 20–100 developers",
    pricing: { monthly: 399, annual: 299, annualBadge: "Save 25%" },
    checks: "200,000 checks/mo",
    cta: "Start Startup Plan",
    ctaHref: "/signup",
    features: [
      { text: "Unlimited API keys", included: true },
      { text: "20 seats", included: true },
      { text: "Unlimited monitors", included: true },
      { text: "2-year history", included: true },
    ],
  },
  {
    name: "Enterprise",
    tagline: "For orgs that need full control, compliance, and scale",
    pricing: { monthly: null, annual: null },
    checks: "1,000,000+ checks/mo",
    cta: "Contact Sales",
    ctaHref: "#contact-sales",
    features: [
      { text: "Unlimited API keys", included: true },
      { text: "Custom seats", included: true },
      { text: "Unlimited monitors", included: true },
      { text: "Custom history retention", included: true },
    ],
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────

function formatPrice(price: number | null): string {
  if (price === null) return "Custom";
  return `$${price}`;
}

// ─── Component ─────────────────────────────────────────────────────────

export const PricingSection = () => {
  const [annual, setAnnual] = useState(true);

  return (
    <section id="pricing" className="border-b border-border/60 bg-muted/20">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-muted-foreground">
            Start free. Upgrade when you need continuous monitoring and
            alerts.
          </p>
        </div>

        {/* ── Billing Toggle ─────────────────────────────────────────── */}
        <div className="mt-10 flex justify-center">
          <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted p-1">
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-medium transition-colors",
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
                "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                !annual
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Monthly
            </button>
          </div>
        </div>

        {/* ── Pricing Cards ──────────────────────────────────────────── */}
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {tiers.map((tier) => {
            const price = annual
              ? tier.pricing.annual
              : tier.pricing.monthly;
            const showStrikethrough =
              annual && tier.pricing.monthly !== tier.pricing.annual && tier.pricing.monthly !== null;

            return (
              <Card
                key={tier.name}
                className={cn(
                  "relative flex flex-col border-border/60",
                  tier.highlighted &&
                    "border-primary/50 shadow-lg shadow-primary/5 ring-1 ring-primary/20",
                )}
              >
                {tier.highlighted ? (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                    Most Popular
                  </Badge>
                ) : null}

                <CardHeader>
                  <CardTitle>{tier.name}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {tier.tagline}
                  </CardDescription>
                  <div className="pt-2">
                    {price !== null ? (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-bold">
                          {formatPrice(price)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          /mo
                        </span>
                        {showStrikethrough && (
                          <span className="text-sm text-muted-foreground/50 line-through">
                            {formatPrice(tier.pricing.monthly!)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-3xl font-bold">Custom</span>
                    )}
                    {annual && tier.pricing.annualBadge && (
                      <Badge
                        variant="secondary"
                        className="mt-1.5 text-[10px]"
                      >
                        {tier.pricing.annualBadge}
                      </Badge>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="flex-1">
                  <p className="mb-3 text-xs text-muted-foreground">
                    {tier.checks}
                  </p>
                  <ul className="space-y-2">
                    {tier.features.map((feature) => (
                      <li
                        key={feature.text}
                        className="flex items-start gap-2 text-xs"
                      >
                        <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                        <span>{feature.text}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter className="flex flex-col gap-2">
                  <Button
                    className="w-full"
                    variant={tier.highlighted ? "default" : "outline"}
                    size="sm"
                    asChild
                  >
                    <Link href={tier.ctaHref}>{tier.cta}</Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {/* ── Link to full comparison ────────────────────────────────── */}
        <div className="mt-10 text-center">
          <Link
            href="/pricing"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            See full comparison &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
};
