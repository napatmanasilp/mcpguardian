// Feature: ui-launch-readiness, Property 8: Compliance score computation
// **Validates: Requirements 6.1**

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { computeComplianceScore, ComplianceControl } from "@/lib/compliance-score";

describe("Property 8: Compliance score computation", () => {
  const controlArb: fc.Arbitrary<ComplianceControl> = fc.record({
    defaultStatus: fc.oneof(
      fc.constant("passed" as const),
      fc.constant("roadmap" as const)
    ),
    passed: fc.boolean(),
  });

  it("score equals Math.round((passed_non_roadmap / total_non_roadmap) * 100) for any control array", () => {
    fc.assert(
      fc.property(fc.array(controlArb, { minLength: 0, maxLength: 50 }), (controls) => {
        const result = computeComplianceScore(controls);

        const nonRoadmap = controls.filter((c) => c.defaultStatus !== "roadmap");
        if (nonRoadmap.length === 0) {
          expect(result).toBe(0);
        } else {
          const passedCount = nonRoadmap.filter((c) => c.passed).length;
          const expected = Math.round((passedCount / nonRoadmap.length) * 100);
          expect(result).toBe(expected);
        }
      }),
      { numRuns: 200 }
    );
  });

  it("score is always an integer between 0 and 100 inclusive", () => {
    fc.assert(
      fc.property(fc.array(controlArb, { minLength: 0, maxLength: 50 }), (controls) => {
        const result = computeComplianceScore(controls);

        expect(Number.isInteger(result)).toBe(true);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(100);
      }),
      { numRuns: 200 }
    );
  });

  it("roadmap controls never affect the score", () => {
    fc.assert(
      fc.property(
        fc.array(controlArb, { minLength: 1, maxLength: 30 }),
        fc.array(
          fc.record({
            defaultStatus: fc.constant("roadmap" as const),
            passed: fc.boolean(),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        (baseControls, extraRoadmap) => {
          const scoreWithout = computeComplianceScore(baseControls);
          const scoreWith = computeComplianceScore([...baseControls, ...extraRoadmap]);
          expect(scoreWith).toBe(scoreWithout);
        }
      ),
      { numRuns: 200 }
    );
  });
});
