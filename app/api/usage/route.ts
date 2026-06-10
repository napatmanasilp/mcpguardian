import { createClient } from "@/lib/supabase/server";
import { OVERAGE_RATES } from "@/lib/plan-limits";

// Dashboard usage meter data
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, scans_this_month, max_scans, top_up_balance_usd, checks_purchased, stripe_customer_id")
    .eq("id", user.id)
    .single();

  const { data: keys } = await supabase
    .from("api_keys")
    .select("calls_this_month, calls_limit, plan, name")
    .eq("user_id", user.id)
    .eq("revoked", false);

  if (!keys?.length) {
    return Response.json({
      plan: profile?.plan ?? "free",
      checksUsed: profile?.scans_this_month ?? 0,
      checksLimit: profile?.max_scans ?? 100,
      checksPurchased: profile?.checks_purchased ?? 0,
      topUpBalanceUsd: profile?.top_up_balance_usd ?? 0,
      percentUsed: 0,
      resetDate: getResetDate(),
      overageEnabled: false,
      overageRate: 0,
      overageChecks: 0,
      overageCostUsd: 0,
      keys: [],
    });
  }

  const totalUsed = keys.reduce((sum, k) => sum + k.calls_this_month, 0);
  const plan = keys[0].plan ?? profile?.plan ?? "free";

  // For paid plans, determine overage
  let overageEnabled = false;
  let overageRate = 0;
  let overageChecks = 0;
  let overageCostUsd = 0;

  if (plan === "developer" || plan === "team" || plan === "startup") {
    const gates: Record<string, number> = {
      developer: 2_000,
      team: 20_000,
      startup: 200_000,
    };
    const limit = gates[plan] ?? 2_000;
    overageEnabled = true;
    overageRate = OVERAGE_RATES[plan] ?? 0;
    overageChecks = Math.max(0, totalUsed - limit);
    overageCostUsd = overageChecks * overageRate;
  }

  // Determine total checks limit for the plan
  const planLimits: Record<string, number> = {
    free: 100,
    developer: 2_000,
    team: 20_000,
    startup: 200_000,
    enterprise: -1,
  };
  const checksLimit = planLimits[plan] ?? 100;
  const checksPurchased = profile?.checks_purchased ?? 0;
  const topUpBalanceUsd = profile?.top_up_balance_usd ?? 0;

  const totalAvailable =
    checksLimit === -1 ? Infinity : checksLimit + checksPurchased;
  const percentUsed =
    totalAvailable === Infinity
      ? 0
      : Math.round((totalUsed / Math.max(totalAvailable, 1)) * 100);

  return Response.json({
    plan,
    checksUsed: totalUsed,
    checksLimit,
    checksPurchased,
    topUpBalanceUsd,
    percentUsed,
    resetDate: getResetDate(),
    overageEnabled,
    overageRate,
    overageChecks,
    overageCostUsd,
    keys: keys.map((k) => ({
      name: k.name,
      checksUsed: k.calls_this_month,
      checksLimit: k.calls_limit,
    })),
  });
}

function getResetDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 1);
  d.setHours(0, 1, 0, 0);
  return d.toISOString();
}
