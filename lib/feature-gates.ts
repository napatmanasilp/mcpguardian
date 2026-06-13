/**
 * @deprecated This module is deprecated in favor of `lib/tier-catalog.ts`.
 * Scan and tool-call limits should be sourced from the TIER_CATALOG constant.
 * Feature gating logic (hasFeature, FEATURE_MATRIX, etc.) is still valid here
 * but will be migrated in a future release.
 */

// ─── Feature Gates ──────────────────────────────────────────────────────
// Single source of truth for feature entitlement checks.
// Features map to plans table columns (via PLAN_GATES) for consistent
// enforcement across API routes, UI components, and background jobs.

import { type Plan, PLAN_PRICES } from "@/lib/plan-limits";
import { TIER_CATALOG, type TierId } from "@/lib/tier-catalog";

export type Feature =
  | "block_mode"
  | "rug_pull_detection"
  | "session_watchdog"
  | "cross_server_analysis"
  | "mitre_atlas"
  | "forensic_timeline"
  | "webhook_forwarding"
  | "policy_engine"
  | "sso_saml"
  | "otel_export"
  | "compliance_report_owasp"
  | "compliance_report_mitre"
  | "compliance_report_nsa"
  | "custom_scan_schedule"
  | "priority_support";

// ─── Feature → Plan Threshold ─────────────────────────────────────────
// The minimum plan that enables each feature. Used by upgrade-prompt to
// suggest which plan the user should upgrade to.

export const FEATURE_MIN_PLAN: Record<Feature, Plan> = {
  block_mode: "developer",
  rug_pull_detection: "developer",
  session_watchdog: "developer",
  cross_server_analysis: "team",
  mitre_atlas: "team",
  forensic_timeline: "team",
  webhook_forwarding: "team",
  policy_engine: "startup",
  sso_saml: "startup",
  otel_export: "enterprise",
  compliance_report_owasp: "developer",
  compliance_report_mitre: "team",
  compliance_report_nsa: "developer",
  custom_scan_schedule: "startup",
  priority_support: "startup",
};

// ─── Feature Gating Matrix ────────────────────────────────────────────
// Defines which features are available on each plan, matching the plans
// table columns (block_mode_enabled, rug_pull_detection_enabled, etc.).

const FEATURE_MATRIX: Record<string, Feature[]> = {
  free: [],
  developer: [
    "block_mode",
    "rug_pull_detection",
    "session_watchdog",
    "compliance_report_owasp",
    "compliance_report_nsa",
  ],
  team: [
    "block_mode",
    "rug_pull_detection",
    "session_watchdog",
    "cross_server_analysis",
    "mitre_atlas",
    "forensic_timeline",
    "webhook_forwarding",
    "compliance_report_owasp",
    "compliance_report_nsa",
  ],
  startup: [
    "block_mode",
    "rug_pull_detection",
    "session_watchdog",
    "cross_server_analysis",
    "mitre_atlas",
    "forensic_timeline",
    "webhook_forwarding",
    "policy_engine",
    "compliance_report_owasp",
    "compliance_report_mitre",
    "compliance_report_nsa",
    "custom_scan_schedule",
    "priority_support",
  ],
  enterprise: [
    "block_mode",
    "rug_pull_detection",
    "session_watchdog",
    "cross_server_analysis",
    "mitre_atlas",
    "forensic_timeline",
    "webhook_forwarding",
    "policy_engine",
    "sso_saml",
    "otel_export",
    "compliance_report_owasp",
    "compliance_report_mitre",
    "compliance_report_nsa",
    "custom_scan_schedule",
    "priority_support",
  ],
};

// ─── Feature Display Labels ───────────────────────────────────────────

export const FEATURE_LABELS: Record<Feature, string> = {
  block_mode: "Block Mode",
  rug_pull_detection: "Rug Pull Detection",
  session_watchdog: "Session Watchdog",
  cross_server_analysis: "Cross-Server Analysis",
  mitre_atlas: "MITRE ATLAS Mapping",
  forensic_timeline: "Forensic Timeline",
  webhook_forwarding: "Webhook Forwarding",
  policy_engine: "Policy Engine",
  sso_saml: "SAML / SSO",
  otel_export: "OpenTelemetry Export",
  compliance_report_owasp: "OWASP MCP Compliance Report",
  compliance_report_mitre: "MITRE ATLAS Compliance Report",
  compliance_report_nsa: "NSA CSI Compliance Report",
  custom_scan_schedule: "Custom Scan Schedule",
  priority_support: "Priority Support",
};

// ─── hasFeature ───────────────────────────────────────────────────────
// Check whether a plan has a specific feature enabled.
// Uses the FEATURE_MATRIX which mirrors the plans table columns.

export function hasFeature(plan: string, feature: Feature): boolean {
  return FEATURE_MATRIX[plan]?.includes(feature) ?? false;
}

// ─── PLAN_GATES Plan Type (re-export for convenience) ─────────────────

export type { Plan };

// ─── Feature Lock Description ─────────────────────────────────────────
// Returns a human-readable description of which plan unlocks the feature.

export function getFeatureUnlockInfo(
  feature: Feature,
): { requiredPlan: Plan; displayName: string; priceMonthly: number } {
  const requiredPlan = FEATURE_MIN_PLAN[feature];
  const displayName = requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1);
  return {
    requiredPlan,
    displayName,
    priceMonthly: PLAN_PRICES[requiredPlan]?.monthly ?? 0,
  };
}

// ─── Plan Limit Definitions ────────────────────────────────────────────
// Previously hardcoded here; now derived from TIER_CATALOG in lib/tier-catalog.ts.
// getScanLimit and getToolCallLimit below read directly from TIER_CATALOG.

// ─── getToolCallLimit ─────────────────────────────────────────────────
// Returns the tool call limit for an org, or null for unlimited.
// @deprecated Use TIER_CATALOG from lib/tier-catalog.ts directly.

export interface OrganizationLike {
  plan_id?: string;
}

export function getToolCallLimit(org: OrganizationLike): number | null {
  const plan = org.plan_id ?? "free";
  const tier = TIER_CATALOG[plan as TierId];
  if (!tier) return TIER_CATALOG.free.toolCallAllowance;
  return tier.toolCallAllowance;
}

// ─── getScanLimit ─────────────────────────────────────────────────────
// Returns the scan limit for an org, or null for unlimited.
// @deprecated Use TIER_CATALOG from lib/tier-catalog.ts directly.

export function getScanLimit(org: OrganizationLike): number | null {
  const plan = org.plan_id ?? "free";
  const tier = TIER_CATALOG[plan as TierId];
  if (!tier) return TIER_CATALOG.free.scanAllowance;
  return tier.scanAllowance;
}

// ─── isOverLimit ──────────────────────────────────────────────────────
// Returns true if usage >= limit AND plan has a limit (not null).

export interface UsageLike {
  plan_id?: string;
  scans_used_this_period?: number;
  tool_calls_used_this_period?: number;
  [key: string]: unknown;
}

export function isOverLimit(
  org: UsageLike,
  type: "scans" | "tool_calls",
): boolean {
  const limit = type === "scans" ? getScanLimit(org) : getToolCallLimit(org);
  if (limit === null) return false; // unlimited plan
  const used =
    type === "scans"
      ? (org.scans_used_this_period ?? 0)
      : (org.tool_calls_used_this_period ?? 0);
  return used >= limit;
}

// ─── Overage Rate (cents) ─────────────────────────────────────────────
// Returns the overage rate in cents per unit for the given plan and type.
// Mirrors the overage_rates DB table (values stored in cents).

const OVERAGE_RATES_CENTS: Record<string, { scans: number; toolCalls: number }> = {
  free: { scans: 0, toolCalls: 0 },           // blocked
  developer: { scans: 150, toolCalls: 1.2 },   // 150¢/scan, 1.2¢/tool call
  team: { scans: 100, toolCalls: 0.8 },         // 100¢/scan, 0.8¢/tool call
  startup: { scans: 80, toolCalls: 0.5 },       // 80¢/scan, 0.5¢/tool call
  enterprise: { scans: 0, toolCalls: 0 },       // negotiated
};

export function getOverageRate(
  plan: string,
  type: "scans" | "tool_calls",
): number {
  const rates = OVERAGE_RATES_CENTS[plan];
  if (!rates) return 0;
  return type === "scans" ? rates.scans : rates.toolCalls;
}

// ─── Feature Comparison Data (for pricing table) ──────────────────────
// Maps each feature to availability across all plans.

export interface FeatureRow {
  feature: string;
  featureKey: Feature;
  values: Record<string, boolean | string>;
}

export const FEATURE_COMPARISON_ROWS: FeatureRow[] = [
  {
    feature: "Static config analysis",
    featureKey: "block_mode",
    values: { free: true, developer: true, team: true, startup: true, enterprise: true },
  },
  {
    feature: "OWASP MCP Top 10 checks",
    featureKey: "compliance_report_owasp",
    values: { free: true, developer: true, team: true, startup: true, enterprise: true },
  },
  {
    feature: "CVE matching",
    featureKey: "compliance_report_owasp",
    values: { free: true, developer: true, team: true, startup: true, enterprise: true },
  },
  {
    feature: "Block Mode",
    featureKey: "block_mode",
    values: { free: false, developer: true, team: true, startup: true, enterprise: true },
  },
  {
    feature: "Rug Pull Detection",
    featureKey: "rug_pull_detection",
    values: { free: false, developer: true, team: true, startup: true, enterprise: true },
  },
  {
    feature: "Session Watchdog",
    featureKey: "session_watchdog",
    values: { free: false, developer: true, team: true, startup: true, enterprise: true },
  },
  {
    feature: "Cross-Server Analysis",
    featureKey: "cross_server_analysis",
    values: { free: false, developer: false, team: true, startup: true, enterprise: true },
  },
  {
    feature: "MITRE ATLAS Mapping",
    featureKey: "mitre_atlas",
    values: { free: false, developer: false, team: true, startup: true, enterprise: true },
  },
  {
    feature: "Forensic Timeline",
    featureKey: "forensic_timeline",
    values: { free: false, developer: false, team: true, startup: true, enterprise: true },
  },
  {
    feature: "Webhook Forwarding",
    featureKey: "webhook_forwarding",
    values: { free: false, developer: false, team: true, startup: true, enterprise: true },
  },
  {
    feature: "Policy Engine",
    featureKey: "policy_engine",
    values: { free: false, developer: false, team: false, startup: true, enterprise: true },
  },
  {
    feature: "SAML / SSO",
    featureKey: "sso_saml",
    values: { free: false, developer: false, team: false, startup: "Basic", enterprise: "Full (SAML/OIDC)" },
  },
  {
    feature: "OpenTelemetry Export",
    featureKey: "otel_export",
    values: { free: false, developer: false, team: false, startup: false, enterprise: true },
  },
  {
    feature: "NSA CSI Compliance Report",
    featureKey: "compliance_report_nsa",
    values: { free: false, developer: true, team: true, startup: true, enterprise: true },
  },
  {
    feature: "Custom Scan Schedule",
    featureKey: "custom_scan_schedule",
    values: { free: false, developer: false, team: false, startup: true, enterprise: true },
  },
  {
    feature: "Priority Support",
    featureKey: "priority_support",
    values: { free: false, developer: false, team: false, startup: true, enterprise: "✅ + SLA" },
  },
];
