/**
 * Telemetry utility functions for server health calculations.
 */

export interface HealthMetric {
  recorded_at: string;
  is_reachable: boolean;
}

/**
 * Minimum number of health metric records required before computing
 * sparkline or uptime values. Below this threshold, display "Insufficient data".
 */
export const MINIMUM_METRICS_THRESHOLD = 5;

/**
 * Determines whether a server has insufficient data for telemetry display.
 * When true, both sparkline and uptime should show "Insufficient data".
 *
 * @param totalRecordCount - Total number of health metric records for the server
 * @returns true if the count is below the minimum threshold
 */
export function hasInsufficientData(totalRecordCount: number): boolean {
  return totalRecordCount < MINIMUM_METRICS_THRESHOLD;
}

/**
 * Computes the uptime percentage for a server based on its health metrics
 * over the last 30 days. Returns "—" when no data is available in the window.
 *
 * @param metrics - Array of health metric records with recorded_at and is_reachable fields
 * @returns A formatted string like "99.5%" or "—" when no data exists
 */
export function computeUptime(metrics: HealthMetric[]): string {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const last30 = metrics.filter(
    (m) => new Date(m.recorded_at) >= thirtyDaysAgo
  );

  if (last30.length === 0) return "—";

  const reachable = last30.filter((m) => m.is_reachable).length;
  return (Math.round((reachable / last30.length) * 1000) / 10).toFixed(1) + "%";
}
