import Link from "next/link";
import { Code, ScanSearch } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TerminalPreview } from "@/components/marketing/terminal-preview";

export const HeroSection = () => {
  return (
    <section className="relative overflow-hidden border-b border-white/10">
      {/* Background — Grid pattern + blue glow */}
      <div className="absolute inset-0 overflow-hidden -z-10">
        <div
          className="absolute inset-0 bg-[linear-gradient(to_right,hsl(217,33%,14%)_1px,transparent_1px),linear-gradient(to_bottom,hsl(217,33%,14%)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,black_60%,transparent_100%)]"
        />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 size-[600px] rounded-full bg-blue-500/8 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="grid gap-12 md:grid-cols-2 md:items-center">
          {/* LEFT COLUMN — Content */}
          <div>
            {/* Trust badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-mono mb-6">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-blue-500" />
              </span>
              OWASP MCP Top 10 Coverage
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1]">
              Security Guardrails
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                for Every MCP Server
              </span>
              <br />
              &amp; AI Agent.
            </h1>

            {/* Subheadline */}
            <p className="text-lg text-slate-400 mt-4 max-w-lg leading-relaxed">
              MCPGuardian scans, proxies, and monitors every MCP server your AI
              agents connect to &mdash; blocking tool poisoning, rug-pulls, and CVEs
              before and during runtime.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-3 mt-8">
              <Link href="/scan">
                <Button
                  size="lg"
                  className="gap-2 text-base h-12 px-6 shadow-lg shadow-blue-500/25"
                >
                  <ScanSearch className="size-5" />
                  Scan Your Config Free
                </Button>
              </Link>
              <a href="/api/mcp-server" target="_blank" rel="noopener noreferrer">
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2 text-base h-12 px-6 border-white/15 hover:border-white/25"
                >
                  <Code className="size-5" />
                  Connect as MCP Tool
                </Button>
              </a>
            </div>

            {/* Feature pills */}
            <div className="flex flex-wrap gap-2 mt-6">
              {[
                "⚡ Sub-second scan",
                "🔄 Rug pull detection",
                "🛡 36 issue types",
                "🔗 Runtime proxy",
                "📋 OWASP MCP Top 10",
                "🔒 Policy enforcement",
              ].map((pill) => (
                <span
                  key={pill}
                  className="px-2.5 py-1 rounded-full text-xs border border-white/10 bg-white/5 text-slate-400"
                >
                  {pill}
                </span>
              ))}
            </div>
          </div>

          {/* RIGHT COLUMN — Terminal Preview */}
          <div className="rounded-xl border border-white/10 bg-[hsl(222,47%,6%)] shadow-2xl shadow-black/50 overflow-hidden">
            {/* Terminal chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-[hsl(222,47%,5%)]">
              <span className="size-3 rounded-full bg-red-500/70" />
              <span className="size-3 rounded-full bg-amber-500/70" />
              <span className="size-3 rounded-full bg-emerald-500/70" />
              <span className="ml-2 text-xs font-mono text-slate-500">
                mcpguardian scan
              </span>
            </div>

            {/* Terminal content */}
            <TerminalPreview />
          </div>
        </div>
      </div>
    </section>
  );
};
