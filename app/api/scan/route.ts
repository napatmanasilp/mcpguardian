import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { scanMcpConfig } from "@/lib/scanner";
import { createClient } from "@/lib/supabase/server";

const requestTimestamps = new Map<string, number[]>();

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

const ConfigSchema = z.object({
  config: z.string().min(2, "Config must be at least 2 characters").max(102400, "Config too large"),
});

export const POST = async (request: NextRequest) => {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const now = Date.now();
    const timestamps = requestTimestamps.get(ip) || [];
    const recentTimestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

    if (recentTimestamps.length >= RATE_LIMIT_MAX) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please try again in a minute." },
        { status: 429 },
      );
    }

    requestTimestamps.set(ip, [...recentTimestamps, now]);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Please provide a valid MCP configuration JSON string." },
        { status: 400 },
      );
    }

    const parsed = ConfigSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Please provide a valid MCP configuration JSON string." },
        { status: 400 },
      );
    }

    const { config } = parsed.data;

    let scanResult;
    try {
      scanResult = scanMcpConfig(config);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Invalid configuration" },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan, scans_this_month, max_scans")
        .eq("id", user.id)
        .single();

      if (profile && profile.plan === "free" && profile.scans_this_month >= profile.max_scans) {
        return NextResponse.json(
          {
            error: "Free scan limit reached. Upgrade to Pro for unlimited scans.",
            upgrade: true,
          },
          { status: 403 },
        );
      }

      const { error: insertError } = await supabase.from("scans").insert({
        user_id: user.id,
        overall_grade: scanResult.grade,
        overall_score: scanResult.score,
        servers_scanned: scanResult.serversScanned,
        critical_issues: scanResult.criticalIssues,
        high_issues: scanResult.highIssues,
        results: JSON.parse(JSON.stringify(scanResult)),
      });

      if (!insertError) {
        await supabase
          .from("profiles")
          .update({ scans_this_month: (profile?.scans_this_month || 0) + 1 })
          .eq("id", user.id);
      }
    }

    return NextResponse.json(scanResult, { status: 200 });
  } catch (e) {
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 },
    );
  }
};