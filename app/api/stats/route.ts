import { createServiceClient } from "@/lib/supabase/service";

// Live stats for homepage
export async function GET() {
  const supabase = createServiceClient();

  const [scans, cves, rugPulls, monitors] = await Promise.all([
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

  return Response.json({
    scans: scans.count ?? 0,
    cves: cves.count ?? 0,
    rugPulls: rugPulls.count ?? 0,
    monitors: monitors.count ?? 0,
  });
}
