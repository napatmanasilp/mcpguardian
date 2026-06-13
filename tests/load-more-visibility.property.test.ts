// Feature: mcpguardian-ux-improvements, Property 12: Load more button visibility follows n>50 threshold
// **Validates: Requirements 11.3, 11.4**

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { shouldShowLoadMore } from "@/lib/utils/activity";

describe("Property 12: Load more button visibility follows n===50 threshold", () => {
  it("shouldShowLoadMore returns true if and only if lastBatchSize === 50", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 500 }), (n) => {
        const result = shouldShowLoadMore(n);
        if (n === 50) {
          expect(result).toBe(true);
        } else {
          expect(result).toBe(false);
        }
      }),
      { numRuns: 200 }
    );
  });

  it("returns true for exactly 50 (full page means more may exist)", () => {
    expect(shouldShowLoadMore(50)).toBe(true);
  });

  it("returns false for 0 (empty result)", () => {
    expect(shouldShowLoadMore(0)).toBe(false);
  });

  it("returns false for values less than 50 (partial page means end of data)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 49 }), (n) => {
        expect(shouldShowLoadMore(n)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it("returns false for values greater than 50", () => {
    fc.assert(
      fc.property(fc.integer({ min: 51, max: 500 }), (n) => {
        expect(shouldShowLoadMore(n)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});
