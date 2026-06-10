import { NextResponse } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";

export const revalidate = 30;

export const GET = async () => {
  const supabase = createServiceClient();

  try {
    // Fetch all active monitors
    const { data: monitors } = await supabase
      .from("monitored_configs")
      .select("id, name, config_json");

    if (!monitors || monitors.length === 0) {
      return NextResponse.json({});
    }

    // Fetch recent scans across this instance
    const { data: scans } = await supabase
      .from("scans")
      .select("id, overall_score, created_at, results")
      .order("created_at", { ascending: true })
      .limit(200);

    if (!scans || scans.length === 0) {
      return NextResponse.json({});
    }

    // Build a result map: assign scans to monitors by matching config
    // Try to match by checking result JSON for server URLs
    const result: Record<string, { id: string; overall_score: number; created_at: string }[]> = {};

    for (const monitor of monitors) {
      const configStr = JSON.stringify(monitor.config_json ?? {});
      const matchingScans = scans
        .filter((scan) => {
          // Match if scan results reference the same servers
          try {
            const results = scan.results as { servers?: Array<{ name: string }> } | null;
            if (!results?.servers) return false;
            const serverNames = results.servers.map((s) => s.name);
            // Check if any server name from the config appears in the scan results
            const mcpServersValue = (monitor.config_json as Record<string, unknown>)?.mcpServers;
            const configServerNames =
              mcpServersValue && typeof mcpServersValue === "object"
                ? Object.keys(mcpServersValue as Record<string, unknown>)
                : [];
            return configServerNames.some((name) => serverNames.includes(name));
          } catch {
            return false;
          }
        })
        .map((s) => ({
          id: s.id,
          overall_score: s.overall_score ?? 0,
          created_at: s.created_at ?? new Date().toISOString(),
        }))
        .slice(-30);

      if (matchingScans.length > 0) {
        result[monitor.id] = matchingScans;
      }
    }

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({}, { status: 500 });
  }
};
