import { Bug, Radar, ShieldCheck } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const features = [
  {
    icon: ShieldCheck,
    title: "Instant Security Grade",
    description:
      "Paste your MCP config and get an A–F security score in seconds. See exactly what's putting your setup at risk.",
  },
  {
    icon: Radar,
    title: "CVE Monitoring",
    description:
      "Track new CVEs affecting MCP servers and dependencies. Get notified when vulnerabilities are discovered.",
  },
  {
    icon: Bug,
    title: "Tool Poisoning Detection",
    description:
      "AI-powered analysis catches hidden malicious instructions in tool definitions before they reach your agents.",
  },
];

export const FeaturesSection = () => {
  return (
    <section id="features" className="border-b border-border/60">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Security built for MCP developers
          </h2>
          <p className="mt-4 text-muted-foreground">
            Everything you need to audit, monitor, and protect your MCP server
            configurations.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title} className="border-border/60 bg-card/50">
              <CardHeader>
                <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <feature.icon className="size-5" aria-hidden />
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
