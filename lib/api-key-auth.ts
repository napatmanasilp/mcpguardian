import { createClient } from "@/lib/supabase/server";
import { hashApiKey } from "@/lib/api-keys";

export interface ApiKeyResult {
  apiKeyId: string;
  userId: string;
  plan: string;
  checksUsed: number;
  checksLimit: number;
  remaining: number;
}

// Extract API key from request (3 locations)
export function extractApiKey(request: Request): string | null {
  // 1. Authorization: Bearer mcpg_sk_...
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer mcpg_sk_")) return auth.slice(7);

  // 2. X-API-Key: mcpg_sk_...
  const xKey = request.headers.get("x-api-key");
  if (xKey?.startsWith("mcpg_sk_")) return xKey;

  // 3. ?api_key=mcpg_sk_... (query param for MCP tool compatibility)
  try {
    const url = new URL(request.url);
    const param = url.searchParams.get("api_key");
    if (param?.startsWith("mcpg_sk_")) return param;
  } catch {}

  return null;
}

// Validate key exists, not revoked, not over limit
// Does NOT count a check — that happens in check-counter.ts
export async function validateApiKey(
  request: Request,
): Promise<ApiKeyResult | null> {
  const key = extractApiKey(request);
  if (!key) return null;

  const supabase = await createClient();
  const { data: apiKey } = await supabase
    .from("api_keys")
    .select("id, user_id, plan, calls_this_month, calls_limit")
    .eq("key_hash", hashApiKey(key))
    .eq("revoked", false)
    .single();

  if (!apiKey) return null;

  return {
    apiKeyId: apiKey.id,
    userId: apiKey.user_id,
    plan: apiKey.plan,
    checksUsed: apiKey.calls_this_month,
    checksLimit: apiKey.calls_limit,
    remaining:
      apiKey.calls_limit === -1
        ? Infinity
        : apiKey.calls_limit - apiKey.calls_this_month,
  };
}

// Standard 429 rate limit response
export function rateLimitResponse(
  plan: string,
  used: number,
  limit: number,
  checksPurchased: number = 0,
  resetDateStr?: string,
) {
  const resetDate = resetDateStr
    ? new Date(resetDateStr)
    : new Date();
  if (!resetDateStr) {
    resetDate.setMonth(resetDate.getMonth() + 1, 1);
    resetDate.setHours(0, 1, 0, 0);
  }

  const totalAvailable = limit === -1 ? Infinity : limit + checksPurchased;
  const hasTopUpAvailable = plan === "free" && checksPurchased > 0;

  return Response.json(
    {
      error: "check_limit_reached",
      plan,
      checks_used: used,
      checks_limit: limit,
      checks_purchased: checksPurchased,
      reset_date: resetDate.toISOString(),
      upgrade_url: "https://mcpguardian.com/upgrade",
      top_up_url: hasTopUpAvailable ? "https://mcpguardian.com/billing/top-up" : undefined,
      message:
        `MCPGuardian ${plan} plan limit reached ` +
        `(${used}/${totalAvailable === Infinity ? "unlimited" : totalAvailable} checks used this month). ` +
        `Upgrade at mcpguardian.com/upgrade to continue.`,
      agent_message:
        `🛡️ MCPGuardian check limit reached (${used}/${totalAvailable === Infinity ? "unlimited" : totalAvailable} this month). ` +
        `MCP security verification is paused. ` +
        `The developer must upgrade at mcpguardian.com/upgrade ` +
        `to restore automatic MCP protection.`,
      agent_action_required: true,
    },
    {
      status: 429,
      headers: {
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": resetDate.toISOString(),
        "Retry-After": String(
          Math.floor((resetDate.getTime() - Date.now()) / 1000),
        ),
      },
    },
  );
}
