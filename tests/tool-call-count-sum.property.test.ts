// Feature: mcpguardian-ux-improvements, Property 21: Tool call count sum
// **Validates: Requirements 14.6**

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { computeTotalToolCalls } from "@/lib/utils/sessions";

describe("Property 21: Tool call count sum equals the sum of all session tool_call_count values", () => {
  it("computes the correct sum for any array of sessions with arbitrary tool_call_count (including null/undefined)", () => {
    const sessionArb = fc.record({
      tool_call_count: fc.oneof(
        fc.integer({ min: 0, max: 10000 }),
        fc.constant(null),
        fc.constant(undefined)
      ),
    });

    fc.assert(
      fc.property(fc.array(sessionArb, { minLength: 0, maxLength: 100 }), (sessions) => {
        const result = computeTotalToolCalls(sessions);
        const expected = sessions.reduce(
          (sum, s) => sum + (s.tool_call_count ?? 0),
          0
        );
        expect(result).toBe(expected);
      }),
      { numRuns: 200 }
    );
  });

  it("returns 0 for an empty array", () => {
    expect(computeTotalToolCalls([])).toBe(0);
  });

  it("returns 0 when all sessions have null tool_call_count", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constant({ tool_call_count: null }), { minLength: 1, maxLength: 50 }),
        (sessions) => {
          expect(computeTotalToolCalls(sessions)).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("returns 0 when all sessions have undefined tool_call_count", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constant({ tool_call_count: undefined }), { minLength: 1, maxLength: 50 }),
        (sessions) => {
          expect(computeTotalToolCalls(sessions)).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("correctly sums positive values mixed with nulls and undefined", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.oneof(
            fc.record({ tool_call_count: fc.integer({ min: 1, max: 500 }) }),
            fc.record({ tool_call_count: fc.constant(null) }),
            fc.record({ tool_call_count: fc.constant(undefined) })
          ),
          { minLength: 1, maxLength: 100 }
        ),
        (sessions) => {
          const result = computeTotalToolCalls(sessions);
          // Result must be non-negative
          expect(result).toBeGreaterThanOrEqual(0);
          // Result must equal the manual sum
          const manualSum = sessions.reduce(
            (sum, s) => sum + (s.tool_call_count ?? 0),
            0
          );
          expect(result).toBe(manualSum);
        }
      ),
      { numRuns: 100 }
    );
  });
});
