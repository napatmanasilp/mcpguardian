"use client";

import Link from "next/link";
import { ArrowRight, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ScanThreat {
  id: string;
  overall_result: string | null;
  risk_score: number | null;
  findings: unknown;
  created_at: string;
  mcp_server_id?: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function resultColor(result: string | null): string {
  if (result === "malicious") return "border-l-red-500/60 bg-red-500/5";
  if (result === "suspicious") return "border-l-amber-400/60 bg-amber-500/5";
  return "border-l-emerald-500/60 bg-emerald-500/5";
}

function resultLabel(result: string | null): string {
  if (result === "malicious") return "Malicious";
  if (result === "suspicious") return "Suspicious";
  return "Clean";
}

function getFindingsCount(findings: unknown): number {
  if (Array.isArray(findings)) return findings.length;
  return 0;
}

export function ThreatFeedSection({ threats }: { threats: ScanThreat[] }) {
  if (!threats || threats.length === 0) return null;

  return (
    <Card className="border-white/10 bg-bg-surface animate-slide-up">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-threat" />
            <CardTitle className="text-sm font-semibold text-slate-200">Recent Security Findings</CardTitle>
          </div>
          <Link href="/alerts">
            <Button size="xs" variant="link" className="text-[10px] text-blue-400 gap-1">
              View all <ArrowRight className="size-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {threats.slice(0, 10).map((scan, i) => {
          const findingsCount = getFindingsCount(scan.findings);
          return (
            <Link
              key={scan.id}
              href={`/reports/${scan.id}`}
              className={cn(
                "group flex items-center justify-between border-l-2 pl-3 pr-2 py-2 rounded-r-md transition-all duration-150 hover:brightness-110",
                resultColor(scan.overall_result),
              )}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={cn(
                  "font-mono text-xs font-bold",
                  scan.risk_score && scan.risk_score > 60 ? "text-red-400" :
                  scan.risk_score && scan.risk_score > 30 ? "text-amber-400" :
                  "text-emerald-400"
                )}>
                  {scan.risk_score ?? 0}
                </span>
                <Badge
                  variant={scan.overall_result === "malicious" ? "destructive" : "secondary"}
                  className="text-[9px] px-1 py-0 h-4 shrink-0"
                >
                  {resultLabel(scan.overall_result)}
                </Badge>
                {findingsCount > 0 && (
                  <span className="text-[10px] text-slate-500">{findingsCount} finding{findingsCount > 1 ? "s" : ""}</span>
                )}
              </div>
              <span className="text-[10px] font-mono text-slate-500 shrink-0 ml-2">
                {timeAgo(scan.created_at)}
              </span>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
