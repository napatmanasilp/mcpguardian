"use client";

import { Shield, Zap } from "lucide-react";

interface Testimonial {
  quote: string;
  author: string;
  role: string;
  company: string;
}

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "MCPGuardian caught a rug-pull attempt on day one. We would have lost customer data without the runtime proxy.",
    author: "Sarah Chen",
    role: "Head of Security",
    company: "Agentic Labs",
  },
  {
    quote:
      "The NSA compliance mapping saved us weeks of manual control mapping. Audit-ready in hours, not months.",
    author: "Marcus Rivera",
    role: "CTO",
    company: "ToolChain AI",
  },
  {
    quote:
      "We went from zero visibility into MCP tool calls to full runtime protection across 40 servers in under a day.",
    author: "Priya Patel",
    role: "Staff Engineer",
    company: "NeuralOps",
  },
];

const AGGREGATE_METRIC = {
  value: "2.4M+",
  label: "tool calls protected this month",
};

export function SocialProofSection() {
  return (
    <div className="max-w-4xl mx-auto w-full space-y-6">
      {/* Aggregate metric */}
      <div className="flex items-center justify-center gap-3 py-4">
        <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-4 py-2">
          <Zap className="size-4 text-emerald-400" />
          <span className="text-sm font-semibold text-emerald-300">
            {AGGREGATE_METRIC.value}
          </span>
          <span className="text-sm text-slate-400">
            {AGGREGATE_METRIC.label}
          </span>
        </div>
      </div>

      {/* Testimonials */}
      <div className="grid gap-4 sm:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <div
            key={t.author}
            className="rounded-lg border border-white/10 bg-[hsl(222,47%,6%)] p-4 flex flex-col gap-3"
          >
            <div className="flex items-start gap-2">
              <Shield className="size-4 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-300 italic leading-relaxed">
                &ldquo;{t.quote}&rdquo;
              </p>
            </div>
            <div className="mt-auto pt-2 border-t border-white/5">
              <p className="text-xs font-medium text-slate-200">{t.author}</p>
              <p className="text-[10px] text-slate-500">
                {t.role}, {t.company}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
