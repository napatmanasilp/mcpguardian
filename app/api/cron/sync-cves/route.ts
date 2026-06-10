import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { clearCveCache } from "@/lib/scanner/cve-loader";

interface NvdCveItem {
  id: string;
  descriptions?: { lang: string; value: string }[];
  metrics?: {
    cvssMetricV31?: { cvssData?: { baseSeverity?: string } }[];
    cvssMetricV30?: { cvssData?: { baseSeverity?: string } }[];
  };
}

interface NvdResponse {
  vulnerabilities?: { cve: NvdCveItem }[];
}

interface OsvVulnerability {
  id: string;
  summary?: string;
  severity?: { type: string; score: string }[];
  affected?: {
    package?: { name: string; ecosystem: string };
    ranges?: { type: string; events?: { introduced?: string; fixed?: string }[] }[];
  }[];
}

interface OsvResponse {
  results?: { vulns?: OsvVulnerability[] }[];
}

const NVD_API_BASE = "https://services.nvd.nist.gov/rest/json/cves/2.0";
const OSV_API = "https://api.osv.dev/v1/query";

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchFromNvd(): Promise<Array<{ id: string; severity: string; description: string }>> {
  const results: Array<{ id: string; severity: string; description: string }> = [];
  const apiKey = process.env.NVD_API_KEY || "";
  let startIndex = 0;
  const resultsPerPage = 50;

  for (let page = 0; page < 3; page++) {
    const url = `${NVD_API_BASE}?keywordSearch=MCP&cvssV3Severity=HIGH&startIndex=${startIndex}&resultsPerPage=${resultsPerPage}`;
    const headers: Record<string, string> = { "User-Agent": "MCPGuardian/1.0" };
    if (apiKey) headers["apiKey"] = apiKey;

    try {
      const res = await fetch(url, { headers });
      if (res.status === 429) {
        await sleep(6000);
        continue;
      }
      if (!res.ok) break;

      const data: NvdResponse = await res.json();
      const vulns = data.vulnerabilities ?? [];
      if (vulns.length === 0) break;

      for (const v of vulns) {
        const desc = v.cve.descriptions?.find(d => d.lang === "en")?.value ?? "";
        const sev =
          v.cve.metrics?.cvssMetricV31?.[0]?.cvssData?.baseSeverity ??
          v.cve.metrics?.cvssMetricV30?.[0]?.cvssData?.baseSeverity ??
          "HIGH";
        results.push({ id: v.cve.id, severity: sev.toUpperCase(), description: desc });
      }

      startIndex += vulns.length;
    } catch {
      break;
    }

    await sleep(700);
  }

  return results;
}

async function fetchFromOsv(): Promise<Array<{ id: string; severity: string; description: string }>> {
  const results: Array<{ id: string; severity: string; description: string }> = [];

  try {
    const res = await fetch(OSV_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ package: { ecosystem: "npm" }, keyword: "mcp" }),
    });

    if (!res.ok) return results;

    const data: OsvResponse = await res.json();
    const vulnLists = data.results ?? [];

    for (const entry of vulnLists) {
      const vulns = entry.vulns ?? [];
      for (const v of vulns) {
        let severity = "HIGH";
        if (v.severity && v.severity.length > 0) {
          const score = parseFloat(v.severity[0].score);
          if (score >= 9.0) severity = "CRITICAL";
          else if (score >= 7.0) severity = "HIGH";
          else if (score >= 4.0) severity = "MEDIUM";
        }
        results.push({
          id: v.id,
          severity,
          description: v.summary ?? v.id,
        });
      }
    }

    await sleep(700);
  } catch {
    // OSV fetch failed, continue with NVD results only
  }

  return results;
}

export const GET = async (request: NextRequest) => {
  const authHeader = request.headers.get("authorization");
  const cronHeader = request.headers.get("x-cron-secret");
  const expected = process.env.CRON_SECRET || "";
  if (authHeader !== `Bearer ${expected}` && cronHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  let added = 0;
  let updated = 0;
  let skipped = 0;

  const [nvdResults, osvResults] = await Promise.all([
    fetchFromNvd(),
    fetchFromOsv(),
  ]);

  const seen = new Set<string>();
  const allResults = [...nvdResults, ...osvResults].filter(r => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });

  for (const cve of allResults) {
    const { data: existing } = await supabase
      .from("mcp_cves")
      .select("id")
      .eq("cve_id", cve.id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("mcp_cves")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", existing.id);

      if (error) {
        skipped++;
      } else {
        updated++;
      }
    } else {
      const { error } = await supabase.from("mcp_cves").insert({
        cve_id: cve.id,
        package_name: `auto-sync:${cve.id}`,
        affected_versions: "unknown",
        severity: cve.severity,
        description: cve.description.slice(0, 500),
        fix: "Review NVD/OSV entry for patch details",
        match_type: "exact",
        version_field: "semver",
        is_active: true,
      });

      if (error) {
        skipped++;
      } else {
        added++;
      }
    }
  }

  clearCveCache();

  return NextResponse.json({ added, updated, skipped }, { status: 200 });
};
