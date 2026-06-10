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
import { cn } from "@/lib/utils";

interface PlanCard {
  name: string;
  subtitle: string;
  priceMonthly: number;
  priceAnnual: number;
  scans: string;
  toolCalls: string;
  seats: string;
  servers: string;
  features: string[];
  notIncluded: string[];
  overageScan: string;
  overageToolCall: string;
  popular?: boolean;
  ctatext: string;
  priceId?: string;
}

const PLANS: PlanCard[] = [
  {
    name: "Free",
    subtitle: "For individual evaluation",
    priceMonthly: 0,
    priceAnnual: 0,
    scans: "50 scans/month",
    toolCalls: "Not included",
    seats: "1 seat",
    servers: "1 MCP server",
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
    name: "Developer",
    subtitle: "For individual developers",
    priceMonthly: 29,
    priceAnnual: 290,
    scans: "100 scans/month",
    toolCalls: "25,000 tool calls/month",
    seats: "3 seats",
    servers: "5 MCP servers",
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
    name: "Team",
    subtitle: "For small teams",
    priceMonthly: 99,
    priceAnnual: 990,
    scans: "500 scans/month",
    toolCalls: "100,000 tool calls/month",
    seats: "10 seats",
    servers: "25 MCP servers",
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
    name: "Startup",
    subtitle: "For growing companies",
    priceMonthly: 299,
    priceAnnual: 2990,
    scans: "2,000 scans/month",
    toolCalls: "500,000 tool calls/month",
    seats: "Unlimited",
    servers: "100 MCP servers",
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
    name: "Enterprise",
    subtitle: "For large organizations",
    priceMonthly: -1,
    priceAnnual: -1,
    scans: "Unlimited",
    toolCalls: "Unlimited",
    seats: "Unlimited",
    servers: "Unlimited",
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

export default function UpgradePage() {
  const router = useRouter();
  const [annual, setAnnual] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const handleSelectPlan = async (plan: PlanCard) => {
    if (plan.name === "Enterprise") {
      window.location.href = "mailto:sales@mcpguardian.dev";
      return;
    }
    if (plan.priceMonthly === 0) {
      // Free plan — redirect to onboarding
      router.push("/onboarding");
      return;
    }

    setLoading(plan.name);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: plan.name.toLowerCase(),
          billingCycle: annual ? "annual" : "monthly",
        }),
      });

      if (!res.ok) throw new Error("Failed to create checkout");
      const data = await res.json();
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
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

      {/* Pricing Cards */}
      <div className="grid gap-4 lg:grid-cols-5 max-w-6xl mx-auto w-full">
        {PLANS.map((plan) => (
          <Card
            key={plan.name}
            className={cn(
              "border-white/10 bg-[hsl(222,47%,6%)] relative flex flex-col",
              plan.popular && "ring-1 ring-blue-500",
              plan.name === "Enterprise" && "bg-gradient-to-b from-blue-500/10 to-[hsl(222,47%,6%)] border-blue-500/30",
            )}
          >
            {plan.popular && (
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                <Badge className="bg-blue-500 text-white text-[9px] px-2">Most Popular</Badge>
              </div>
            )}
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{plan.name}</CardTitle>
              <p className="text-[10px] text-slate-500">{plan.subtitle}</p>
              <div className="mt-2">
                {plan.priceMonthly === -1 ? (
                  <p className="text-lg font-bold">Custom</p>
                ) : plan.priceMonthly === 0 ? (
                  <p className="text-lg font-bold">Free</p>
                ) : (
                  <>
                    <p className="text-2xl font-bold">
                      ${annual ? Math.round(plan.priceAnnual / 12) : plan.priceMonthly}
                      <span className="text-sm font-normal text-slate-400">/mo</span>
                    </p>
                    {annual && (
                      <p className="text-[10px] text-slate-500">${plan.priceAnnual}/year (save ${plan.priceMonthly * 12 - plan.priceAnnual})</p>
                    )}
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col gap-4">
              <div className="space-y-1 text-xs text-slate-400">
                <p>{plan.scans}</p>
                <p>{plan.toolCalls}</p>
                <p>{plan.seats}</p>
                <p>{plan.servers}</p>
              </div>

              <Separator className="bg-white/5" />

              <div className="flex-1 space-y-2">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-start gap-2 text-xs">
                    <Check className="size-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="text-slate-300">{f}</span>
                  </div>
                ))}
                {plan.notIncluded.map((f) => (
                  <div key={f} className="flex items-start gap-2 text-xs">
                    <Minus className="size-3.5 text-slate-600 shrink-0 mt-0.5" />
                    <span className="text-slate-600">{f}</span>
                  </div>
                ))}
              </div>

              {plan.overageScan !== "—" && (
                <p className="text-[10px] text-slate-500">
                  {plan.overageScan} · {plan.overageToolCall}
                </p>
              )}

              <Button
                className={cn(
                  "w-full gap-2 mt-auto",
                  plan.name === "Enterprise" && "bg-blue-600 hover:bg-blue-700",
                  plan.popular && !plan.name.includes("Enterprise") && "bg-blue-500 hover:bg-blue-600",
                )}
                variant={plan.popular ? "default" : "outline"}
                disabled={loading === plan.name}
                onClick={() => handleSelectPlan(plan)}
              >
                {loading === plan.name ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  plan.ctatext
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

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
