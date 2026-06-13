// Feature: mcpguardian-ux-improvements, Property 23: Delete confirmation requires exact org name match
// **Validates: Requirements 15.9**

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { isDeleteConfirmEnabled } from "@/lib/utils/settings";

describe("Property 23: Delete confirmation requires exact org name match", () => {
  it("returns true if and only if typed === orgName (exact case-sensitive match)", () => {
    fc.assert(
      fc.property(fc.string(), fc.string({ minLength: 1 }), (typed, orgName) => {
        const enabled = isDeleteConfirmEnabled(typed, orgName);
        return (typed === orgName) === enabled;
      }),
      { numRuns: 200 }
    );
  });

  it("always returns true when typed exactly equals orgName", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (orgName) => {
        expect(isDeleteConfirmEnabled(orgName, orgName)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it("returns false when typed differs from orgName by case", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s.toLowerCase() !== s.toUpperCase()),
        (orgName) => {
          // Flip case of the first character that has distinct upper/lower
          const flipped = orgName.split("").map((ch) => {
            if (ch.toLowerCase() !== ch.toUpperCase()) {
              return ch === ch.toLowerCase() ? ch.toUpperCase() : ch.toLowerCase();
            }
            return ch;
          }).join("");

          // Only test when case flip actually produces a different string
          if (flipped !== orgName) {
            expect(isDeleteConfirmEnabled(flipped, orgName)).toBe(false);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("returns false for any pair of distinct strings", () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string({ minLength: 1 }),
        (typed, orgName) => {
          fc.pre(typed !== orgName);
          expect(isDeleteConfirmEnabled(typed, orgName)).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("returns false when typed is empty and orgName is non-empty", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (orgName) => {
        expect(isDeleteConfirmEnabled("", orgName)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});
