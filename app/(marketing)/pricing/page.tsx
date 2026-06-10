"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import Link from "next/link";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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

interface TierPricing {
  monthly: number | null;
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
  tooltip?: string;
  features: string[];
}

type FeatureRowValue = string | boolean;

interface ComparisonRow {
  feature: string;
  values: FeatureRowValue[];
}

// ─── Tier Data ─────────────────────────────────────────────────────────

const tiers: PricingTier[] = [
  {
    name: "Free",
    tagline: "For solo devs trying MCP security for the first time",
    pricing: { monthly: 0, annual: 0 },
    checks: "100",
    cta: "Get Started Free",
    ctaHref: "/signup",
    features: [
      "1 API key",
      "1 seat",
      "0 monitors",
      "7-day history",
      "Full scan report",
      "OWASP MCP Top 10 summary",
      "CVE matching",
      "Rate-limited API access",
      "No Slack/webhook alerts",
      "No SSO",
      "Overage: Blocked",
    ],
  },
  {
    name: "Developer",
    tagline: "For indie builders and power developers",
    pricing: { monthly: 19, annual: 15, annualBadge: "Save 21%" },
    checks: "2,000",
    cta: "Start Developer Plan",
    ctaHref: "/signup",
    features: [
      "3 API keys",
      "1 seat",
      "5 monitors",
      "30-day history",
      "Full scan report",
      "OWASP MCP Top 10 summary",
      "CVE matching",
      "Email alerts",
      "Full SBOM + compliance reports",
      "MCPGuardian as MCP tool",
      "Full API access",
      "No Slack/webhook alerts",
      "No SSO",
    ],
  },
  {
    name: "Team",
    tagline: "For small teams shipping with AI agents",
    pricing: { monthly: 99, annual: 79, annualBadge: "Save 20%" },
    checks: "20,000",
    cta: "Start Team Plan",
    ctaHref: "/signup",
    highlighted: true,
    features: [
      "10 API keys",
      "5 seats",
      "25 monitors",
      "1-year history",
      "Full scan report",
      "OWASP MCP Top 10 summary",
      "CVE matching",
      "Email alerts",
      "Full SBOM + compliance reports",
      "MCPGuardian as MCP tool",
      "Full API access",
      "Slack/webhook alerts",
      "Proxy gateway",
      "Shared monitors + reports",
      "No SSO",
    ],
  },
  {
    name: "Startup",
    tagline: "For scaling companies with 20\u2013100 developers",
    pricing: { monthly: 399, annual: 299, annualBadge: "Save 25%" },
    checks: "200,000",
    cta: "Start Startup Plan",
    ctaHref: "/signup",
    features: [
      "Unlimited API keys",
      "20 seats",
      "Unlimited monitors",
      "2-year history",
      "Full scan report",
      "OWASP MCP Top 10 summary",
      "CVE matching",
      "Email alerts",
      "Full SBOM + compliance reports",
      "MCPGuardian as MCP tool",
      "Full API access",
      "Slack/webhook alerts",
      "Proxy gateway",
      "Shared monitors + reports",
      "Priority support",
      "Basic SSO",
    ],
  },
  {
    name: "Enterprise",
    tagline: "For orgs that need full control, compliance, and scale",
    pricing: { monthly: null, annual: null },
    checks: "1,000,000+",
    cta: "Contact Sales",
    ctaHref: "#contact-sales",
    features: [
      "Unlimited API keys",
      "Custom seats",
      "Unlimited monitors",
      "Custom history retention",
      "Full scan report",
      "OWASP MCP Top 10 summary",
      "CVE matching",
      "Email alerts",
      "Full SBOM + compliance reports",
      "MCPGuardian as MCP tool",
      "Full API access",
      "Slack/webhook alerts",
      "Proxy gateway",
      "Shared monitors + reports",
      "Priority support",
      "Full SSO (SAML/OIDC)",
      "Dedicated support + SLA",
      "Custom integrations",
      "Negotiated overage rate",
    ],
  },
];

// ─── Comparison Table Data ─────────────────────────────────────────────

const comparisonRows: ComparisonRow[] = [
  {
    feature: "Price/mo (annual)",
    values: ["$0", "$15", "$79", "$299", "Custom"],
  },
  {
    feature: "Price/mo (monthly)",
    values: ["$0", "$19", "$99", "$399", "Custom"],
  },
  {
    feature: "Checks/month",
    values: ["100", "2,000", "20,000", "200,000", "1,000,000+"],
  },
  {
    feature: "API keys",
    values: ["1", "3", "10", "Unlimited", "Unlimited"],
  },
  {
    feature: "Monitors",
    values: ["\u2014", "5", "25", "Unlimited", "Unlimited"],
  },
  {
    feature: "Seats",
    values: ["1", "1", "5", "20", "Custom"],
  },
  {
    feature: "History",
    values: ["7 days", "30 days", "1 year", "2 years", "Custom"],
  },
  {
    feature: "Full scan report",
    values: [true, true, true, true, true],
  },
  {
    feature: "OWASP MCP Top 10",
    values: [true, true, true, true, true],
  },
  {
    feature: "CVE matching",
    values: [true, true, true, true, true],
  },
  {
    feature: "SBOM + compliance",
    values: [false, true, true, true, true],
  },
  {
    feature: "MCPGuardian tool",
    values: [false, true, true, true, true],
  },
  {
    feature: "Email alerts",
    values: [false, true, true, true, true],
  },
  {
    feature: "Slack/webhooks",
    values: [false, false, true, true, true],
  },
  {
    feature: "Proxy gateway",
    values: [false, false, true, true, true],
  },
  {
    feature: "API access",
    values: ["Rate limited", true, true, true, true],
  },
  {
    feature: "SSO",
    values: [false, false, false, "Basic", "Full (SAML/OIDC)"],
  },
  {
    feature: "Priority support",
    values: [false, false, false, true, "✅ + SLA"],
  },
  {
    feature: "Overage",
    values: [
      "Blocked",
      "$0.015/check",
      "$0.010/check",
      "$0.005/check",
      "Negotiated",
    ],
  },
];

// ─── FAQ Data ──────────────────────────────────────────────────────────

const faqItems = [
  {
    question: 'What counts as a "check"?',
    answer:
      "A check is a single security scan of one MCP server. Each time we analyze a server's configuration, tools, permissions, and vulnerabilities \u2014 that's one check.",
  },
  {
    question: "What happens if I exceed my monthly check limit?",
    answer:
      "On the Free plan, scanning pauses until next month or you upgrade. On paid plans, you can continue scanning at your plan's overage rate. You'll get a warning at 80% and 100% usage.",
  },
  {
    question:
      "Can I use the product without a subscription (pay-as-you-go)?",
    answer:
      "Yes. Without a subscription, the first 100 checks/month are free. After that, rates are: 101\u20131,000 checks at $0.015/check, 1,001\u201310,000 at $0.012/check, 10,001\u2013100,000 at $0.008/check, and 100,001+ at $0.005/check. Subscriptions are almost always cheaper.",
  },
  {
    question: "How does annual billing work?",
    answer:
      "Choose annual billing and pay upfront for 12 months at the discounted rate. You save between 20\u201325% compared to monthly billing. You can cancel anytime \u2014 we'll refund the unused portion.",
  },
  {
    question: "What's included in the Free plan?",
    answer:
      "You get 100 checks/month, 1 API key, full scan reports with OWASP MCP Top 10 coverage and CVE matching, and 7-day history. No credit card required.",
  },
  {
    question: "What is MCPGuardian as an MCP tool?",
    answer:
      "On Developer plans and above, you can install MCPGuardian as an MCP tool inside your AI agent. Your agent can then self-check the servers it connects to in real time \u2014 security as part of the workflow, not outside it.",
  },
  {
    question: "What's the proxy gateway?",
    answer:
      "Available on Team and above. Route your MCP traffic through our gateway to enforce security policies, block unsafe tool calls, and log all interactions \u2014 without changing your server code.",
  },
  {
    question: "Do you offer refunds?",
    answer:
      "Yes. Monthly plans can be cancelled anytime. Annual plans are refunded pro-rata for unused months. No questions asked within the first 14 days.",
  },
  {
    question: "Can I switch plans mid-cycle?",
    answer:
      "Yes. Upgrades take effect immediately and you're charged the prorated difference. Downgrades take effect at the start of your next billing cycle.",
  },
  {
    question:
      'What does "Basic SSO" vs "Full SSO" mean?',
    answer:
      "Basic SSO (Startup plan) supports Google and GitHub SSO. Full SSO (Enterprise) adds SAML 2.0 and OIDC for integration with Okta, Azure AD, and other identity providers.",
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────

function formatPrice(price: number | null): string {
  if (price === null) return "Custom";
  return `$${price}`;
}

function renderCellValue(value: FeatureRowValue, rowFeature?: string, tierIndex?: number) {
  if (value === true) {
    return (
      <span className="inline-flex items-center justify-center">
        <Check className="size-4 text-green-500" aria-label="Yes" />
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex items-center justify-center">
        <X className="size-4 text-muted-foreground/30" aria-label="No" />
      </span>
    );
  }
  // Tooltip for Free tier "Blocked" overage
  if (rowFeature === "Overage" && tierIndex === 0 && value === "Blocked") {
    return (
      <span className="inline-flex items-center justify-center gap-1" title="Upgrade to continue scanning">
        <span className="text-xs sm:text-sm">{value}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-3 shrink-0 text-muted-foreground/60"
          aria-hidden
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      </span>
    );
  }
  return (
    <span className="text-xs sm:text-sm">{value}</span>
  );
}

// ─── Component ─────────────────────────────────────────────────────────

const PricingPage = () => {
  const [annual, setAnnual] = useState(true);

  return (
    <main className="flex flex-1 flex-col items-center gap-12 px-6 py-16 md:py-24">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
          Simple, Transparent Pricing
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Start scanning for free. Upgrade when you need more.
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

      {/* ── Pricing Cards ───────────────────────────────────────────── */}
      <div className="mx-auto grid w-full max-w-7xl gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {tiers.map((tier) => {
          const price = annual
            ? tier.pricing.annual
            : tier.pricing.monthly;
          const showStrikethrough =
            annual &&
            tier.pricing.monthly !== tier.pricing.annual &&
            tier.pricing.monthly !== null;

          return (
            <Card
              key={tier.name}
              className={cn(
                "relative flex flex-col",
                tier.highlighted &&
                  "border-primary/50 shadow-lg shadow-primary/5 ring-1 ring-primary/20",
              )}
            >
              {tier.highlighted ? (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 text-xs">
                  Most Popular
                </Badge>
              ) : null}

              <CardHeader>
                <CardTitle>{tier.name}</CardTitle>
                <div className="pt-2">
                  {price !== null ? (
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-4xl font-bold">
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
                    <span className="text-4xl font-bold">Custom</span>
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
                <CardDescription className="line-clamp-2 mt-2">
                  {tier.tagline}
                </CardDescription>
                <p className="mt-1 text-xs text-muted-foreground">
                  {tier.checks} checks/mo
                </p>
              </CardHeader>

              <CardContent className="flex-1">
                <ul className="space-y-3">
                  {tier.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-3 text-sm"
                    >
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      {feature === "Overage: Blocked" ? (
                        <span className="inline-flex items-center gap-1" title="Upgrade to continue scanning">
                          <span>{feature}</span>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="size-3.5 shrink-0 text-muted-foreground/60"
                            aria-hidden
                          >
                            <circle cx="12" cy="12" r="10" />
                            <path d="M12 16v-4" />
                            <path d="M12 8h.01" />
                          </svg>
                        </span>
                      ) : (
                        <span>{feature}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Button
                  variant={tier.highlighted ? "default" : "outline"}
                  className="w-full"
                  size="lg"
                  asChild
                >
                  <Link href={tier.ctaHref}>{tier.cta}</Link>
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* ── Comparison Table ────────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-7xl">
        <h2 className="mb-8 text-center text-2xl font-semibold">
          Full Feature Comparison
        </h2>

        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="sticky left-0 z-10 bg-muted/50 px-4 py-3 font-semibold">
                  Feature
                </th>
                {tiers.map((tier) => (
                  <th
                    key={tier.name}
                    className={cn(
                      "px-4 py-3 text-center font-semibold",
                      tier.highlighted && "text-primary",
                    )}
                  >
                    {tier.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {comparisonRows.map((row, i) => (
                <tr
                  key={row.feature}
                  className={cn(
                    "border-b border-border transition-colors hover:bg-muted/30",
                    i % 2 === 0 && "bg-muted/10",
                  )}
                >
                  <td className="sticky left-0 z-10 bg-background px-4 py-3 font-medium">
                    {row.feature}
                  </td>
                  {row.values.map((value, j) => (
                    <td
                      key={j}
                      className="px-4 py-3 text-center"
                    >
                      {renderCellValue(value, row.feature, j)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-2xl">
        <h2 className="mb-8 text-center text-2xl font-semibold">
          Frequently Asked Questions
        </h2>
        <Accordion type="single" collapsible className="w-full">
          {faqItems.map((item, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-left">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </main>
  );
};

export default PricingPage;
