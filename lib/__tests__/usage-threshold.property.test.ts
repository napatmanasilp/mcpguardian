// Feature: ui-launch-readiness, Property 7: Usage warning badge threshold
// **Validates: Requirements 1.5, 1.6**

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { isWarningThreshold } from "@/lib/utils/usage";

describe("Property 7: Usage warning badge threshold", () => {
  it("shows badge iff consumed >= 80% of allowance (non-unlimited)", () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 10000 }), // used: 0..10000
        fc.nat({ max: 10000 }), // allowance: 0..10000 (finite)
        (used, allowance) => {
          const result = isWarningThreshold(used, allowance);

          if (allowance === 0) {
            // If allowance is 0 and used > 0, badge should show
            if (used > 0) {
              expect(result).toBe(true);
            } else {
              // used === 0 and allowance === 0: 0/0 not >= 0.8, no badge
              expect(result).toBe(false);
            }
          } else {
            // Normal case: badge shows iff used/allowance >= 0.8
            const ratio = used / allowance;
            if (ratio >= 0.8) {
              expect(result).toBe(true);
            } else {
              expect(result).toBe(false);
            }
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("never shows badge when allowance is unlimited (null)", () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 100000 }), // used: any non-negative integer
        (used) => {
          const result = isWarningThreshold(used, null);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("shows badge for fractional thresholds near the 80% boundary", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }), // allowance must be > 0
        fc.double({ min: 0, max: 2, noNaN: true, noDefaultInfinity: true }), // multiplier
        (allowance, multiplier) => {
          const used = Math.floor(allowance * multiplier);
          const result = isWarningThreshold(used, allowance);

          const ratio = used / allowance;
          if (ratio >= 0.8) {
            expect(result).toBe(true);
          } else {
            expect(result).toBe(false);
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});
