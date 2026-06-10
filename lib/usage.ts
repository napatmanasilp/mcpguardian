"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

// ─── Types ─────────────────────────────────────────────────────────────

export interface UsageData {
  plan: string;
  checksIncluded: number;
  checksUsed: number;
  checksPurchased: number;
  topUpBalanceUsd: number;
  percentUsed: number;
  percentTotal: number; // including top-up credits
  resetDate: string;
  billingCycleStart: string;
  billingCycleEnd: string;
  overageEnabled: boolean;
  overageRate: number;
  overageChecks: number; // checks beyond included (paid plans only)
  overageCostUsd: number;
}

export interface UsageResponse {
  plan: string;
  checksUsed: number;
  checksLimit: number;
  checksPurchased: number;
  topUpBalanceUsd: number;
  percentUsed: number;
  resetDate: string;
  overageEnabled: boolean;
  overageRate: number;
  overageChecks: number;
  overageCostUsd: number;
  keys: Array<{ name: string; checksUsed: number; checksLimit: number }>;
}

// ─── Helpers ───────────────────────────────────────────────────────────

export function canScan(usage: UsageData | null): boolean {
  if (!usage) return true; // loading state — allow
  if (usage.plan === "enterprise") return true;
  if (usage.plan === "payg") return true;
  // Free: can scan if under included + purchased
  if (usage.plan === "free") {
    return usage.checksUsed < usage.checksIncluded + usage.checksPurchased;
  }
  // Paid plans: can always scan (overage kicks in)
  return true;
}

export function getUsageColor(percent: number): string {
  if (percent >= 100) return "bg-red-500";
  if (percent >= 80) return "bg-amber-500";
  return "bg-emerald-500";
}

export function getUsageTextColor(percent: number): string {
  if (percent >= 100) return "text-red-400";
  if (percent >= 80) return "text-amber-400";
  return "text-emerald-400";
}

// Re-exported from plan-limits.ts to avoid duplication
import { getPlanDisplayName, getOverageRateDisplay } from "@/lib/plan-limits";
export { getPlanDisplayName, getOverageRateDisplay };

// ─── Hook ──────────────────────────────────────────────────────────────

// ─── Hook ──────────────────────────────────────────────────────────────

export function useUsage() {
  return useContext(UsageContext);
}

// ─── Shared Usage Context ─────────────────────────────────────────────

export interface UsageContextValue {
  usage: UsageData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const UsageContext = createContext<UsageContextValue>({
  usage: null,
  loading: true,
  error: null,
  refetch: async () => {},
});

// ─── Top-Up Modal Context ──────────────────────────────────────────────

let _openTopUpModal: ((defaultBundle?: string) => void) | null = null;

export function registerTopUpModal(
  fn: (defaultBundle?: string) => void,
) {
  _openTopUpModal = fn;
}

export function unregisterTopUpModal() {
  _openTopUpModal = null;
}

export function openTopUpModal(defaultBundle?: string) {
  _openTopUpModal?.(defaultBundle);
}
