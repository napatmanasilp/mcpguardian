import { createHash, randomBytes } from "crypto";

export const KEY_PREFIX = "mcpg_sk_";

export function generateApiKey(): {
  key: string;
  keyHash: string;
  keyPrefix: string;
} {
  const random = randomBytes(24).toString("hex"); // 48 hex chars
  const key = `${KEY_PREFIX}${random}`;
  const keyHash = createHash("sha256").update(key).digest("hex");
  const keyPrefix = key.slice(0, 16); // "mcpg_sk_a8f2k9x1"
  return { key, keyHash, keyPrefix };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

// Plan limits: checks per month (-1 = unlimited)
export const PLAN_LIMITS: Record<string, number> = {
  free: 100,
  developer: 2_000,
  team: 20_000,
  startup: 200_000,
  enterprise: -1,
};

// Overage rate per check in USD cents
export const OVERAGE_RATES: Record<string, number> = {
  free: 0, // blocked, no overage
  developer: 1.5, // $0.015/check
  team: 1.0, // $0.010/check
  startup: 0.5, // $0.005/check
  enterprise: 0, // negotiated
};

export const PLAN_DISPLAY_NAMES: Record<string, string> = {
  free: "Free",
  developer: "Developer",
  team: "Team",
  startup: "Startup",
  enterprise: "Enterprise",
};

export const PLAN_PRICES: Record<
  string,
  { monthly: number; yearly: number }
> = {
  free: { monthly: 0, yearly: 0 },
  developer: { monthly: 19, yearly: 15 },
  team: { monthly: 99, yearly: 79 },
  startup: { monthly: 399, yearly: 299 },
  enterprise: { monthly: -1, yearly: -1 }, // custom
};
