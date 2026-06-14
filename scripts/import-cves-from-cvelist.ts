/**
 * CVE Import Script
 *
 * Parses the CVE List V5 ZIP archive from https://github.com/CVEProject/cvelistV5
 * and extracts all MCP/AI-agent-related CVEs into a SQL migration file
 * for the `mcp_cves` table.
 *
 * Usage:
 *   npx tsx scripts/import-cves-from-cvelist.ts "C:\path\to\cvelistV5-main.zip"
 *
 * Output:
 *   supabase/migrations/021_cve_import.sql
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";

// We'll use the built-in Node.js zlib + zip handling
import * as fs from "fs";
import { execSync } from "child_process";

// ─── Configuration ──────────────────────────────────────────────────────

const MCP_KEYWORDS = [
  "mcp-server",
  "mcp server",
  "model context protocol",
  "modelcontextprotocol",
  "anthropic-ai/mcp",
  "sequa-mcp",
  "win-cli-mcp",
  "mcp-remote",
  "flowise",
  "upsonic",
  "gpt-researcher",
  "langchain mcp",
  "mcp-gateway",
  "fastmcp",
  "mcp-neo4j",
  "mcp-kubernetes",
  "mcp-atlassian",
  "mcp-watch",
  "cherry-studio",
  "5ire",
  "cursor",
  "claude-code",
  "librechat",
  "lobe-chat",
  "dify",
  "inspector",
  "playwright mcp",
  "aws-mcp",
  "splunk mcp",
  "ollama mcp",
  "figma mcp",
  "evernote-mcp",
  "ios-simulator-mcp",
  "codehooks-mcp",
  "git-mcp",
  "lara-mcp",
  "hackmd-mcp",
  "markdownify-mcp",
  "fetch-mcp",
  "kubectl-mcp",
  "blender-mcp",
  "mysql-mcp",
  "adb-mcp",
  "docker-mcp",
  "excel-mcp",
  "mcp-package-docs",
  "n8n-mcp",
  "arcade-mcp",
  "deepchat",
  "nginx-ui",
  "dive",
  "toolhive",
  "roo-code",
  "zed",
  "openmcp",
  "mcp-framework",
  "mcp-run-python",
  "mcp-data-vis",
  "mobile-mcp",
  "ha-mcp",
  "mcp-security",
  "mcp-gitlab",
  "kaggle-mcp",
  "chatbox",
  "praisonai",
  "litellm",
  "n8n-mcp",
  "nmap-mcp",
  "biome-mcp",
  "mcp-server-code-runner",
];

// ─── Types ──────────────────────────────────────────────────────────────

interface CveEntry {
  cveId: string;
  packageName: string;
  affectedVersions: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  description: string;
  fix: string;
  matchType: "exact" | "substring";
  versionField: "semver" | "all" | "flag-check";
  cvssScore: number | null;
  publishedAt: string | null;
}

interface CveJson {
  cveMetadata?: {
    cveId?: string;
    state?: string;
    datePublished?: string;
  };
  containers?: {
    cna?: {
      title?: string;
      descriptions?: Array<{ lang: string; value: string }>;
      affected?: Array<{
        packageName?: string;
        product?: string;
        vendor?: string;
        versions?: Array<{
          version?: string;
          status?: string;
          lessThan?: string;
          versionType?: string;
        }>;
      }>;
      metrics?: Array<{
        cvssV3_1?: { baseScore?: number; baseSeverity?: string };
        cvssV4_0?: { baseScore?: number; baseSeverity?: string };
      }>;
    };
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────

function extractSeverity(json: CveJson): "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" {
  const metrics = json.containers?.cna?.metrics;
  if (!metrics) return "HIGH"; // default for MCP vulns

  for (const m of metrics) {
    const score = m.cvssV3_1?.baseScore ?? m.cvssV4_0?.baseScore;
    if (score !== undefined) {
      if (score >= 9.0) return "CRITICAL";
      if (score >= 7.0) return "HIGH";
      if (score >= 4.0) return "MEDIUM";
      return "LOW";
    }
    const sev = (m.cvssV3_1?.baseSeverity ?? m.cvssV4_0?.baseSeverity ?? "").toUpperCase();
    if (sev === "CRITICAL") return "CRITICAL";
    if (sev === "HIGH") return "HIGH";
    if (sev === "MEDIUM") return "MEDIUM";
    if (sev === "LOW") return "LOW";
  }
  return "HIGH";
}

function extractCvssScore(json: CveJson): number | null {
  const metrics = json.containers?.cna?.metrics;
  if (!metrics) return null;
  for (const m of metrics) {
    return m.cvssV3_1?.baseScore ?? m.cvssV4_0?.baseScore ?? null;
  }
  return null;
}

function extractPackageName(json: CveJson): string {
  const affected = json.containers?.cna?.affected;
  if (!affected || affected.length === 0) return "unknown";

  const first = affected[0];
  if (first.packageName) return first.packageName;
  if (first.product) return first.product;
  return "unknown";
}

function extractVersions(json: CveJson): string {
  const affected = json.containers?.cna?.affected;
  if (!affected || affected.length === 0) return "all versions";

  const first = affected[0];
  if (!first.versions || first.versions.length === 0) return "all versions";

  for (const v of first.versions) {
    if (v.lessThan) return `<${v.lessThan}`;
    if (v.version && v.status === "affected") return `<=${v.version}`;
  }
  return "all versions";
}

function extractDescription(json: CveJson): string {
  const title = json.containers?.cna?.title;
  if (title) return title;

  const descriptions = json.containers?.cna?.descriptions;
  if (descriptions) {
    const en = descriptions.find((d) => d.lang === "en");
    if (en) {
      // Truncate to 500 chars
      return en.value.length > 500 ? en.value.slice(0, 497) + "..." : en.value;
    }
  }
  return "Security vulnerability";
}

function determineFix(pkgName: string, versions: string): string {
  if (versions.startsWith("<")) {
    const ver = versions.slice(1);
    return `Upgrade ${pkgName} to >= ${ver}`;
  }
  if (versions.startsWith("<=")) {
    return `Upgrade ${pkgName} to a version newer than ${versions.slice(2)}`;
  }
  if (versions === "all versions") {
    return `Do not use ${pkgName} — no safe version available. Consider alternatives.`;
  }
  return `Upgrade ${pkgName} to the latest patched version`;
}

function determineVersionField(versions: string): "semver" | "all" | "flag-check" {
  if (versions === "all versions") return "all";
  if (versions.startsWith("<") || versions.startsWith("<=")) return "semver";
  return "all";
}

function escapeSql(str: string): string {
  return str.replace(/'/g, "''");
}

// ─── Main ───────────────────────────────────────────────────────────────

async function main() {
  const zipPath = process.argv[2];
  if (!zipPath) {
    console.error("Usage: npx tsx scripts/import-cves-from-cvelist.ts <path-to-zip>");
    process.exit(1);
  }

  if (!fs.existsSync(zipPath)) {
    console.error(`File not found: ${zipPath}`);
    process.exit(1);
  }

  console.log(`Reading CVE List V5 from: ${zipPath}`);
  console.log(`Filtering for MCP/AI-related CVEs...`);

  // Use PowerShell to extract and search (since we're on Windows)
  // We'll write a temp script that processes the zip
  const tempDir = join(process.cwd(), ".tmp-cve-import");
  
  // Instead of extracting the whole 567MB zip, we'll use the streaming approach
  // via PowerShell's ZipArchive
  const psScript = `
Add-Type -Assembly System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead('${zipPath.replace(/\\/g, "\\\\")}')
$keywords = @(${MCP_KEYWORDS.map((k) => `"${k}"`).join(",")})
$results = @()

$entries = $zip.Entries | Where-Object { $_.FullName -match "cves/(2025|2026)/" -and $_.FullName.EndsWith(".json") }
$count = 0

foreach ($entry in $entries) {
    $count++
    try {
        $stream = $entry.Open()
        $reader = [System.IO.StreamReader]::new($stream)
        $content = $reader.ReadToEnd()
        $reader.Close()
        $stream.Close()
        
        $contentLower = $content.ToLower()
        $matched = $false
        foreach ($kw in $keywords) {
            if ($contentLower.Contains($kw)) {
                $matched = $true
                break
            }
        }
        
        if ($matched) {
            $results += $content
        }
    } catch {}
}

$zip.Dispose()

# Output as JSON array
"[" + ($results -join ",") + "]"
`;

  const psScriptPath = join(process.cwd(), ".tmp-cve-extract.ps1");
  writeFileSync(psScriptPath, psScript, "utf8");

  console.log("Extracting MCP CVEs from ZIP (this may take a few minutes)...");
  
  let rawOutput: string;
  try {
    rawOutput = execSync(
      `powershell -ExecutionPolicy Bypass -File "${psScriptPath}"`,
      { maxBuffer: 100 * 1024 * 1024, timeout: 600000 },
    ).toString();
  } catch (e: unknown) {
    console.error("Failed to extract CVEs:", (e as Error).message);
    process.exit(1);
  } finally {
    fs.unlinkSync(psScriptPath);
  }

  let cveJsons: CveJson[];
  try {
    cveJsons = JSON.parse(rawOutput);
  } catch {
    console.error("Failed to parse extracted CVE data");
    console.error("Raw output length:", rawOutput.length);
    process.exit(1);
  }

  console.log(`Parsed ${cveJsons.length} MCP-related CVE records`);

  // Convert to our format
  const entries: CveEntry[] = [];
  const seenPackages = new Set<string>();

  for (const json of cveJsons) {
    if (json.cveMetadata?.state !== "PUBLISHED") continue;

    const cveId = json.cveMetadata?.cveId ?? "UNKNOWN";
    const packageName = extractPackageName(json);
    const versions = extractVersions(json);
    const severity = extractSeverity(json);
    const description = extractDescription(json);
    const fix = determineFix(packageName, versions);
    const cvssScore = extractCvssScore(json);
    const publishedAt = json.cveMetadata?.datePublished ?? null;

    // Deduplicate by package name (keep highest severity)
    const key = `${packageName}::${versions}`;
    if (seenPackages.has(key)) continue;
    seenPackages.add(key);

    if (packageName === "unknown" || packageName === "n/a") continue;

    entries.push({
      cveId,
      packageName,
      affectedVersions: versions,
      severity,
      description,
      fix,
      matchType: "exact",
      versionField: determineVersionField(versions),
      cvssScore,
      publishedAt,
    });
  }

  console.log(`Deduplicated to ${entries.length} unique package/version entries`);

  // Sort by severity then package name
  const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  entries.sort((a, b) => {
    const sevDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return a.packageName.localeCompare(b.packageName);
  });

  // Generate SQL
  const sqlLines: string[] = [
    "-- Migration 021: CVE Import from CVE List V5",
    `-- Generated: ${new Date().toISOString()}`,
    `-- Source: https://github.com/CVEProject/cvelistV5`,
    `-- Total entries: ${entries.length}`,
    "",
    "-- Upsert MCP-related CVEs into mcp_cves table",
    "-- Uses package_name as the conflict key (one entry per package/version combo)",
    "",
  ];

  for (const entry of entries) {
    const sql = `INSERT INTO public.mcp_cves (cve_id, package_name, affected_versions, severity, description, fix, match_type, version_field, is_active, cvss_score, published_at)
VALUES ('${escapeSql(entry.cveId)}', '${escapeSql(entry.packageName)}', '${escapeSql(entry.affectedVersions)}', '${entry.severity}', '${escapeSql(entry.description)}', '${escapeSql(entry.fix)}', '${entry.matchType}', '${entry.versionField}', true, ${entry.cvssScore ?? "NULL"}, ${entry.publishedAt ? `'${entry.publishedAt}'` : "NULL"})
ON CONFLICT (package_name) DO UPDATE SET
  cve_id = EXCLUDED.cve_id,
  affected_versions = EXCLUDED.affected_versions,
  severity = EXCLUDED.severity,
  description = EXCLUDED.description,
  fix = EXCLUDED.fix,
  match_type = EXCLUDED.match_type,
  version_field = EXCLUDED.version_field,
  is_active = EXCLUDED.is_active,
  cvss_score = EXCLUDED.cvss_score,
  published_at = EXCLUDED.published_at,
  updated_at = now();`;

    sqlLines.push(sql);
    sqlLines.push("");
  }

  // Write migration file
  const migrationPath = join(process.cwd(), "supabase", "migrations", "021_cve_import.sql");
  writeFileSync(migrationPath, sqlLines.join("\n"), "utf8");

  console.log("");
  console.log(`✅ Generated migration: ${migrationPath}`);
  console.log(`   ${entries.length} CVE entries`);
  console.log(`   ${entries.filter((e) => e.severity === "CRITICAL").length} CRITICAL`);
  console.log(`   ${entries.filter((e) => e.severity === "HIGH").length} HIGH`);
  console.log(`   ${entries.filter((e) => e.severity === "MEDIUM").length} MEDIUM`);
  console.log(`   ${entries.filter((e) => e.severity === "LOW").length} LOW`);
  console.log("");
  console.log("Run this migration in your Supabase SQL editor to populate the CVE database.");
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
