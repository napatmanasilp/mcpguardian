import { err, ok, isError, requireUser, requireOrg } from "@/lib/api-helpers";
import { TIER_CATALOG, type TierId, isUnlimited } from "@/lib/tier-catalog";
import { OVERAGE_RATES } from "@/lib/plan-limits";

// GET /api/usage — Dashboard usage meter data (org-based)
export async function GET() {
  const auth = await requireUser();
  if (isError(auth)) return auth;

  const orgCtx = await requireOrg(auth.user.userId);
  if (isError(orgCtx)) return orgCtx;

  const { org, svc } = orgCtx;

  // Resolve tier limits
  const tier = TIER_CATALOG[org.planId as TierId] ?? TIER_CATALOG.free;
  const scanAllowance = tier.scanAllowance;
  const toolCallAllowance = tier.toolCallAllowance;

  // Fetch API keys for this org's members (for key-level breakdown)
  // API keys are linked to user_id, so get all users in this org
  const { data: members } = await svc
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", org.orgId)
    .eq("invitation_status", "accepted");

  const memberIds = (members ?? []).map((m) => m.user_id);

  let keys: Array<{ calls_this_month: number; calls_limit: number; plan: string; name: string }> | null = null;
  if (memberIds.length > 0) {
    const { data } = await svc
      .from("api_keys")
      .select("calls_this_month, calls_limit, plan, name")
      .in("user_id", memberIds)
      .eq("revoked", false);
    keys = data;
  }

  const scansUsed = org.scansUsed;
  const toolCallsUsed = org.toolCallsUsed;

  // Overage calculations
  const plan = org.planId;
  let overageEnabled = false;
  let overageRate = 0;
  let overageChecks = 0;
  let overageCostUsd = 0;

  if (plan === "developer" || plan === "team" || plan === "startup") {
    overageEnabled = true;
    overageRate = OVERAGE_RATES[plan] ?? 0;
    const scanLimit = scanAllowance ?? Infinity;
    overageChecks = Math.max(0, scansUsed - scanLimit);
    overageCostUsd = overageChecks * overageRate;
  }

  // checksLimit maps to scanAllowance for backward compatibility
  const checksLimit = isUnlimited(scanAllowance) ? -1 : (scanAllowance as number);
  const totalAvailable = checksLimit === -1 ? Infinity : checksLimit;
  const percentUsed =
    totalAvailable === Infinity
      ? 0
      : Math.round((scansUsed / Math.max(totalAvailable, 1)) * 100);

  // Reset date: end of current billing period or 1st of next month
  const resetDate = org.currentPeriodEnd ?? getDefaultResetDate();

  return ok({
    plan,
    checksUsed: scansUsed,
    checksLimit,
    checksPurchased: 0, // top-up credits managed at org level now
    topUpBalanceUsd: 0,
    percentUsed,
    resetDate,
    overageEnabled,
    overageRate,
    overageChecks,
    overageCostUsd,
    // Additional org-level usage data
    toolCallsUsed,
    toolCallsLimit: isUnlimited(toolCallAllowance) ? -1 : toolCallAllowance,
    keys: (keys ?? []).map((k) => ({
      name: k.name,
      checksUsed: k.calls_this_month,
      checksLimit: k.calls_limit,
    })),
  });
}

function getDefaultResetDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 1);
  d.setHours(0, 1, 0, 0);
  return d.toISOString();
}
