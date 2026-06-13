// Feature: mcpguardian-ux-improvements, Properties 17, 18
// **Validates: Requirements 13.2, 13.3**

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  computeUptime,
  hasInsufficientData,
  MINIMUM_METRICS_THRESHOLD,
  HealthMetric,
} from "@/lib/utils/telemetry";

/**
 * Generates a date within the last 30 days (guaranteed to be inside the window).
 */
function recentDateArb(): fc.Arbitrary<Date> {
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  // Generate timestamps between 1ms ago and 29 days ago (safely inside the 30-day window)
  return fc
    .integer({ min: 1, max: thirtyDaysMs - 60_000 })
    .map((offset) => new Date(now - offset));
}

/**
 * Generates a date older than 30 days (guaranteed to be outside the window).
 */
function oldDateArb(): fc.Arbitrary<Date> {
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  // Generate timestamps between 31 days and 365 days ago
  return fc
    .integer({ min: thirtyDaysMs + 60_000, max: 365 * 24 * 60 * 60 * 1000 })
    .map((offset) => new Date(now - offset));
}

/**
 * Generates a HealthMetric with a date within the last 30 days.
 */
function recentMetricArb(): fc.Arbitrary<HealthMetric> {
  return fc.record({
    recorded_at: recentDateArb().map((d) => d.toISOString()),
    is_reachable: fc.boolean(),
  });
}

/**
 * Generates a HealthMetric with a date older than 30 days.
 */
function oldMetricArb(): fc.Arbitrary<HealthMetric> {
  return fc.record({
    recorded_at: oldDateArb().map((d) => d.toISOString()),
    is_reachable: fc.boolean(),
  });
}

describe("Property 17: Uptime percentage equals ROUND((reachable/total)*100, 1)", () => {
  it("for any array of health metrics within the last 30 days, computeUptime returns the correctly formatted percentage", () => {
    fc.assert(
      fc.property(
        fc.array(recentMetricArb(), { minLength: 1, maxLength: 200 }),
        (metrics) => {
          const result = computeUptime(metrics);

          // All metrics are within 30 days, so total = metrics.length
          const total = metrics.length;
          const reachable = metrics.filter((m) => m.is_reachable).length;
          const expected =
            (Math.round((reachable / total) * 1000) / 10).toFixed(1) + "%";

          expect(result).toBe(expected);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("only counts metrics within the 30-day window (old metrics are excluded)", () => {
    fc.assert(
      fc.property(
        fc.array(recentMetricArb(), { minLength: 1, maxLength: 50 }),
        fc.array(oldMetricArb(), { minLength: 1, maxLength: 50 }),
        (recentMetrics, oldMetrics) => {
          const allMetrics = [...recentMetrics, ...oldMetrics];
          const result = computeUptime(allMetrics);

          // Only recent metrics should count
          const total = recentMetrics.length;
          const reachable = recentMetrics.filter((m) => m.is_reachable).length;
          const expected =
            (Math.round((reachable / total) * 1000) / 10).toFixed(1) + "%";

          expect(result).toBe(expected);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("returns a value between 0.0% and 100.0% for any non-empty recent metrics", () => {
    fc.assert(
      fc.property(
        fc.array(recentMetricArb(), { minLength: 1, maxLength: 100 }),
        (metrics) => {
          const result = computeUptime(metrics);
          // Extract numeric value
          expect(result).toMatch(/^\d+\.\d%$/);
          const numericValue = parseFloat(result.replace("%", ""));
          expect(numericValue).toBeGreaterThanOrEqual(0.0);
          expect(numericValue).toBeLessThanOrEqual(100.0);
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe("Property 18: Insufficient data guard returns '—' when total_count is 0", () => {
  it("returns '—' when no metrics exist (empty array)", () => {
    expect(computeUptime([])).toBe("—");
  });

  it("returns '—' when all metrics are outside the 30-day window", () => {
    fc.assert(
      fc.property(
        fc.array(oldMetricArb(), { minLength: 1, maxLength: 100 }),
        (oldMetrics) => {
          expect(computeUptime(oldMetrics)).toBe("—");
        }
      ),
      { numRuns: 200 }
    );
  });

  it("hasInsufficientData returns true for counts below the threshold", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: MINIMUM_METRICS_THRESHOLD - 1 }),
        (count) => {
          expect(hasInsufficientData(count)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("hasInsufficientData returns false for counts at or above the threshold", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MINIMUM_METRICS_THRESHOLD, max: 10000 }),
        (count) => {
          expect(hasInsufficientData(count)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("threshold is exactly 5 — boundary check", () => {
    expect(hasInsufficientData(4)).toBe(true);
    expect(hasInsufficientData(5)).toBe(false);
  });
});
