"use client";

import { useState } from "react";
import { Check, Zap } from "lucide-react";
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

// ─── Pricing Data (matches lib/tier-catalog.ts) ────────────────────────

interface PricingTier {
  name: string;
  tagline: string;
  monthly: number | null;
  annual: number | null;
  annualBadge?: string;
  scans: string;
  toolCalls: string;
  servers: string;
  seats: string;
  cta: string;
  ctaHref: string;
  highlighted?: boolean;
  features: string[];
}

const tiers: PricingTier[] = [
  {
    name: "Free",
    tagline: "Scan any MCP server before connecting — no credit card",
    monthly: 0,
    annual: 0,
    scans: "50 scans/mo",
    toolCalls: "5,000 tool calls/mo",
    servers: "1 server",
    seats: "1 seat",
    cta: "Start Free",
    ctaHref: "/signup",
    features: [
      "Pre-connect security scan",
      "OWASP MCP Top 10 checks",
      "CVE matching (26+ known vulns)",
      "Remediation config output",
      "1 API key",
    ],
  },
  {
    name: "Developer",
    tagline: "For builders shipping AI agents in production",
    monthly: 29,
    annual: 24,
    annualBadge: "Save 17%",
    scans: "100 scans/mo",
    toolCalls: "25,000 tool calls/mo",
    servers: "5 servers",
    seats: "3 seats",
    cta: "Start Developer",
    ctaHref: "/signup",
    features: [
      "Everything in Free, plus:",
      "Runtime proxy gateway",
      "Rug-pull detection",
      "Session watchdog (15-min)",
      "Block mode enforcement",
      "NSA CSI compliance report",
      "MCPGuardian as MCP tool",
      "Email alerts",
    ],
  },
  {
    name: "Team",
    tagline: "For teams building with MCP at scale",
    monthly: 99,
    annual: 82,
    annualBadge: "Save 17%",
    scans: "500 scans/mo",
    toolCalls: "150,000 tool calls/mo",
    servers: "25 servers",
    seats: "10 seats",
    cta: "Start Team",
    ctaHref: "/signup",
    highlighted: true,
    features: [
      "Everything in Developer, plus:",
      "Cross-server risk analysis",
      "MITRE ATLAS mapping",
      "Forensic timeline",
      "Slack + webhook alerts",
      "Shared dashboards",
      "1-year retention",
    ],
  },
  {
    name: "Startup",
    tagline: "For companies scaling AI infrastructure",
    monthly: 299,
    annual: 248,
    annualBadge: "Save 17%",
    scans: "2,000 scans/mo",
    toolCalls: "500,000 tool calls/mo",
    servers: "100 servers",
    seats: "Unlimited",
    cta: "Start Startup",
    ctaHref: "/signup",
    features: [
      "Everything in Team, plus:",
      "Policy engine",
      "Custom scan schedules",
      "Priority support",
      "Basic SSO (Google/GitHub)",
      "2-year retention",
    ],
  },
  {
    name: "Enterprise",
    tagline: "Custom security, compliance, and scale",
    monthly: null,
    annual: null,
    scans: "Unlimited",
    toolCalls: "Unlimited",
    servers: "Unlimited",
    seats: "Custom",
    cta: "Contact Sales",
    ctaHref: "/contact",
    features: [
      "Everything in Startup, plus:",
      "Full SSO (SAML/OIDC)",
      "OpenTelemetry export",
      "Dedicated support + SLA",
      "Custom integrations",
      "On-premise deployment",
    ],
  },
];

// ─── Component ─────────────────────────────────────────────────────────

export const PricingSection = () => {
  const [annual, setAnnual] = useState(true);

  return (
    <section id="pricing" className="border-b border-white/10">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Start free. Scale as you grow.
          </h2>
          <p className="mt-4 text-slate-400">
            No credit card required. Upgrade when your team needs runtime protection.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="mt-10 flex justify-center">
          <div className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
            <button
              type="button"
              onClick={() => setAnnual(true)}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                annual
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-slate-400 hover:text-white",
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
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-slate-400 hover:text-white",
              )}
            >
              Monthly
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {tiers.map((tier) => {
            const price = annual ? tier.annual : tier.monthly;

            return (
              <Card
                key={tier.name}
                className={cn(
                  "relative flex flex-col border-white/10 bg-white/[0.02]",
                  tier.highlighted &&
                    "border-blue-500/50 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/20",
                )}
              >
                {tier.highlighted && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white">
                    Most Popular
                  </Badge>
                )}

                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">{tier.name}</CardTitle>
                  <div className="pt-2">
                    {price !== null ? (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-bold">${price}</span>
                        <span className="text-sm text-slate-400">/mo</span>
                      </div>
                    ) : (
                      <span className="text-3xl font-bold">Custom</span>
                    )}
                    {annual && tier.annualBadge && (
                      <Badge variant="secondary" className="mt-1.5 text-[10px] bg-green-500/10 text-green-400 border-green-500/20">
                        {tier.annualBadge}
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs mt-2">
                    {tier.tagline}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1 space-y-3">
                  {/* Key limits */}
                  <div className="space-y-1 text-xs text-slate-400 font-mono border-b border-white/5 pb-3">
                    <div className="flex justify-between"><span>Scans</span><span className="text-slate-200">{tier.scans}</span></div>
                    <div className="flex justify-between"><span>Tool calls</span><span className="text-slate-200">{tier.toolCalls}</span></div>
                    <div className="flex justify-between"><span>Servers</span><span className="text-slate-200">{tier.servers}</span></div>
                    <div className="flex justify-between"><span>Seats</span><span className="text-slate-200">{tier.seats}</span></div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-2">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-xs text-slate-300">
                        <Check className="mt-0.5 size-3 shrink-0 text-blue-400" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>

                <CardFooter>
                  <Button
                    className={cn(
                      "w-full",
                      tier.highlighted && "bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-500/25",
                    )}
                    variant={tier.highlighted ? "default" : "outline"}
                    size="sm"
                    asChild
                  >
                    <Link href={tier.ctaHref}>
                      {tier.name === "Free" && <Zap className="size-3.5 mr-1.5" />}
                      {tier.cta}
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};
