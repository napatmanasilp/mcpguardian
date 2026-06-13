// Feature: mcpguardian-ux-improvements, Property 6: Server detail shows at most 5 recent scans
// **Validates: Requirements 4.4**

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { getRecentScans } from "@/lib/utils/scans";

describe("Property 6: Server detail shows at most 5 recent scans", () => {
  it("for any array of ≥ 6 scans with distinct created_at values, returns exactly 5 items from the top-5 most recent", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            created_at: fc.date({
              min: new Date("2020-01-01T00:00:00Z"),
              max: new Date("2030-12-31T23:59:59Z"),
            }),
          }),
          { minLength: 6, maxLength: 50 }
        ),
        (scans) => {
          // Ensure distinct created_at values by deduplicating
          const uniqueScans = scans.filter(
            (scan, index, arr) =>
              arr.findIndex(
                (s) => new Date(s.created_at).getTime() === new Date(scan.created_at).getTime()
              ) === index
          );

          // Only test when we have at least 6 distinct timestamps
          if (uniqueScans.length < 6) return true;

          const result = getRecentScans(uniqueScans);

          // Must return exactly 5 items
          expect(result).toHaveLength(5);

          // Determine the expected top-5 most recent
          const sortedByDate = [...uniqueScans].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
          const top5Ids = new Set(sortedByDate.slice(0, 5).map((s) => s.id));

          // Every returned item must be from the top-5 most recent set
          for (const item of result) {
            expect(top5Ids.has(item.id)).toBe(true);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("returns items sorted by created_at descending (most recent first)", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            created_at: fc.date({
              min: new Date("2020-01-01T00:00:00Z"),
              max: new Date("2030-12-31T23:59:59Z"),
            }),
          }),
          { minLength: 6, maxLength: 50 }
        ),
        (scans) => {
          const result = getRecentScans(scans);

          // Verify descending order
          for (let i = 0; i < result.length - 1; i++) {
            const current = new Date(result[i].created_at).getTime();
            const next = new Date(result[i + 1].created_at).getTime();
            expect(current).toBeGreaterThanOrEqual(next);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("never returns more than 5 items regardless of input size", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            created_at: fc.date({
              min: new Date("2020-01-01T00:00:00Z"),
              max: new Date("2030-12-31T23:59:59Z"),
            }),
          }),
          { minLength: 1, maxLength: 100 }
        ),
        (scans) => {
          const result = getRecentScans(scans);
          expect(result.length).toBeLessThanOrEqual(5);
        }
      ),
      { numRuns: 200 }
    );
  });
});
