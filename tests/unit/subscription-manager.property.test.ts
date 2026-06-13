// Feature: pricing-tiers, Property 4: Invalid Billing Cycle Rejection

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { validateBillingCycle } from "@/lib/subscription-manager";

describe("Property 4: Invalid Billing Cycle Rejection — for any string not 'monthly' or 'annual', validateBillingCycle returns false", () => {
  // **Validates: Requirements 3.2**

  it("returns false for arbitrary strings that are not 'monthly' or 'annual'", () => {
    const validCycles = new Set(["monthly", "annual"]);

    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 50 }).filter((s) => !validCycles.has(s)),
        (invalidValue) => {
          expect(validateBillingCycle(invalidValue)).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("returns false for values that are close to valid cycles but not exact", () => {
    const mutations = [
      "Monthly",
      "MONTHLY",
      "Annual",
      "ANNUAL",
      " monthly",
      "monthly ",
      " annual",
      "annual ",
      "monthly1",
      "annual1",
      "month",
      "annu",
      "yearly",
      "weekly",
      "biannual",
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...mutations),
        (mutated) => {
          expect(validateBillingCycle(mutated)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("returns true only for exactly 'monthly' or 'annual'", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("monthly", "annual"),
        (validCycle) => {
          expect(validateBillingCycle(validCycle)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("returns false for non-string types", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer(),
          fc.boolean(),
          fc.constant(null),
          fc.constant(undefined),
          fc.constant({}),
          fc.constant([])
        ),
        (nonStringValue) => {
          expect(validateBillingCycle(nonStringValue)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
