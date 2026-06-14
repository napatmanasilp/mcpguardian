import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

// Live stats for homepage social proof section
export async function GET() {
  const supabase = createServiceClient();

  const [scans, cves, rugPulls, servers] = await Promise.all([
    // scans is the canonical scan table (org-based)
    supabase.from("scans").select("*", { count: "exact", head: true }),
    supabase.from("mcp_cves").select("*", { count: "exact", head: true }),
    supabase
      .from("tool_definition_snapshots")
      .select("*", { count: "exact", head: true })
      .gt("change_count", 0),
    supabase
      .from("mcp_servers")
      .select("*", { count: "exact", head: true }),
  ]);

  // Floor CVEs at 26 (the seeded baseline) so it never reads 0
  const cveCount = Math.max(cves.count ?? 0, 26);

  return Response.json({
    scans: scans.count ?? 0,
    cves: cveCount,
    rugPulls: rugPulls.count ?? 0,
    monitors: servers.count ?? 0,
  });
}
