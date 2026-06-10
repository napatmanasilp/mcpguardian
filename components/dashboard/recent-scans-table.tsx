"use client";

import { Eye } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ScanResult } from "@/lib/scanner/types";

// ─── Types ─────────────────────────────────────────────────────────────

interface ScanRow {
  id: string;
  overall_grade: string;
  overall_score: number;
  servers_scanned: number;
  critical_issues: number;
  high_issues: number;
  results: unknown;
  created_at: string;
}

interface RecentScansTableProps {
  scans: ScanRow[];
}

// ─── Helpers ───────────────────────────────────────────────────────────

function extractTopIssue(results: unknown): { severity: string; type: string } | null {
  if (!results || typeof results !== "object") return null;
  const r = results as Partial<ScanResult>;
  if (!r.servers || !Array.isArray(r.servers)) return null;

  for (const server of r.servers) {
    if (!server.issues || !Array.isArray(server.issues)) continue;
    for (const issue of server.issues) {
      if (issue.severity === "CRITICAL") {
        return { severity: "CRITICAL", type: issue.type };
      }
    }
  }

  for (const server of r.servers) {
    if (!server.issues || !Array.isArray(server.issues)) continue;
    for (const issue of server.issues) {
      if (issue.severity === "HIGH") {
        return { severity: "HIGH", type: issue.type };
      }
    }
  }

  return null;
}

const gradeBadgeStyles = (grade: string) => {
  if (grade === "A") return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (grade === "B") return "bg-blue-500/20 text-blue-400 border-blue-500/30";
  if (grade === "C") return "bg-amber-500/20 text-amber-400 border-amber-500/30";
  if (grade === "D") return "bg-orange-500/20 text-orange-400 border-orange-500/30";
  return "bg-red-500/20 text-red-400 border-red-500/30";
};

// ─── Component ─────────────────────────────────────────────────────────

export function RecentScansTable({ scans }: RecentScansTableProps) {
  const handleRowClick = (id: string) => {
    window.location.href = `/reports/${id}`;
  };

  const handleRowKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      window.location.href = `/reports/${id}`;
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-xs text-slate-500 font-mono uppercase tracking-wider">
            <th className="text-left px-3 py-2.5 font-medium">Date</th>
            <th className="text-left px-3 py-2.5 font-medium">Score</th>
            <th className="text-left px-3 py-2.5 font-medium">Servers</th>
            <th className="text-left px-3 py-2.5 font-medium hidden sm:table-cell">Issues</th>
            <th className="text-left px-3 py-2.5 font-medium hidden md:table-cell">Top Issue</th>
          </tr>
        </thead>
        <tbody>
          {scans.map((scan) => {
            const topIssue = extractTopIssue(scan.results);
            const critCount = scan.critical_issues ?? 0;
            const highCount = scan.high_issues ?? 0;
            return (
              <tr
                key={scan.id}
                onClick={() => handleRowClick(scan.id)}
                onKeyDown={(e) => handleRowKeyDown(e, scan.id)}
                tabIndex={0}
                role="link"
                className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-blue-500/50"
              >
                <td className="px-3 py-3 text-slate-300 whitespace-nowrap">
                  {new Date(scan.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold tabular-nums">{scan.overall_score}</span>
                    <span className="text-slate-500 text-xs">/100</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-mono px-1.5 py-0 rounded border",
                        gradeBadgeStyles(scan.overall_grade),
                      )}
                    >
                      {scan.overall_grade}
                    </Badge>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Eye className="size-3.5" />
                    <span className="font-mono tabular-nums">{scan.servers_scanned}</span>
                  </div>
                </td>
                <td className="px-3 py-3 hidden sm:table-cell">
                  <div className="flex items-center gap-1.5">
                    {critCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                        {critCount} CRIT
                      </span>
                    )}
                    {highCount > 0 && critCount === 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">
                        {highCount} HIGH
                      </span>
                    )}
                    {critCount === 0 && highCount === 0 && (
                      <span className="text-[10px] text-slate-500">—</span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3 hidden md:table-cell">
                  {topIssue ? (
                    <span
                      className={cn(
                        "text-[10px] font-mono font-bold",
                        topIssue.severity === "CRITICAL" ? "text-red-400" : "text-orange-400",
                      )}
                    >
                      {topIssue.type}
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-600">No issues</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
