import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getPlanGates, OVERAGE_RATES } from "@/lib/plan-limits";

// ─── Types ────────────────────────────────────────────────────────────

export interface AuthenticatedUser {
  userId: string;
  email: string;
}

export interface OrgContext {
  orgId: string;
  planId: string;
  subscriptionStatus: string;
  scansUsed: number;
  toolCallsUsed: number;
  seatsUsed: number;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  polarCustomerId: string | null;
  polarSubscriptionId: string | null;
  planGates: ReturnType<typeof getPlanGates>;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

// ─── JSON Envelope ────────────────────────────────────────────────────

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

export function err(code: string, message: string, status = 400): NextResponse {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status },
  );
}

// ─── Auth ─────────────────────────────────────────────────────────────

export async function requireUser(): Promise<
  { user: AuthenticatedUser } | NextResponse
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return err("UNAUTHORIZED", "Not authenticated", 401);
  }

  return { user: { userId: user.id, email: user.email } };
}

export function isError(
  result: unknown,
): result is NextResponse {
  return result instanceof NextResponse;
}

// ─── Org Context ──────────────────────────────────────────────────────

export async function requireOrg(
  userId: string,
  feature?: keyof ReturnType<typeof getPlanGates>,
): Promise<{ org: OrgContext; svc: ReturnType<typeof createServiceClient> } | NextResponse> {
  const svc = createServiceClient();

  // Get the user's active organization membership
  const { data: membership } = await svc
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .eq("invitation_status", "accepted")
    .single();

  if (!membership) {
    return err("NO_ORGANIZATION", "No organization found for this user", 404);
  }

  const { data: org } = await svc
    .from("organizations")
    .select("*")
    .eq("id", membership.organization_id)
    .single();

  if (!org) {
    return err("ORG_NOT_FOUND", "Organization not found", 404);
  }

  const planId = org.plan_id ?? "free";
  const planGates = getPlanGates(planId);

  // Check feature gate if specified
  if (feature) {
    const allowed = planGates[feature];
    const isAllowed =
      typeof allowed === "boolean"
        ? allowed
        : typeof allowed === "number"
          ? allowed === -1 || allowed > 0
          : false;

    if (!isAllowed) {
      return err(
        "FEATURE_NOT_ALLOWED",
        `Your ${planId} plan does not support this feature. Upgrade to enable.`,
        403,
      );
    }
  }

  return {
    org: {
      orgId: org.id,
      planId,
      subscriptionStatus: org.subscription_status ?? "active",
      scansUsed: org.scans_used_this_period ?? 0,
      toolCallsUsed: org.tool_calls_used_this_period ?? 0,
      seatsUsed: org.seats_used ?? 1,
      currentPeriodStart: org.current_period_start ?? null,
      currentPeriodEnd: org.current_period_end ?? null,
      polarCustomerId: org.polar_customer_id ?? null,
      polarSubscriptionId: org.polar_subscription_id ?? null,
      planGates,
    },
    svc,
  };
}

export async function requireOrgById(
  orgId: string,
): Promise<{ org: OrgContext; svc: ReturnType<typeof createServiceClient> } | NextResponse> {
  const svc = createServiceClient();

  const { data: org } = await svc
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .single();

  if (!org) {
    return err("ORG_NOT_FOUND", "Organization not found", 404);
  }

  const planId = org.plan_id ?? "free";
  const planGates = getPlanGates(planId);

  return {
    org: {
      orgId: org.id,
      planId,
      subscriptionStatus: org.subscription_status ?? "active",
      scansUsed: org.scans_used_this_period ?? 0,
      toolCallsUsed: org.tool_calls_used_this_period ?? 0,
      seatsUsed: org.seats_used ?? 1,
      currentPeriodStart: org.current_period_start ?? null,
      currentPeriodEnd: org.current_period_end ?? null,
      polarCustomerId: org.polar_customer_id ?? null,
      polarSubscriptionId: org.polar_subscription_id ?? null,
      planGates,
    },
    svc,
  };
}

// ─── Rate Limit Checks ───────────────────────────────────────────────

export function checkScanLimit(org: OrgContext): NextResponse | null {
  if (org.planId === "enterprise") return null;
  const limit = org.planGates.checksPerMonth;
  if (limit === -1) return null; // unlimited
  if (org.scansUsed >= limit) {
    return err(
      "SCAN_LIMIT_REACHED",
      `You've used ${org.scansUsed} of ${limit} monthly scans. Upgrade or purchase more.`,
      429,
    );
  }
  return null;
}

export function checkToolCallLimit(org: OrgContext): { allowed: boolean; overage: boolean } {
  const limit = org.planGates.checksPerMonth; // tool_calls tracked same bucket
  if (limit === -1) return { allowed: true, overage: false };
  if (org.toolCallsUsed >= limit && !org.planGates.overage) {
    return { allowed: false, overage: false };
  }
  return { allowed: true, overage: org.toolCallsUsed >= limit };
}

// ─── Increment Usage Counters ───────────────────────────────────────

export async function incrementScansUsed(
  orgId: string,
): Promise<void> {
  const svc = createServiceClient();
  await svc.rpc("increment_org_scans", { org_id: orgId });
}

export async function incrementToolCallsUsed(
  orgId: string,
): Promise<void> {
  const svc = createServiceClient();
  await svc.rpc("increment_org_tool_calls", { org_id: orgId });
}

export async function incrementProxySessionToolCalls(
  sessionId: string,
): Promise<void> {
  const svc = createServiceClient();
  await svc.rpc("increment_proxy_session_tool_calls", { session_id: sessionId });
}

// ─── Resolve Session Token ───────────────────────────────────────────

export async function resolveSessionToken(
  token: string,
): Promise<{ sessionId: string; orgId: string; mcpServerId: string } | null> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("proxy_sessions")
    .select("id, organization_id, mcp_server_id")
    .eq("session_token", token)
    .eq("status", "active")
    .single();

  if (!data) return null;
  return {
    sessionId: data.id,
    orgId: data.organization_id,
    mcpServerId: data.mcp_server_id,
  };
}

// ─── Check Allowlist Status ──────────────────────────────────────────

export async function checkServerAllowlist(
  orgId: string,
  serverId: string,
): Promise<{ allowed: boolean; status: string }> {
  const svc = createServiceClient();
  const { data } = await svc
    .from("mcp_servers")
    .select("allowlist_status")
    .eq("id", serverId)
    .eq("organization_id", orgId)
    .single();

  if (!data) return { allowed: false, status: "not_found" };
  if (data.allowlist_status === "blocked") return { allowed: false, status: "blocked" };
  if (data.allowlist_status === "approved") return { allowed: true, status: "approved" };
  return { allowed: true, status: data.allowlist_status }; // pending / monitoring = allowed in monitor mode
}
