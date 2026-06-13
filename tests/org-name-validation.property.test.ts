// Feature: mcpguardian-ux-improvements, Property 5: Org name persistence round trip
// **Validates: Requirements 2.2**

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { validateOrgName } from "@/lib/utils/settings";

describe("Property 5: Org name persistence round trip", () => {
  it("any string of length 1–100 (after trimming) passes validation and the trimmed result equals the input trimmed", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length >= 1 && s.trim().length <= 100),
        (input) => {
          const result = validateOrgName(input);
          expect(result.valid).toBe(true);
          expect(result.trimmedName).toBe(input.trim());
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 200 }
    );
  });

  it("strings that are empty after trimming are rejected", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(" ", "\t", "\n", "\r"), { minLength: 0, maxLength: 50 }).map((arr) => arr.join("")),
        (input) => {
          const result = validateOrgName(input);
          expect(result.valid).toBe(false);
          expect(result.error).toBe("Organization name must be between 1 and 100 characters.");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("strings longer than 100 characters after trimming are rejected", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 101, maxLength: 300 }).filter((s) => s.trim().length > 100),
        (input) => {
          const result = validateOrgName(input);
          expect(result.valid).toBe(false);
          expect(result.error).toBe("Organization name must be between 1 and 100 characters.");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("non-string inputs are rejected", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.integer(),
          fc.boolean(),
          fc.constant({})
        ),
        (input) => {
          const result = validateOrgName(input);
          expect(result.valid).toBe(false);
          expect(result.error).toBe("Organization name is required.");
        }
      ),
      { numRuns: 50 }
    );
  });

  it("trimming is applied: leading/trailing whitespace is stripped and the trimmed value is persisted", () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.array(fc.constantFrom(" ", "\t"), { minLength: 0, maxLength: 10 }).map((arr) => arr.join("")),
          fc.string({ minLength: 1, maxLength: 80 }).filter((s) => s.trim().length >= 1),
          fc.array(fc.constantFrom(" ", "\t"), { minLength: 0, maxLength: 10 }).map((arr) => arr.join(""))
        ),
        ([leadingWs, core, trailingWs]) => {
          const input = leadingWs + core + trailingWs;
          const expectedTrimmed = input.trim();
          // Only test inputs where trimmed length is valid (1-100)
          if (expectedTrimmed.length >= 1 && expectedTrimmed.length <= 100) {
            const result = validateOrgName(input);
            expect(result.valid).toBe(true);
            expect(result.trimmedName).toBe(expectedTrimmed);
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});
