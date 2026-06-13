import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

// Live stats for homepage social proof section
export async function GET() {
  const supabase = createServiceClient();

  const [scanResults, legacyScans, cves, rugPulls, monitors] = await Promise.all([
    // scan_results is the active table used by the app scanner
    supabase.from("scan_results").select("*", { count: "exact", head: true }),
    // scans is the legacy table — add both so count reflects all history
    supabase.from("scans").select("*", { count: "exact", head: true }),
    supabase.from("mcp_cves").select("*", { count: "exact", head: true }),
    supabase
      .from("tool_definition_snapshots")
      .select("*", { count: "exact", head: true })
      .gt("change_count", 0),
    supabase
      .from("monitored_configs")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true),
  ]);

  // Floor CVEs at 26 (the seeded baseline) so it never reads 0
  const cveCount = Math.max(cves.count ?? 0, 26);

  return Response.json({
    scans: (scanResults.count ?? 0) + (legacyScans.count ?? 0),
    cves: cveCount,
    rugPulls: rugPulls.count ?? 0,
    monitors: monitors.count ?? 0,
  });
}
