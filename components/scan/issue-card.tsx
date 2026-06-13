"use client";

import { Lightbulb } from "lucide-react";

import { cn } from "@/lib/utils";
import { SEVERITY_COLORS, OWASP_COLORS } from "@/lib/design-tokens";
import type { Issue } from "@/lib/scanner/types";
import { RugPullDiff } from "@/components/scan/rug-pull-diff";

interface IssueCardProps {
  issue: Issue;
}

export function IssueCard({ issue }: IssueCardProps) {
  const colors = SEVERITY_COLORS[issue.severity] ?? SEVERITY_COLORS.INFO;

  return (
    <div className={cn("rounded-lg border p-3 space-y-2.5", colors.border, colors.bg)}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Severity badge */}
          <span className={cn("px-2 py-0.5 rounded text-[11px] font-mono font-bold border", colors.badge)}>
            {issue.severity}
          </span>
          {/* Issue type */}
          <span className="text-xs font-mono text-slate-500">{issue.type}</span>
        </div>
        {/* OWASP compliance badges */}
        <div className="flex gap-1 flex-shrink-0 flex-wrap justify-end">
          {issue.compliance?.owasp_mcp?.map((cat) => (
            <span
              key={cat}
              className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border",
                OWASP_COLORS[cat],
              )}
            >
              {cat}
            </span>
          ))}
          {issue.compliance?.cwe?.map((cwe) => (
            <span
              key={cwe}
              className="px-1.5 py-0.5 rounded text-[10px] font-mono border border-slate-600 text-slate-400"
            >
              {cwe}
            </span>
          ))}
        </div>
      </div>

      {/* Title */}
      <p className="text-sm font-semibold text-slate-200">{issue.title}</p>

      {/* Description */}
      <p className="text-xs text-slate-400 leading-relaxed">{issue.description}</p>

      {/* Rug pull diff viewer */}
      {issue.type === "RUG_PULL_DETECTED" && issue.diff && (
        <RugPullDiff diff={issue.diff} />
      )}

      {/* Fix box */}
      {issue.fix && (
        <div className="rounded-md border border-white/10 bg-white/[0.03] p-2.5 flex gap-2">
          <Lightbulb className="size-3.5 text-caution mt-0.5 flex-shrink-0" />
          <p className="text-xs text-slate-300 leading-relaxed">{issue.fix}</p>
        </div>
      )}
    </div>
  );
}
