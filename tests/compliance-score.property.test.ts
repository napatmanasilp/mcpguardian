// Feature: mcpguardian-ux-improvements, Property 15: Compliance score excludes roadmap controls
// **Validates: Requirements 12.1**

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { computeComplianceScore, ComplianceControl } from "@/lib/compliance-score";

describe("Property 15: Compliance score excludes roadmap controls", () => {
  const controlArb = fc.record({
    defaultStatus: fc.oneof(fc.constant("passed" as const), fc.constant("roadmap" as const)),
    passed: fc.boolean(),
  });

  it("computeComplianceScore equals the expected formula for any array of controls", () => {
    fc.assert(
      fc.property(fc.array(controlArb, { minLength: 1 }), (controls) => {
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

  it("returns 0 when all controls are roadmap (no non-roadmap controls exist)", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({ defaultStatus: fc.constant("roadmap" as const), passed: fc.boolean() }),
          { minLength: 1 }
        ),
        (controls) => {
          expect(computeComplianceScore(controls)).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("roadmap controls do not affect the score regardless of their passed value", () => {
    fc.assert(
      fc.property(
        fc.array(controlArb, { minLength: 1 }),
        fc.array(
          fc.record({ defaultStatus: fc.constant("roadmap" as const), passed: fc.boolean() }),
          { minLength: 0 }
        ),
        (baseControls, extraRoadmapControls) => {
          const withoutExtra = computeComplianceScore(baseControls);
          const withExtra = computeComplianceScore([...baseControls, ...extraRoadmapControls]);
          expect(withExtra).toBe(withoutExtra);
        }
      ),
      { numRuns: 200 }
    );
  });
});
