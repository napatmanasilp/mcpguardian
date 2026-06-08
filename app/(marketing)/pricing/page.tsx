import { Check, X } from "lucide-react";
import Link from "next/link";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

const faqItems = [
  {
    question: "Can I cancel anytime?",
    answer:
      "Yes. Cancel from your dashboard anytime. You keep Pro access until the end of your billing period.",
  },
  {
    question: "What happens when I downgrade?",
    answer:
      "You keep Pro features until your current period ends. Then you return to 3 scans/month on the Free plan.",
  },
  {
    question: "Do you offer annual billing?",
    answer:
      "Not yet — annual billing with a discount is coming soon.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "All major credit and debit cards, processed securely through Polar.",
  },
  {
    question: "Is there a free trial?",
    answer:
      "The Free plan is free forever. Try ShieldMCP risk-free before upgrading.",
  },
];

const freeFeatures = [
  { text: "3 scans per month", included: true },
  { text: "Basic security report", included: true },
  { text: "A-F security grading", included: true },
  { text: "6 vulnerability checks", included: true },
  { text: "Continuous monitoring", included: false },
  { text: "Email alerts", included: false },
  { text: "Team members", included: false },
  { text: "API access", included: false },
];

const proFeatures = [
  { text: "Unlimited scans", included: true },
  { text: "Detailed security reports with export", included: true },
  { text: "Continuous daily monitoring", included: true },
  { text: "Email alerts for critical issues", included: true },
  { text: "Scan history and trends", included: true },
  { text: "Priority vulnerability updates", included: true },
  { text: "Team members", included: false },
  { text: "API access", included: false },
];

const teamFeatures = [
  { text: "Everything in Pro", included: true },
  { text: "Up to 5 team members", included: true },
  { text: "API access for CI/CD integration", included: true },
  { text: "Hourly monitoring frequency", included: true },
  { text: "Priority support", included: true },
  { text: "Compliance reports", included: true },
];

const PricingPage = async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const proUrl = process.env.NEXT_PUBLIC_POLAR_PRO_URL || "/signup";
  const proHref = user && proUrl.startsWith("http")
    ? `${proUrl}?metadata%5Buser_id%5D=${encodeURIComponent(user.id)}`
    : proUrl;

  return (
    <main className="flex flex-1 flex-col items-center gap-12 px-6 py-16 md:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
          Simple, Transparent Pricing
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Start scanning for free. Upgrade when you need more.
        </p>
      </div>

      <div className="mx-auto grid w-full max-w-5xl gap-8 md:grid-cols-3">
        <Card className="relative flex flex-col">
          <CardHeader>
            <CardTitle>Free</CardTitle>
            <div className="mt-2">
              <span className="text-4xl font-bold">$0</span>
              <span className="ml-1 text-sm text-muted-foreground">/month</span>
            </div>
            <CardDescription>Perfect for trying out ShieldMCP</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <ul className="space-y-3">
              {freeFeatures.map((feature) => (
                <li key={feature.text} className="flex items-start gap-3 text-sm">
                  {feature.included ? (
                    <Check className="mt-0.5 size-4 shrink-0 text-green-500" />
                  ) : (
                    <X className="mt-0.5 size-4 shrink-0 text-muted-foreground/40" />
                  )}
                  <span className={feature.included ? "" : "text-muted-foreground/40"}>
                    {feature.text}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" size="lg" asChild>
              <Link href="/signup">Get Started</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card className="relative flex flex-col ring-2 ring-primary">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <Badge variant="default" className="px-4 py-1 text-xs">
              MOST POPULAR
            </Badge>
          </div>
          <CardHeader>
            <CardTitle>Pro</CardTitle>
            <div className="mt-2">
              <span className="text-4xl font-bold">$29</span>
              <span className="ml-1 text-sm text-muted-foreground">/month</span>
            </div>
            <CardDescription>For developers shipping with MCP daily</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <ul className="space-y-3">
              {proFeatures.map((feature) => (
                <li key={feature.text} className="flex items-start gap-3 text-sm">
                  {feature.included ? (
                    <Check className="mt-0.5 size-4 shrink-0 text-green-500" />
                  ) : (
                    <X className="mt-0.5 size-4 shrink-0 text-muted-foreground/40" />
                  )}
                  <span className={feature.included ? "" : "text-muted-foreground/40"}>
                    {feature.text}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button variant="default" className="w-full" size="lg" asChild>
              <Link href={proHref}>Upgrade to Pro</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card className="relative flex flex-col">
          <CardHeader>
            <CardTitle>Team</CardTitle>
            <div className="mt-2">
              <span className="text-4xl font-bold">$79</span>
              <span className="ml-1 text-sm text-muted-foreground">/month</span>
            </div>
            <CardDescription>For teams managing multiple MCP deployments</CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            <ul className="space-y-3">
              {teamFeatures.map((feature) => (
                <li key={feature.text} className="flex items-start gap-3 text-sm">
                  {feature.included ? (
                    <Check className="mt-0.5 size-4 shrink-0 text-green-500" />
                  ) : (
                    <X className="mt-0.5 size-4 shrink-0 text-muted-foreground/40" />
                  )}
                  <span className={feature.included ? "" : "text-muted-foreground/40"}>
                    {feature.text}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" size="lg" asChild>
              <Link href="mailto:hello@shieldmcp.dev">Contact Us</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>

      <div className="mx-auto w-full max-w-2xl">
        <h2 className="mb-6 text-center text-xl font-semibold">
          Frequently Asked Questions
        </h2>
        <Accordion type="single" collapsible className="w-full">
          {faqItems.map((item, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger>{item.question}</AccordionTrigger>
              <AccordionContent>{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </main>
  );
};

export default PricingPage;