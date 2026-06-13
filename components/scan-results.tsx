"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  Eye,
  FileText,
  GitBranch,
  Layers,
  Lightbulb,
  Loader2,
  Lock,
  LockOpen,
  Package,
  Plus,
  RotateCcw,
  Shield,
  Skull,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MiniScoreRing } from "@/components/scan/mini-score-ring";
import { IssueCard } from "@/components/scan/issue-card";
import { cn } from "@/lib/utils";
import { GRADE_STYLES, OWASP_COLORS, OWASP_LABELS, SEVERITY_COLORS } from "@/lib/design-tokens";
import type { Grade, ScanResult, Severity } from "@/lib/scanner/types";

// ─── Types ─────────────────────────────────────────────────────────────

interface ScanResultsProps {
  result: ScanResult;
  config?: string;
  onReset?: () => void;
}

interface SeverityLevel {
  level: string;
  label: string;
  color: { bg: string; text: string };
}

const SEVERITY_LEVELS: SeverityLevel[] = [
  { level: "CRITICAL", label: "Critical", color: { bg: "bg-threat", text: "text-threat" } },
  { level: "HIGH", label: "High", color: { bg: "bg-threat", text: "text-threat" } },
  { level: "MEDIUM", label: "Medium", color: { bg: "bg-caution", text: "text-caution" } },
  { level: "LOW", label: "Low", color: { bg: "bg-monitor", text: "text-monitor" } },
  { level: "INFO", label: "Info", color: { bg: "bg-slate-500", text: "text-slate-400" } },
];

const OWASP_CATEGORIES = ["MCP01", "MCP02", "MCP03", "MCP04", "MCP05", "MCP06", "MCP07", "MCP08", "MCP09", "MCP10"];

// ─── Sub-components ────────────────────────────────────────────────────

function AnimatedScoreRing({ grade, score }: { grade: Grade; score: number }) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const animRef = useRef<number | null>(null);

  const gradeToHex: Record<string, string> = {
    A: "#10b981",
    B: "#3b82f6",
    C: "#f59e0b",
    D: "#f97316",
    F: "#ef4444",
  };
  const hexColor = gradeToHex[grade] ?? "#ef4444";
  const circumference = 2 * Math.PI * 52; // r=52

  useEffect(() => {
    const duration = 800;
    const start = performance.now();
    const from = 0;
    const to = score;

    animRef.current = requestAnimationFrame(function animate(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(from + (to - from) * eased);
      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      }
    });

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [score]);

  const dashOffset = circumference - (animatedScore / 100) * circumference;

  return (
    <svg viewBox="0 0 120 120" className="size-32 shrink-0">
      {/* Background track */}
      <circle
        cx="60" cy="60" r="52"
        fill="none" stroke="currentColor"
        className="text-white/5" strokeWidth="8"
      />
      {/* Animated score arc */}
      <circle
        cx="60" cy="60" r="52"
        fill="none"
        stroke={hexColor}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={dashOffset}
        transform="rotate(-90 60 60)"
        className="transition-none"
        style={{ filter: `drop-shadow(0 0 6px ${hexColor}40)` }}
      />
      {/* Grade letter */}
      <text x="60" y="55" textAnchor="middle" dominantBaseline="central" className="text-3xl font-black" fill={hexColor}>
        {grade}
      </text>
      {/* Score number below grade */}
      <text x="60" y="76" textAnchor="middle" className="text-[10px]" fill={hexColor} opacity="0.6">
        {Math.round(animatedScore)}/100
      </text>
    </svg>
  );
}

function SeverityBars({ result }: { result: ScanResult }) {
  const issues = result.servers.flatMap((s) => s.issues);
  const crossServerRisks = result.crossServerRisks ?? [];
  const allItems = [...issues, ...crossServerRisks];

  const counts: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  for (const item of allItems) {
    const sev = item.severity as string;
    if (sev in counts) counts[sev]++;
    else counts[sev] = 1;
  }
  const totalIssues = Object.values(counts).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="space-y-2.5">
      {SEVERITY_LEVELS.map(({ level, label, color }) => {
        const count = counts[level] ?? 0;
        const pct = (count / totalIssues) * 100;
        return (
          <div key={level} className="flex items-center gap-3">
            <span className={cn("w-16 text-xs font-mono font-medium", color.text)}>{label}</span>
            <div className="flex-1 h-2 rounded-full bg-white/5">
              <div
                className={cn("h-full rounded-full transition-all duration-700", color.bg)}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-5 text-right text-xs font-mono tabular-nums text-slate-400">
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function OwaspGrid({ result }: { result: ScanResult }) {
  const triggered = result.complianceSummary?.owasp_mcp ?? [];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
      {OWASP_CATEGORIES.map((cat) => {
        const hasFindings = triggered.includes(cat);
        return (
          <div
            key={cat}
            className={cn(
              "rounded-lg border p-2.5 text-center transition-all hover:scale-105 cursor-default",
              hasFindings
                ? cn(OWASP_COLORS[cat], "border-current/30")
                : "border-white/5 text-slate-600",
            )}
          >
            <div className="font-mono text-xs font-bold">{cat}</div>
            <div className="text-[10px] mt-0.5 leading-tight">{OWASP_LABELS[cat]}</div>
            <div className="mt-1">
              {hasFindings ? (
                <span className="text-[9px] font-semibold">⚠ FLAGGED</span>
              ) : (
                <span className="text-[9px]">✓ CLEAN</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SbomTable({ result }: { result: ScanResult }) {
  const sbom = result.sbom;
  if (!sbom || sbom.length === 0) return null;

  const cveCount = sbom.reduce((sum, e) => sum + e.cve_matches.length, 0);
  const hasCveMatches = cveCount > 0;

  return (
    <details className="group" open={hasCveMatches}>
      <summary className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-300 hover:text-white py-3 border-t border-white/10 select-none">
        <Package className="size-4 text-monitor" />
        Software Bill of Materials
        <span className="text-xs font-mono text-slate-500 font-normal">
          ({sbom.length} package{sbom.length !== 1 ? "s" : ""}
          {cveCount > 0 && `, ${cveCount} CVE match${cveCount !== 1 ? "es" : ""}`})
        </span>
        <ChevronDown className="size-4 ml-auto transition-transform group-open:rotate-180" />
      </summary>
      <div className="mt-2 rounded-lg border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-slate-400">
                <th className="text-left px-3 py-2 font-medium">Package</th>
                <th className="text-left px-3 py-2 font-medium">Version</th>
                <th className="text-left px-3 py-2 font-medium">CVE Matches</th>
                <th className="text-left px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {sbom.map((entry, i) => (
                <tr
                  key={i}
                  className={cn(
                    "border-b border-white/5",
                    entry.cve_matches.length > 0 ? "bg-threat/5" : "hover:bg-white/[0.02]",
                  )}
                >
                  <td className="px-3 py-2 text-slate-200">{entry.package}</td>
                  <td className="px-3 py-2 text-slate-400">{entry.version}</td>
                  <td className="px-3 py-2">
                    {entry.cve_matches.length > 0
                      ? entry.cve_matches.map((cve) => (
                          <span
                            key={cve}
                            className="inline-block mr-1 mb-0.5 px-1.5 py-0.5 rounded bg-threat/20 text-threat border border-threat/30 text-[10px]"
                          >
                            {cve}
                          </span>
                        ))
                      : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="px-3 py-2">
                    {entry.cve_matches.length > 0 ? (
                      <span className="text-threat font-semibold text-[10px]">⚠ Vulnerable</span>
                    ) : (
                      <span className="text-secure text-[10px]">✓ Safe</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}

function AddToMonitoringButton({ config }: { config?: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState("daily");
  const [submitting, setSubmitting] = useState(false);

  const handleAdd = useCallback(async () => {
    if (!config) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, config, frequency }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to create monitor");
        return;
      }

      toast.success("Monitor created! You'll receive alerts on future scans.");
      setOpen(false);
      setName("");
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  }, [config, name, frequency]);

  // Only show for authenticated users — the dialog will fail silently otherwise
  // We rely on the API to return 401 if not authenticated
  if (!config) return null;

  return (
    <>
      <Button variant="default" onClick={() => setOpen(true)}>
        <Eye className="size-4 mr-2" />
        Add to Monitoring
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Continuous Monitoring</DialogTitle>
            <DialogDescription>
              Monitor this configuration for daily security scans and instant alerts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="monitor-name">Monitor Name</Label>
              <Input
                id="monitor-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Production Config"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="monitor-frequency">Scan Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger id="monitor-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={!name.trim() || submitting}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Creating...
                </>
              ) : (
                "Start Monitoring"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Main Component ────────────────────────────────────────────────────

export const ScanResults = ({ result, config, onReset }: ScanResultsProps) => {
  const styles = GRADE_STYLES[result.grade] ?? GRADE_STYLES.F;

  // Count issues by severity
  const issues = result.servers.flatMap((s) => s.issues);
  const crossServerRisks = result.crossServerRisks ?? [];
  const allItems = [...issues, ...crossServerRisks];
  const critCount = allItems.filter((i) => i.severity === "CRITICAL").length;
  const highCount = allItems.filter((i) => i.severity === "HIGH").length;
  const medCount = allItems.filter((i) => i.severity === "MEDIUM").length;
  const lowCount = allItems.filter((i) => i.severity === "LOW").length;

  // Export handlers
  const copyJson = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    toast.success("Report copied as JSON");
  }, [result]);

  const copyMarkdown = useCallback(() => {
    const lines: string[] = [];
    lines.push("## MCPGuardian Security Report");
    lines.push(`**Score:** ${result.score}/100 (${result.grade})`);
    lines.push(`**Scanned:** ${new Date(result.scannedAt).toLocaleDateString()}`);
    lines.push("");
    lines.push("### Summary");
    lines.push(`- Servers scanned: ${result.serversScanned}`);
    lines.push(`- Critical: ${critCount} | High: ${highCount} | Medium: ${medCount} | Low: ${lowCount}`);
    lines.push("");
    if (result.complianceSummary?.owasp_mcp?.length) {
      lines.push("### OWASP MCP Coverage");
      for (const cat of result.complianceSummary.owasp_mcp) {
        lines.push(`- ⚠ ${cat}: ${OWASP_LABELS[cat] ?? cat}`);
      }
      lines.push("");
    }
    lines.push("### Issues");
    for (const server of result.servers) {
      lines.push(`#### ${server.name} (${server.grade}, ${server.score}/100)`);
      for (const issue of server.issues) {
        lines.push(`- [${issue.severity}] ${issue.title}`);
        lines.push(`  ${issue.description}`);
        if (issue.compliance?.owasp_mcp?.length) {
          lines.push(`  OWASP: ${issue.compliance.owasp_mcp.join(", ")}`);
        }
      }
      lines.push("");
    }
    if (result.sbom?.length) {
      lines.push("### SBOM");
      lines.push("| Package | Version | CVE Matches | Status |");
      lines.push("|---|---|---|---|");
      for (const entry of result.sbom) {
        const cves = entry.cve_matches.length > 0 ? entry.cve_matches.join(", ") : "—";
        const status = entry.cve_matches.length > 0 ? "⚠ Vulnerable" : "✓ Safe";
        lines.push(`| ${entry.package} | ${entry.version} | ${cves} | ${status} |`);
      }
    }

    navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Report copied as Markdown");
  }, [result, critCount, highCount, medCount, lowCount]);

  // Determine transport and auth info per server
  const serverMeta = (server: typeof result.servers[number]) => {
    const hasUrl = server.serverUrl && server.serverUrl.startsWith("http");
    const isHttp = server.serverUrl?.startsWith("https://");
    const isStdio = !server.serverUrl;
    const hasAuthIssue = server.issues.some(
      (i) => i.type === "MISSING_AUTHENTICATION" || i.type === "AUTH_WEAK_BASIC" || i.type === "AUTH_WEAK_DIGEST",
    );
    return { isHttp, isStdio, hasAuthIssue };
  };

  return (
    <div className="space-y-6">
      {/* ── SECTION 1: Score Header ────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {/* Left: Animated Score Ring */}
        <div className="flex justify-center md:justify-start">
          <AnimatedScoreRing grade={result.grade} score={result.score} />
        </div>

        {/* Center: Summary Stats */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: Shield, label: "Servers Scanned", value: result.serversScanned },
            { icon: FileText, label: "Tools Analyzed", value: result.servers.reduce((s, sv) => s + (sv.rawTools?.length ?? 0), 0) },
            { icon: FileText, label: "Prompts Scanned", value: result.totalPromptsScanned },
            { icon: FileText, label: "Resources Scanned", value: result.totalResourcesScanned },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2.5">
              <Icon className="size-4 text-monitor shrink-0" />
              <div>
                <p className="text-lg font-bold tabular-nums">{value}</p>
                <p className="text-[10px] text-slate-500 leading-tight">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Right: Severity Breakdown */}
        <div className="bg-white/[0.02] rounded-lg border border-white/10 p-3.5">
          <p className="text-[10px] font-mono font-bold tracking-wider text-slate-500 mb-2.5 uppercase">
            Issue Breakdown
          </p>
          <SeverityBars result={result} />
        </div>
      </div>

      {/* ── SECTION 2: OWASP MCP Compliance Grid ─────────────────────── */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2">
          <Shield className="size-4 text-monitor" />
          <h3 className="text-sm font-semibold text-slate-300">OWASP MCP Coverage</h3>
          {result.complianceSummary && (
            <span className="text-[10px] font-mono text-slate-500">
              {result.complianceSummary.owasp_mcp.length}/10 triggered
            </span>
          )}
        </div>
        <OwaspGrid result={result} />
      </div>

      {/* ── SECTION 3: Cross-Server Risks ─────────────────────────────── */}
      {crossServerRisks.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <GitBranch className="size-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-slate-300">Cross-Server Analysis</h3>
            {result.crossServerDeduction !== undefined && (
              <span className="text-[10px] font-mono text-slate-500">
                –{result.crossServerDeduction} pts
              </span>
            )}
          </div>
          <div className="space-y-3">
            {crossServerRisks.map((risk, idx) => (
              <div
                key={idx}
                className={cn(
                  "rounded-lg border p-3 space-y-2.5",
                  risk.type === "TOOL_SHADOWING_RISK" && "border-purple-500/30 bg-purple-500/5",
                  risk.type === "CROSS_SERVER_MANIPULATION" && "border-threat/30 bg-threat/5",
                  risk.type === "MULTI_SERVER_COMPOUND_RISK" && "border-caution/30 bg-caution/5",
                )}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  {risk.type === "TOOL_SHADOWING_RISK" && (
                    <div className="flex items-center gap-1.5 rounded-md bg-purple-500/10 px-2 py-1 text-[11px] font-semibold text-purple-400">
                      <AlertTriangle className="size-3.5" />
                      <span>Tool Shadowing</span>
                    </div>
                  )}
                  {risk.type === "CROSS_SERVER_MANIPULATION" && (
                    <div className="flex items-center gap-1.5 rounded-md bg-threat/10 px-2 py-1 text-[11px] font-semibold text-threat">
                      <AlertTriangle className="size-3.5" />
                      <span>Cross-Server Manipulation</span>
                    </div>
                  )}
                  {risk.type === "MULTI_SERVER_COMPOUND_RISK" && (
                    <div className="flex items-center gap-1.5 rounded-md bg-caution/10 px-2 py-1 text-[11px] font-semibold text-caution">
                      <Layers className="size-3.5" />
                      <span>Compound Risk</span>
                    </div>
                  )}
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border",
                      SEVERITY_COLORS[risk.severity as keyof typeof SEVERITY_COLORS]?.badge ?? "bg-slate-500/20 text-slate-400 border-slate-500/30",
                    )}
                  >
                    {risk.severity}
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-200">{risk.title}</p>
                <p className="text-xs text-slate-400 leading-relaxed">{risk.description}</p>

                {/* Tool shadowing collision diagram */}
                {risk.type === "TOOL_SHADOWING_RISK" && (
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mt-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10">
                      {risk.description.includes("multiple servers expose")
                        ? risk.description.match(/([""])([^""]+)\1/g)?.[0]?.replace(/[""]/g, "") ?? "tool"
                        : "tool"}
                    </span>
                    <span className="text-purple-400">⟷</span>
                    <span className="text-purple-400">COLLISION</span>
                  </div>
                )}

                <div className="flex items-start gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs">
                  <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-caution" />
                  <span className="text-slate-300">{risk.fix}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SECTION 4: Per-Server Breakdown ────────────────────────────── */}
      {result.servers.length > 0 && (
        <div className="space-y-2.5">
          <h3 className="text-sm font-semibold text-slate-300">Server Breakdown</h3>
          <Accordion type="single" collapsible className="w-full space-y-2">
            {result.servers.map((server) => {
              const { isHttp, isStdio, hasAuthIssue } = serverMeta(server);
              const serverCritCount = server.issues.filter((i) => i.severity === "CRITICAL").length;
              const serverHighCount = server.issues.filter((i) => i.severity === "HIGH").length;

              return (
                <AccordionItem
                  key={server.name}
                  value={server.name}
                  className="rounded-lg border border-white/10 bg-white/[0.02] px-0"
                >
                  <AccordionTrigger className="px-3 py-2.5 hover:no-underline hover:bg-white/[0.02] rounded-lg">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Transport badge */}
                      {isHttp ? (
                        <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-monitor/20 text-monitor border border-monitor/30">
                          HTTP
                        </span>
                      ) : (
                        <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                          STDIO
                        </span>
                      )}

                      {/* Server name */}
                      <span className="text-sm font-semibold text-slate-200 truncate">{server.name}</span>

                      {/* Mini grade ring */}
                      <MiniScoreRing grade={server.grade} score={server.score} />

                      {/* Issue count pills */}
                      <div className="flex items-center gap-1.5 ml-auto">
                        {serverCritCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-threat/20 text-threat border border-threat/30">
                            {serverCritCount} CRIT
                          </span>
                        )}
                        {serverHighCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-threat/20 text-threat border border-threat/30">
                            {serverHighCount} HIGH
                          </span>
                        )}
                      </div>

                      {/* Auth status icon */}
                      <div title={hasAuthIssue ? "Missing or weak authentication" : "Authentication OK"}>
                        {hasAuthIssue ? (
                          <LockOpen className="size-4 text-threat shrink-0" />
                        ) : (
                          <Lock className="size-4 text-secure shrink-0" />
                        )}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-3 pb-3">
                    {server.issues.length === 0 ? (
                      <div className="flex items-center gap-2 py-2 text-slate-400">
                        <CheckCircle2 className="size-4 text-secure" />
                        <span className="text-sm">No issues found</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {server.issues.map((issue, idx) => (
                          <IssueCard key={idx} issue={issue} />
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      )}

      {/* ── SECTION 5: SBOM Table ─────────────────────────────────────── */}
      <SbomTable result={result} />

      {/* ── SECTION 6: Action Bar ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-white/10">
        {/* Scan Again */}
        {onReset && (
          <Button variant="outline" onClick={onReset}>
            <RotateCcw className="size-4 mr-2" />
            Scan Again
          </Button>
        )}

        {/* Add to Monitoring */}
        <AddToMonitoringButton config={config} />

        {/* Export Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Download className="size-4 mr-2" />
              Export
              <ChevronDown className="size-3 ml-1" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={copyJson}>
              <Copy className="size-4 mr-2" />
              Copy as JSON
            </DropdownMenuItem>
            <DropdownMenuItem onClick={copyMarkdown}>
              <FileText className="size-4 mr-2" />
              Copy as Markdown
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
