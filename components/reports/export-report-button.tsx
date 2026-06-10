"use client";

import { FileText } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { OWASP_LABELS } from "@/lib/design-tokens";
import type { ScanResult } from "@/lib/scanner/types";

interface ExportReportButtonProps {
  result: ScanResult;
  className?: string;
}

export function ExportReportButton({ result, className }: ExportReportButtonProps) {
  const issues = result.servers.flatMap((s) => s.issues);
  const critCount = issues.filter((i) => i.severity === "CRITICAL").length;
  const highCount = issues.filter((i) => i.severity === "HIGH").length;
  const medCount = issues.filter((i) => i.severity === "MEDIUM").length;
  const lowCount = issues.filter((i) => i.severity === "LOW").length;

  const copyMarkdown = () => {
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
  };

  return (
    <Button variant="outline" size="sm" className={cn("gap-2", className)} onClick={copyMarkdown}>
      <FileText className="size-4" />
      Export
    </Button>
  );
}
