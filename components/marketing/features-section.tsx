import { Bug, Eye, GitBranch, Package, Radar, ShieldCheck } from "lucide-react";

import {
  Card,
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
    color: "blue",
    iconBg: "bg-blue-500/15 border-blue-500/20",
    iconColor: "text-blue-400",
    hoverBorder: "hover:border-blue-500/30 hover:bg-blue-500/3",
  },
  {
    icon: Radar,
    title: "CVE Monitoring & Alerts",
    description:
      "Track new CVEs affecting MCP servers and dependencies. Get notified when vulnerabilities are discovered.",
    color: "blue",
    iconBg: "bg-blue-500/15 border-blue-500/20",
    iconColor: "text-blue-400",
    hoverBorder: "hover:border-blue-500/30 hover:bg-blue-500/3",
  },
  {
    icon: Bug,
    title: "Tool Poisoning Detection",
    description:
      "AI-powered analysis catches hidden malicious instructions in tool definitions before they reach your agents.",
    color: "blue",
    iconBg: "bg-blue-500/15 border-blue-500/20",
    iconColor: "text-blue-400",
    hoverBorder: "hover:border-blue-500/30 hover:bg-blue-500/3",
  },
  {
    icon: GitBranch,
    title: "Rug Pull Detection",
    description:
      "Detects when MCP servers silently change tool definitions between scans — a top-2026 supply chain attack vector.",
    color: "purple",
    iconBg: "bg-purple-500/15 border-purple-500/20",
    iconColor: "text-purple-400",
    hoverBorder: "hover:border-purple-500/30 hover:bg-purple-500/3",
  },
  {
    icon: Package,
    title: "SBOM Generation",
    description:
      "Automatically generates a Software Bill of Materials from your MCP configuration, with CVE cross-references for every dependency.",
    color: "amber",
    iconBg: "bg-amber-500/15 border-amber-500/20",
    iconColor: "text-amber-400",
    hoverBorder: "hover:border-amber-500/30 hover:bg-amber-500/3",
  },
  {
    icon: Eye,
    title: "Continuous Monitoring",
    description:
      "Schedule daily scans of your MCP configurations and receive instant email alerts when new vulnerabilities are found.",
    color: "emerald",
    iconBg: "bg-emerald-500/15 border-emerald-500/20",
    iconColor: "text-emerald-400",
    hoverBorder: "hover:border-emerald-500/30 hover:bg-emerald-500/3",
  },
];

export const FeaturesSection = () => {
  return (
    <section id="features" className="border-b border-white/10">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl text-slate-100">
            Security built for MCP developers
          </h2>
          <p className="mt-4 text-slate-400">
            Everything you need to audit, monitor, and protect your MCP server
            configurations.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className={`border-white/10 bg-[hsl(222,47%,6%)] ${feature.hoverBorder} transition-all duration-300 group`}
            >
              <CardHeader>
                <div
                  className={`size-10 rounded-lg ${feature.iconBg} border flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}
                >
                  <feature.icon className={`size-5 ${feature.iconColor}`} aria-hidden />
                </div>
                <CardTitle className="text-lg text-slate-200">{feature.title}</CardTitle>
                <CardDescription className="text-sm leading-relaxed text-slate-400">
                  {feature.description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};
