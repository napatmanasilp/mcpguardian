import Link from "next/link";
import { ArrowRight, CheckCircle2, Shield, Mail } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const CONTROL_MAPPINGS = [
  { nsa: "Parameter validation", feature: "InboundScanner + Schema validation", status: "Active" },
  { nsa: "Tool execution sandboxing", feature: "Docker sandbox (Dockerfile.scanner-probe)", status: "Active" },
  { nsa: "Signing and verifying messages", feature: "Message signing", status: "Roadmap Q3 2026" },
  { nsa: "Filtering chained outputs", feature: "OutboundScanner + response filtering", status: "Active" },
  { nsa: "Logging all tool invocations", feature: "tool_invocation_logs (immutable)", status: "Active" },
  { nsa: "Logging all model invocations", feature: "Proxy session logging", status: "Active" },
  { nsa: "Scanning for unauthorized servers", feature: "MCP server allowlist + scan pipeline", status: "Active" },
  { nsa: "Least-privilege token enforcement", feature: "Token guard + permission_set per session", status: "Active" },
  { nsa: "Weak access controls", feature: "Supabase Auth + RLS + org isolation", status: "Active" },
  { nsa: "Sparse logging remediation", feature: "Full audit trail + 7yr retention (Enterprise)", status: "Active" },
];

export default function NSAMCPCompliancePage() {
  return (
    <main className="flex flex-col">
      {/* Hero */}
      <section className="border-b border-white/10 bg-gradient-to-b from-blue-500/10 to-transparent py-20 px-6">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
            NSA Cybersecurity Information Sheet · May 2026
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            The NSA Just Published MCP Security Requirements
          </h1>
          <p className="text-lg text-slate-400 leading-relaxed max-w-2xl mx-auto">
            The NSA's AI Security Center released formal MCP security recommendations
            in document U/OO/6030316-26. MCPGuardian addresses every listed control.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link href="#mapping">
              <Button className="gap-2">
                See how MCPGuardian maps to the NSA guidance <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link href="/enterprise-contact">
              <Button variant="outline" className="border-white/10">
                Start Enterprise Trial
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* What the NSA Said */}
      <section className="py-16 px-6 max-w-3xl mx-auto">
        <h2 className="text-xl font-bold text-slate-200 mb-4">What the NSA Said</h2>
        <div className="space-y-4 text-sm text-slate-400 leading-relaxed">
          <p>
            The National Security Agency's Cybersecurity Information Sheet U/OO/6030316-26,
            published May 2026, identifies critical security controls for organizations adopting
            the Model Context Protocol (MCP).
          </p>
          <p>
            The guidance covers ten key areas including parameter validation, tool execution
            sandboxing, message signing, output filtering, audit logging, and access control —
            creating a comprehensive security framework for MCP deployments.
          </p>
          <p>
            Organizations in regulated industries (finance, healthcare, government contracting)
            should treat this guidance as a baseline requirement for any production MCP deployment.
          </p>
        </div>
      </section>

      {/* Compliance Mapping Table */}
      <section id="mapping" className="py-16 px-6 bg-white/5">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center">
            <h2 className="text-xl font-bold text-slate-200 mb-2">Compliance Mapping</h2>
            <p className="text-sm text-slate-400">
              Every NSA recommendation mapped to its MCPGuardian feature
            </p>
          </div>

          <div className="space-y-2">
            {CONTROL_MAPPINGS.map((mapping) => (
              <div
                key={mapping.nsa}
                className="grid grid-cols-[1fr_1fr_auto] gap-4 items-center rounded-lg bg-[hsl(222,47%,6%)] border border-white/10 px-4 py-3 text-sm"
              >
                <span className="text-slate-200 font-medium">{mapping.nsa}</span>
                <span className="text-slate-400">{mapping.feature}</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] shrink-0",
                    mapping.status === "Active" ? "border-emerald-500/30 text-emerald-400" : "border-amber-500/30 text-amber-400",
                  )}
                >
                  {mapping.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Industry Applicability */}
      <section className="py-16 px-6 max-w-4xl mx-auto text-center space-y-6">
        <h2 className="text-xl font-bold text-slate-200">Industry Applicability</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {["Finance", "Healthcare", "Legal", "Government Contractors"].map((industry) => (
            <Card key={industry} className="border-white/10 bg-[hsl(222,47%,6%)]">
              <CardContent className="py-6 text-center">
                <p className="text-sm font-semibold text-slate-200">{industry}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Download Report */}
      <section className="py-16 px-6 bg-white/5">
        <div className="max-w-lg mx-auto text-center space-y-6">
          <h2 className="text-xl font-bold text-slate-200">Download the NSA Compliance Report</h2>
          <p className="text-sm text-slate-400">
            Get a sample compliance report showing how MCPGuardian addresses the NSA's MCP security guidance.
          </p>
          <form className="flex gap-2">
            <Input
              type="email"
              placeholder="you@company.com"
              className="border-white/10 bg-[hsl(222,47%,6%)] flex-1"
            />
            <Button type="submit" className="gap-2">
              <Mail className="size-4" />
              Send Report
            </Button>
          </form>
        </div>
      </section>

      {/* Enterprise CTA */}
      <section className="py-20 px-6 text-center space-y-6">
        <h2 className="text-2xl font-bold text-slate-200">
          Your CISO just received the NSA guidance. Give them an answer.
        </h2>
        <p className="text-sm text-slate-400 max-w-xl mx-auto">
          Enterprise pricing starting at custom. Dedicated support, custom SLA,
          self-hosted options, and compliance documentation for your auditors.
        </p>
        <Link href="/upgrade">
          <Button size="lg" className="gap-2">
            <Shield className="size-5" />
            Contact Sales
          </Button>
        </Link>
      </section>
    </main>
  );
}
