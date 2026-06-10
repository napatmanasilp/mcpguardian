import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { scanMcpConfig } from "@/lib/scanner";
import { createClient } from "@/lib/supabase/server";

const CreateMonitorSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  config: z.string().min(2, "Config is required").max(102400, "Config too large"),
  frequency: z.enum(["daily", "weekly"]),
});

const PatchMonitorSchema = z.object({
  is_active: z.boolean(),
});

export const GET = async () => {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: monitors, error } = await supabase
      .from("monitored_configs")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch monitors" }, { status: 500 });
    }

    return NextResponse.json(monitors, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
};

export const POST = async (request: NextRequest) => {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();

    // Monitors available on Developer, Team, Startup, and Enterprise plans
    const blockedPlans = ["free", "payg"];
    if (profile && blockedPlans.includes(profile.plan)) {
      return NextResponse.json(
        { error: "Continuous monitoring requires a paid plan (Developer, Team, Startup, or Enterprise)." },
        { status: 403 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const parsed = CreateMonitorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid monitor configuration" },
        { status: 400 },
      );
    }

    const { name, config, frequency } = parsed.data;

    let configJson: Record<string, unknown>;
    try {
      configJson = JSON.parse(config);
      if (!configJson || typeof configJson !== "object" || !("mcpServers" in configJson)) {
        throw new Error();
      }
    } catch {
      return NextResponse.json(
        { error: "Invalid MCP configuration JSON" },
        { status: 400 },
      );
    }

    const { data: monitor, error: insertError } = await supabase
      .from("monitored_configs")
      .insert({
        user_id: user.id,
        name,
        config_json: configJson,
        scan_frequency: frequency,
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: "Failed to create monitor" }, { status: 500 });
    }

    let scanResult;
    try {
      scanResult = await scanMcpConfig(config);
    } catch {
      return NextResponse.json(
        { ...monitor, initialScan: null },
        { status: 201 },
      );
    }

    const { data: scan } = await supabase
      .from("scans")
      .insert({
        user_id: user.id,
        overall_grade: scanResult.grade,
        overall_score: scanResult.score,
        servers_scanned: scanResult.serversScanned,
        critical_issues: scanResult.criticalIssues,
        high_issues: scanResult.highIssues,
        results: JSON.parse(JSON.stringify(scanResult)),
      })
      .select()
      .single();

    if (scan) {
      await supabase
        .from("monitored_configs")
        .update({
          last_scan_id: scan.id,
          last_score: scanResult.score,
        })
        .eq("id", monitor.id);
    }

    return NextResponse.json(
      { ...monitor, last_scan_id: scan?.id || null, last_score: scanResult.score, initialScan: scanResult },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
};

export const DELETE = async (request: NextRequest) => {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const monitorId = searchParams.get("monitor_id");

    if (!monitorId) {
      return NextResponse.json({ error: "monitor_id is required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("monitored_configs")
      .delete()
      .eq("id", monitorId)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: "Failed to delete monitor" }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
};

export const PATCH = async (request: NextRequest) => {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const monitorId = searchParams.get("monitor_id");

    if (!monitorId) {
      return NextResponse.json({ error: "monitor_id is required" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const parsed = PatchMonitorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "is_active (boolean) is required" }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from("monitored_configs")
      .update({ is_active: parsed.data.is_active })
      .eq("id", monitorId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to update monitor" }, { status: 500 });
    }

    return NextResponse.json(updated, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
};
