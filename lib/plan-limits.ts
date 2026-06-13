/**
 * @deprecated This module is deprecated in favor of `lib/tier-catalog.ts`.
 * All tier definitions, pricing, and allowances should be sourced from the
 * TIER_CATALOG constant in `lib/tier-catalog.ts`. This module is retained
 * for backward compatibility only.
 */

// Legacy plan feature gates — retained for backward compatibility.
// Used by API routes, UI components, and settings page.

import { TIER_CATALOG, type TierId } from "./tier-catalog";

export const PLAN_GATES = {
  free: {
    checksPerMonth: 100,
    monitors: 0,
    apiKeys: 1,
    seats: 1,
    savedReports: 3,
    historyDays: 7,
    apiAccess: true, // rate-limited
    slackAlerts: false,
    proxyGateway: false,
    sso: false,
    sbomExport: false,
    complianceExport: false,
    mcpGuardianTool: false,
    emailAlerts: false,
    overage: false,
    topUp: true,
    prioritySupport: false,
  },
  developer: {
    checksPerMonth: 2_000,
    monitors: 5,
    apiKeys: 3,
    seats: 1,
    savedReports: -1,
    historyDays: 30,
    apiAccess: true,
    slackAlerts: false,
    proxyGateway: false,
    sso: false,
    sbomExport: true,
    complianceExport: true,
    mcpGuardianTool: true,
    emailAlerts: true,
    overage: true, // $0.015/check
    topUp: false,
    prioritySupport: false,
  },
  team: {
    checksPerMonth: 20_000,
    monitors: 25,
    apiKeys: 10,
    seats: 5,
    savedReports: -1,
    historyDays: 365,
    apiAccess: true,
    slackAlerts: true,
    proxyGateway: true,
    sso: false,
    sbomExport: true,
    complianceExport: true,
    mcpGuardianTool: true,
    emailAlerts: true,
    overage: true, // $0.010/check
    topUp: false,
    prioritySupport: false,
  },
  startup: {
    checksPerMonth: 200_000,
    monitors: -1,
    apiKeys: -1,
    seats: 20,
    savedReports: -1,
    historyDays: 730,
    apiAccess: true,
    slackAlerts: true,
    proxyGateway: true,
    sso: true, // Basic SSO (Google/GitHub)
    sbomExport: true,
    complianceExport: true,
    mcpGuardianTool: true,
    emailAlerts: true,
    overage: true, // $0.005/check
    topUp: false,
    prioritySupport: true,
  },
  enterprise: {
    checksPerMonth: -1,
    monitors: -1,
    apiKeys: -1,
    seats: -1,
    savedReports: -1,
    historyDays: -1,
    apiAccess: true,
    slackAlerts: true,
    proxyGateway: true,
    sso: true, // Full SSO (SAML/OIDC)
    sbomExport: true,
    complianceExport: true,
    mcpGuardianTool: true,
    emailAlerts: true,
    overage: false, // negotiated
    topUp: false,
    prioritySupport: true,
  },
  payg: {
    checksPerMonth: -1,
    monitors: 0,
    apiKeys: 1,
    seats: 1,
    savedReports: 3,
    historyDays: 7,
    apiAccess: true,
    slackAlerts: false,
    proxyGateway: false,
    sso: false,
    sbomExport: false,
    complianceExport: false,
    mcpGuardianTool: false,
    emailAlerts: false,
    overage: false, // PAYG uses top-up instead
    topUp: true,
    prioritySupport: false,
  },
} as const;

export type Plan = keyof typeof PLAN_GATES;

export function getPlanGates(plan: string) {
  return PLAN_GATES[plan as Plan] ?? PLAN_GATES.free;
}

export function isFeatureAllowed(
  plan: string,
  feature: keyof (typeof PLAN_GATES)["free"],
): boolean {
  const gates = getPlanGates(plan);
  const value = gates[feature];
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === -1 || value > 0;
  return false;
}

// ─── Overage Rates ─────────────────────────────────────────────────────

export const OVERAGE_RATES: Record<string, number> = {
  free: 0, // blocked
  developer: 0.015, // $0.015/check
  team: 0.010, // $0.010/check
  startup: 0.005, // $0.005/check
  enterprise: 0, // negotiated
};

export function getOverageRate(plan: string): number {
  return OVERAGE_RATES[plan] ?? 0;
}

export function formatOverageRate(plan: string): string {
  const rate = getOverageRate(plan);
  if (plan === "free") return "Blocked";
  if (plan === "enterprise") return "Negotiated";
  return `$${rate.toFixed(3)}/check`;
}

// ─── PAYG / Top-Up Bundle Pricing ──────────────────────────────────────

export const TOP_UP_BUNDLES = [
  { id: "bundle-a", label: "Bundle A", price: 5, checks: 400, badge: null },
  { id: "bundle-b", label: "Bundle B", price: 10, checks: 900, badge: null },
  {
    id: "bundle-c",
    label: "Bundle C",
    price: 25,
    checks: 2_500,
    badge: null,
  },
  {
    id: "bundle-d",
    label: "Bundle D",
    price: 50,
    checks: 5_500,
    badge: "Best Value",
  },
] as const;

export interface TopUpBundle {
  id: string;
  label: string;
  price: number;
  checks: number;
  badge: string | null;
}

// PAYG rates (usage-based, no subscription)
export const PAYG_TIERS = [
  { min: 0, max: 100, rate: 0 }, // first 100 free
  { min: 101, max: 1_000, rate: 0.015 },
  { min: 1_001, max: 10_000, rate: 0.012 },
  { min: 10_001, max: 100_000, rate: 0.008 },
  { min: 100_001, max: Infinity, rate: 0.005 },
] as const;

// ─── Plan Display Names ────────────────────────────────────────────────

export const PLAN_DISPLAY_NAMES: Record<string, string> = {
  free: "Free",
  developer: "Developer",
  team: "Team",
  startup: "Startup",
  enterprise: "Enterprise",
  payg: "Pay-as-You-Go",
};

export const PLAN_CTA_BUTTONS: Record<string, string> = {
  free: "Get Started Free",
  developer: "Start Developer Plan",
  team: "Start Team Plan",
  startup: "Start Startup Plan",
  enterprise: "Contact Sales",
};

export const PLAN_SIGNUP_URLS: Record<string, string> = {
  free: "/signup",
  developer: "/signup",
  team: "/signup",
  startup: "/signup",
  enterprise: "#contact-sales",
};

/**
 * @deprecated Use `TIER_CATALOG` from `lib/tier-catalog.ts` instead.
 * Prices are derived from TIER_CATALOG for backward compatibility.
 */
export const PLAN_PRICES: Record<string, { monthly: number; yearly: number }> = {
  free: {
    monthly: TIER_CATALOG.free.monthlyPriceCents / 100,
    yearly: TIER_CATALOG.free.annualPricePerMonthCents / 100,
  },
  developer: {
    monthly: TIER_CATALOG.developer.monthlyPriceCents / 100,
    yearly: TIER_CATALOG.developer.annualPricePerMonthCents / 100,
  },
  team: {
    monthly: TIER_CATALOG.team.monthlyPriceCents / 100,
    yearly: TIER_CATALOG.team.annualPricePerMonthCents / 100,
  },
  startup: {
    monthly: TIER_CATALOG.startup.monthlyPriceCents / 100,
    yearly: TIER_CATALOG.startup.annualPricePerMonthCents / 100,
  },
  enterprise: { monthly: -1, yearly: -1 },
};

export const PLAN_SAVINGS_BADGES: Record<string, string> = {
  developer: "Save 21%",
  team: "Save 20%",
  startup: "Save 25%",
};

// ─── Feature Gate Map (for comparison table) ──────────────────────────

export function getPlanDisplayName(plan: string): string {
  return PLAN_DISPLAY_NAMES[plan] ?? plan.charAt(0).toUpperCase() + plan.slice(1);
}

export function getOverageRateDisplay(plan: string, _rate: number): string {
  if (plan === "free") return "Blocked";
  if (plan === "enterprise") return "Negotiated";
  const rate = OVERAGE_RATES[plan] ?? 0;
  return `$${rate.toFixed(3)}/check`;
}

export const FEATURE_GATES_LIST: Array<{
  feature: string;
  values: Record<string, string | boolean>;
}> = [
  {
    feature: "Full scan report",
    values: { free: true, developer: true, team: true, startup: true, enterprise: true },
  },
  {
    feature: "OWASP MCP Top 10",
    values: { free: true, developer: true, team: true, startup: true, enterprise: true },
  },
  {
    feature: "CVE matching",
    values: { free: true, developer: true, team: true, startup: true, enterprise: true },
  },
  {
    feature: "SBOM + compliance",
    values: { free: false, developer: true, team: true, startup: true, enterprise: true },
  },
  {
    feature: "MCPGuardian tool",
    values: { free: false, developer: true, team: true, startup: true, enterprise: true },
  },
  {
    feature: "Email alerts",
    values: { free: false, developer: true, team: true, startup: true, enterprise: true },
  },
  {
    feature: "Slack/webhooks",
    values: { free: false, developer: false, team: true, startup: true, enterprise: true },
  },
  {
    feature: "Proxy gateway",
    values: { free: false, developer: false, team: true, startup: true, enterprise: true },
  },
  {
    feature: "API access",
    values: { free: "Rate limited", developer: true, team: true, startup: true, enterprise: true },
  },
  {
    feature: "SSO",
    values: { free: false, developer: false, team: false, startup: true, enterprise: "Full (SAML/OIDC)" },
  },
  {
    feature: "Priority support",
    values: { free: false, developer: false, team: false, startup: true, enterprise: "✅ + SLA" },
  },
  {
    feature: "Top-up credits",
    values: { free: true, developer: false, team: false, startup: false, enterprise: false },
  },
  {
    feature: "Overage",
    values: { free: "Blocked", developer: "$0.015/check", team: "$0.010/check", startup: "$0.005/check", enterprise: "Negotiated" },
  },
];
