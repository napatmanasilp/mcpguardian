import Link from "next/link";
import { Check } from "lucide-react";

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

interface PricingTier {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  cta: string;
  href: string;
  highlighted?: boolean;
}

const tiers: PricingTier[] = [
  {
    name: "Free",
    price: "$0",
    description: "Get started with basic security scanning.",
    features: ["3 scans per month", "Basic security report", "A–F grade score"],
    cta: "Start Free",
    href: "/signup",
  },
  {
    name: "Pro",
    price: "$29",
    period: "/mo",
    description: "For developers who need continuous protection.",
    features: [
      "Unlimited scans",
      "Continuous monitoring",
      "Email alerts on new CVEs",
      "Full vulnerability report",
    ],
    cta: "Upgrade to Pro",
    href: "/signup",
    highlighted: true,
  },
  {
    name: "Team",
    price: "$79",
    period: "/mo",
    description: "For teams building with MCP at scale.",
    features: [
      "5 team seats",
      "API access",
      "Slack integration",
      "Everything in Pro",
    ],
    cta: "Contact Sales",
    href: "/signup",
  },
];

export const PricingSection = () => {
  return (
    <section id="pricing" className="border-b border-border/60 bg-muted/20">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-muted-foreground">
            Start free. Upgrade when you need continuous monitoring and alerts.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {tiers.map((tier) => (
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
                <CardDescription>{tier.description}</CardDescription>
                <div className="pt-2">
                  <span className="text-4xl font-bold">{tier.price}</span>
                  {tier.period ? (
                    <span className="text-muted-foreground">{tier.period}</span>
                  ) : null}
                </div>
              </CardHeader>

              <CardContent className="flex-1">
                <ul className="space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check
                        className="mt-0.5 size-4 shrink-0 text-primary"
                        aria-hidden
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                <Button
                  className="w-full"
                  variant={tier.highlighted ? "default" : "outline"}
                  asChild
                >
                  <Link href={tier.href}>{tier.cta}</Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
