"use client";

import { useEffect, useState } from "react";

import {
  UsageContext,
  type UsageData,
  type UsageResponse,
} from "@/lib/usage";

export function UsageProvider({ children }: { children: React.ReactNode }) {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = async () => {
    try {
      const res = await fetch("/api/usage");
      if (!res.ok) {
        if (res.status === 401) {
          setUsage(null);
          setLoading(false);
          return;
        }
        throw new Error("Failed to fetch usage");
      }
      const data: UsageResponse = await res.json();

      const planLimits: Record<string, number> = {
        free: 100,
        developer: 2_000,
        team: 20_000,
        startup: 200_000,
        enterprise: -1,
      };
      const checksIncluded =
        data.plan in planLimits
          ? planLimits[data.plan]
          : data.checksLimit;

      const totalAvailable =
        checksIncluded === -1
          ? Infinity
          : checksIncluded + (data.checksPurchased ?? 0);

      setUsage({
        plan: data.plan,
        checksIncluded,
        checksUsed: data.checksUsed,
        checksPurchased: data.checksPurchased ?? 0,
        topUpBalanceUsd: data.topUpBalanceUsd ?? 0,
        percentUsed:
          checksIncluded === -1
            ? 0
            : Math.round(
                (data.checksUsed / Math.max(totalAvailable, 1)) * 100,
              ),
        percentTotal:
          totalAvailable === Infinity
            ? 0
            : Math.round(
                (data.checksUsed / Math.max(totalAvailable, 1)) * 100,
              ),
        resetDate: data.resetDate,
        billingCycleStart: data.resetDate,
        billingCycleEnd: new Date(
          new Date(data.resetDate).getTime() + 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        overageEnabled: data.overageEnabled ?? false,
        overageRate: data.overageRate ?? 0,
        overageChecks: data.overageChecks ?? 0,
        overageCostUsd: data.overageCostUsd ?? 0,
      });
    } catch (e) {
      if (
        e instanceof TypeError &&
        e.message === "Failed to fetch"
      ) {
        return; // Network error — keep last known value
      }
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsage();
    const interval = setInterval(fetchUsage, 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <UsageContext.Provider
      value={{ usage, loading, error, refetch: fetchUsage }}
    >
      {children}
    </UsageContext.Provider>
  );
}
