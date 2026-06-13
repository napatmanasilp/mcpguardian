// Feature: mcpguardian-ux-improvements, Property 2: Password strength classification covers all inputs
// **Validates: Requirements 5.5, 5.6, 5.7**

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { computeStrength } from "../password-strength-meter";

describe("Property 2: Password strength classification covers all inputs", () => {
  it("returns 'weak' iff password.length < 8", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 7 }), (password) => {
        expect(computeStrength(password)).toBe("weak");
      }),
      { numRuns: 100 }
    );
  });

  it("returns 'strong' iff length >= 8 AND has uppercase AND lowercase AND digit-or-special", () => {
    // Generate passwords that satisfy all strong criteria
    const strongArb = fc
      .tuple(
        fc.string({ minLength: 0, maxLength: 42 }), // filler
        fc.constantFrom(..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
        fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz"),
        fc.constantFrom(..."0123456789!@#$%^&*()-_=+[]{}|;:',.<>?/`~")
      )
      .map(([filler, upper, lower, digitOrSpecial]) => {
        // Ensure the password is at least 8 chars and contains all required character classes
        const base = `${upper}${lower}${digitOrSpecial}${filler}`;
        return base.length >= 8 ? base : base + "a".repeat(8 - base.length);
      });

    fc.assert(
      fc.property(strongArb, (password) => {
        expect(password.length).toBeGreaterThanOrEqual(8);
        expect(computeStrength(password)).toBe("strong");
      }),
      { numRuns: 100 }
    );
  });

  it("returns 'fair' for passwords with length >= 8 that do NOT satisfy all strong criteria", () => {
    // Generate passwords >= 8 chars that are missing at least one character class
    const fairArb = fc
      .oneof(
        // Only lowercase (no uppercase, no digit/special)
        fc.string({ minLength: 8, maxLength: 50 }).map((s) =>
          s.replace(/[A-Z]/g, "a").replace(/[0-9!-/:-@[-`{-~]/g, "a")
        ),
        // Only uppercase (no lowercase, no digit/special)
        fc.string({ minLength: 8, maxLength: 50 }).map((s) =>
          s.replace(/[a-z]/g, "A").replace(/[0-9!-/:-@[-`{-~]/g, "A")
        ),
        // Uppercase + lowercase but no digit/special
        fc.tuple(
          fc.constantFrom(..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
          fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz"),
          fc.string({ minLength: 6, maxLength: 48 })
        ).map(([upper, lower, filler]) => {
          const base = `${upper}${lower}${filler}`;
          // Remove any digit or special characters to ensure the condition fails
          return base.replace(/[0-9!-/:-@[-`{-~]/g, "x");
        })
      )
      .filter((p) => {
        // Ensure password is >= 8 AND does NOT meet all strong criteria
        if (p.length < 8) return false;
        const hasUpper = /[A-Z]/.test(p);
        const hasLower = /[a-z]/.test(p);
        const hasDigitOrSpecial = /[0-9!-/:-@[-`{-~]/.test(p);
        return !(hasUpper && hasLower && hasDigitOrSpecial);
      });

    fc.assert(
      fc.property(fairArb, (password) => {
        expect(password.length).toBeGreaterThanOrEqual(8);
        expect(computeStrength(password)).toBe("fair");
      }),
      { numRuns: 100 }
    );
  });

  it("classifies every arbitrary string into exactly one of 'weak', 'fair', or 'strong' following spec rules", () => {
    fc.assert(
      fc.property(fc.string(), (password) => {
        const result = computeStrength(password);

        // Must be one of the three valid levels
        expect(["weak", "fair", "strong"]).toContain(result);

        // Verify classification matches spec rules
        if (password.length < 8) {
          expect(result).toBe("weak");
        } else {
          const hasUpper = /[A-Z]/.test(password);
          const hasLower = /[a-z]/.test(password);
          const hasDigitOrSpecial = /[0-9!-/:-@[-`{-~]/.test(password);

          if (hasUpper && hasLower && hasDigitOrSpecial) {
            expect(result).toBe("strong");
          } else {
            expect(result).toBe("fair");
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});
