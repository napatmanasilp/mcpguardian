import Link from "next/link";
import { Shield, Zap, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TerminalPreview } from "@/components/marketing/terminal-preview";

export const HeroSection = () => {
  return (
    <section className="relative overflow-hidden border-b border-white/10">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden -z-10">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(217,33%,14%)_1px,transparent_1px),linear-gradient(to_bottom,hsl(217,33%,14%)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,black_60%,transparent_100%)]" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 size-[600px] rounded-full bg-blue-500/8 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="grid gap-12 md:grid-cols-2 md:items-center">
          {/* LEFT — Content */}
          <div>
            {/* Trust badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-mono mb-6">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-blue-500" />
              </span>
              NSA MCP CSI + OWASP MCP Top 10 Compliant
            </div>

            {/* H1 — Primary keyword for SEO */}
            <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-black tracking-tight leading-[1.1]">
              Scan &amp; Protect
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
                Every MCP Server
              </span>
              <br />
              Your AI Agents Use.
            </h1>

            {/* Value prop — what they get */}
            <p className="text-lg text-slate-400 mt-4 max-w-lg leading-relaxed">
              MCPGuardian scans your MCP config, tells you exactly what&apos;s unsafe,
              gives you the fixed config to apply, and blocks attacks at runtime.
              Free for 50 scans/month.
            </p>

            {/* Single primary CTA above fold */}
            <div className="flex flex-wrap gap-3 mt-8">
              <Link href="/signup">
                <Button
                  size="lg"
                  className="gap-2 text-base h-12 px-8 shadow-lg shadow-blue-500/25 bg-blue-500 hover:bg-blue-600"
                >
                  <Zap className="size-5" />
                  Start Free — No Credit Card
                </Button>
              </Link>
              <Link href="#how-it-works">
                <Button
                  size="lg"
                  variant="outline"
                  className="gap-2 text-base h-12 px-6 border-white/15 hover:border-white/25"
                >
                  See How It Works
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
            </div>

            {/* Trust signals — reduce anxiety */}
            <div className="flex items-center gap-4 mt-6 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Shield className="size-3.5 text-green-500" />
                50 free scans/month
              </span>
              <span>•</span>
              <span>No credit card</span>
              <span>•</span>
              <span>Setup in 30 seconds</span>
            </div>
          </div>

          {/* RIGHT — Terminal Preview */}
          <div className="rounded-xl border border-white/10 bg-[hsl(222,47%,6%)] shadow-2xl shadow-black/50 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-[hsl(222,47%,5%)]">
              <span className="size-3 rounded-full bg-red-500/70" />
              <span className="size-3 rounded-full bg-amber-500/70" />
              <span className="size-3 rounded-full bg-emerald-500/70" />
              <span className="ml-2 text-xs font-mono text-slate-500">
                mcpguardian scan → remediation
              </span>
            </div>
            <TerminalPreview />
          </div>
        </div>
      </div>
    </section>
  );
};
