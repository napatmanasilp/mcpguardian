// This is the core logic that makes checks work correctly.
// 1 check = 1 unique (api_key, server) pair per 24 hours.
// If the same server is scanned twice in 24h, only 1 check is counted.
// Supports top-up credits for Free users and overage for paid plans.

import { createClient } from "@/lib/supabase/server";
import { createHash } from "crypto";
import { PLAN_GATES } from "@/lib/plan-limits";

// Generate a stable server key from config
export function serverKey(server: {
  url?: string;
  command?: string;
  args?: string[];
}): string {
  if (server.url) {
    // Normalize URL: lowercase, remove trailing slash
    return server.url.toLowerCase().replace(/\/$/, "");
  }
  // STDIO: hash the command + args
  const raw = [server.command, ...(server.args ?? [])].join(" ");
  return "stdio:" + createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

export interface CheckResult {
  isNew: boolean; // true = first time in 24h = counts as a check
  cachedAt?: string; // if isNew=false, when it was last scanned
  checksUsed: number; // total checks used this month after this call
  checksLimit: number; // plan limit (included checks)
  checksPurchased: number; // top-up credits (Free users)
  remaining: number; // checks left this month
  blocked: boolean; // true = free tier hit limit with no credits
  overageActive: boolean; // true = paid plan is using overage
  overageRate: number; // $/check for overage
  resetDate?: string; // next billing cycle reset date
}

// Main function: should we count a check for this server?
export async function recordCheck(
  apiKeyId: string,
  userId: string,
  server: { url?: string; command?: string; args?: string[] },
  checkType: "first_discovery" | "daily_rescan" | "manual" = "daily_rescan",
): Promise<CheckResult> {
  const supabase = await createClient();
  const key = serverKey(server);
  const twentyFourHoursAgo = new Date(
    Date.now() - 24 * 60 * 60 * 1000,
  ).toISOString();

  // Calculate reset date (1st of next month)
  const resetDate = new Date();
  resetDate.setMonth(resetDate.getMonth() + 1, 1);
  resetDate.setHours(0, 1, 0, 0);

  // 1. Get the current API key record + profile for top-up data
  const [apiKeyResult, profileResult] = await Promise.all([
    supabase
      .from("api_keys")
      .select("calls_this_month, calls_limit, plan, user_id")
      .eq("id", apiKeyId)
      .single(),
    supabase
      .from("profiles")
      .select("plan, checks_purchased, scans_this_month")
      .eq("id", userId)
      .single(),
  ]);

  const apiKey = apiKeyResult.data;
  const profile = profileResult.data;

  if (!apiKey) throw new Error("API key not found");

  const plan = apiKey.plan ?? "free";
  const gates = PLAN_GATES[plan as keyof typeof PLAN_GATES];
  const checksPurchased = profile?.checks_purchased ?? 0;
  const includedChecks = apiKey.calls_limit === -1 ? Infinity : apiKey.calls_limit;
  const totalAvailable = includedChecks === Infinity
    ? Infinity
    : includedChecks + checksPurchased;

  const overageRates: Record<string, number> = {
    free: 0,
    developer: 0.015,
    team: 0.010,
    startup: 0.005,
    enterprise: 0,
  };
  const overageRate = overageRates[plan] ?? 0;

  const overageEnabled = plan === "developer" || plan === "team" || plan === "startup";

  // 2. Check if this server was already scanned in the last 24h
  const { data: cached } = await supabase
    .from("check_cache")
    .select("checked_at")
    .eq("api_key_id", apiKeyId)
    .eq("server_key", key)
    .gte("checked_at", twentyFourHoursAgo)
    .single();

  // If cached within 24h: return without counting
  if (cached) {
    return {
      isNew: false,
      cachedAt: cached.checked_at,
      checksUsed: apiKey.calls_this_month,
      checksLimit: apiKey.calls_limit,
      checksPurchased,
      remaining:
        totalAvailable === Infinity
          ? Infinity
          : totalAvailable - apiKey.calls_this_month,
      blocked: false,
      overageActive: overageEnabled && apiKey.calls_this_month >= includedChecks,
      overageRate,
      resetDate: resetDate.toISOString(),
    };
  }

  // 3. It's a new check — check if plan limit reached
  const isOverTotal = totalAvailable !== Infinity && apiKey.calls_this_month >= totalAvailable;

  if (isOverTotal && plan === "free") {
    // Free tier: blocked, no overage — even with top-up credits exhausted
    return {
      isNew: true,
      checksUsed: apiKey.calls_this_month,
      checksLimit: apiKey.calls_limit,
      checksPurchased,
      remaining: 0,
      blocked: true,
      overageActive: false,
      overageRate: 0,
      resetDate: resetDate.toISOString(),
    };
  }

  // 4. Count the check — increment counter + upsert cache
  await Promise.all([
    // Increment monthly counter
    supabase
      .from("api_keys")
      .update({
        calls_this_month: apiKey.calls_this_month + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", apiKeyId),

    // Upsert cache entry
    supabase
      .from("check_cache")
      .upsert(
        {
          api_key_id: apiKeyId,
          user_id: userId,
          server_key: key,
          checked_at: new Date().toISOString(),
          check_type: checkType,
        },
        { onConflict: "api_key_id,server_key" },
      ),
  ]);

  // If this is a Free user with top-up credits, decrement purchased checks
  // when they go over the included limit
  const newCount = apiKey.calls_this_month + 1;
  if (plan === "free" && newCount > includedChecks && checksPurchased > 0) {
    // Decrement one from purchased credits
    await supabase
      .from("profiles")
      .update({ checks_purchased: checksPurchased - 1 })
      .eq("id", userId);
  }

  return {
    isNew: true,
    checksUsed: newCount,
    checksLimit: apiKey.calls_limit,
    checksPurchased: plan === "free" && newCount > includedChecks
      ? Math.max(0, checksPurchased - 1)
      : checksPurchased,
    remaining:
      totalAvailable === Infinity
        ? Infinity
        : totalAvailable - newCount,
    blocked: false,
    overageActive: overageEnabled && newCount > includedChecks,
    overageRate,
    resetDate: resetDate.toISOString(),
  };
}
