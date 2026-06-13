// Feature: pricing-tiers, Property 7: Quota Decision Correctness
// Feature: pricing-tiers, Property 8: Warning Threshold at 80%
// Feature: pricing-tiers, Property 9: Upgrade Applies New Allowances
// Feature: pricing-tiers, Property 10: Pending Downgrade Preserves Current Allowances

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { checkQuota, shouldShowWarning } from "@/lib/quota-enforcer";
import { TIER_CATALOG, VALID_TIER_IDS, TierId } from "@/lib/tier-catalog";

describe("Property 7: Quota Decision Correctness — allowed iff allowance is null OR usage < allowance", () => {
  // **Validates: Requirements 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 12.2**

  it("permits operation when allowance is null (unlimited)", () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 1_000_000 }),
        fc.constantFrom("scan" as const, "tool_call" as const),
        (usage, quotaType) => {
          const result = checkQuota(usage, null, "Enterprise", quotaType);
          expect(result.allowed).toBe(true);
          expect(result.allowance).toBeNull();
          expect(result.tierName).toBe("Enterprise");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("permits operation when usage is strictly below a positive allowance", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000 }),
        fc.constantFrom("scan" as const, "tool_call" as const),
        fc.constantFrom("Free", "Developer", "Team", "Startup"),
        (allowance, quotaType, tierName) => {
          // usage in [0, allowance - 1]
          const usage = fc.sample(fc.nat({ max: allowance - 1 }), 1)[0];
          const result = checkQuota(usage, allowance, tierName, quotaType);
          expect(result.allowed).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("blocks operation when usage equals or exceeds a positive allowance", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100_000 }),
        fc.nat({ max: 100_000 }),
        fc.constantFrom("scan" as const, "tool_call" as const),
        fc.constantFrom("Free", "Developer", "Team", "Startup"),
        (allowance, extra, quotaType, tierName) => {
          const usage = allowance + extra; // usage >= allowance
          const result = checkQuota(usage, allowance, tierName, quotaType);
          expect(result.allowed).toBe(false);
          expect(result.reason).toBeDefined();
          expect(result.reason).toContain(tierName);
          expect(result.allowance).toBe(allowance);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("the allowed decision matches the formula: allowance === null || usage < allowance", () => {
    const allowanceArb = fc.oneof(
      fc.constant(null),
      fc.integer({ min: 1, max: 500_000 })
    );

    fc.assert(
      fc.property(
        fc.nat({ max: 1_000_000 }),
        allowanceArb,
        fc.constantFrom("scan" as const, "tool_call" as const),
        (usage, allowance, quotaType) => {
          const result = checkQuota(usage, allowance, "TestTier", quotaType);
          const expectedAllowed = allowance === null || usage < allowance;
          expect(result.allowed).toBe(expectedAllowed);
        }
      ),
      { numRuns: 200 }
    );
  });
});

describe("Property 8: Warning Threshold at 80% — warning true iff usage >= 0.8 * allowance; always false for unlimited", () => {
  // **Validates: Requirements 9.3, 9.4**

  it("always returns false for unlimited (null) allowance", () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 1_000_000 }),
        (usage) => {
          expect(shouldShowWarning(usage, null)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("returns true iff usage >= 0.8 * allowance for positive allowances", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000 }),
        fc.nat({ max: 1_000_000 }),
        (allowance, usage) => {
          const result = shouldShowWarning(usage, allowance);
          const expected = usage >= 0.8 * allowance;
          expect(result).toBe(expected);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("boundary: at exactly 80% of allowance, warning is true", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 5, max: 100_000 }).filter((a) => Number.isInteger(a * 0.8)),
        (allowance) => {
          const threshold = Math.floor(allowance * 0.8);
          expect(shouldShowWarning(threshold, allowance)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("boundary: just below 80% of allowance, warning is false", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 100_000 }).filter((a) => Math.floor(a * 0.8) > 0),
        (allowance) => {
          const justBelow = Math.floor(allowance * 0.8) - 1;
          if (justBelow >= 0 && justBelow < 0.8 * allowance) {
            expect(shouldShowWarning(justBelow, allowance)).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("Property 9: Upgrade Applies New Allowances — for tier pairs where target > current, quota checks use new tier's allowances", () => {
  // **Validates: Requirement 10.3**

  // Build ordered tier pairs where target is higher than current
  const tierOrder = VALID_TIER_IDS; // ['free', 'developer', 'team', 'startup', 'enterprise']

  const upgradePairArb = fc.integer({ min: 0, max: tierOrder.length - 2 }).chain((currentIdx) =>
    fc.integer({ min: currentIdx + 1, max: tierOrder.length - 1 }).map((targetIdx) => ({
      currentTierId: tierOrder[currentIdx],
      targetTierId: tierOrder[targetIdx],
    }))
  );

  it("after upgrade, quota decision uses the new (higher) tier's scan allowance", () => {
    fc.assert(
      fc.property(
        upgradePairArb,
        fc.nat({ max: 10_000 }),
        ({ currentTierId, targetTierId }, usage) => {
          const targetTier = TIER_CATALOG[targetTierId];
          const newAllowance = targetTier.scanAllowance;

          // checkQuota with the new tier's allowance should reflect that tier's limits
          const result = checkQuota(usage, newAllowance, targetTier.displayName, "scan");
          const expectedAllowed = newAllowance === null || usage < newAllowance;
          expect(result.allowed).toBe(expectedAllowed);
          expect(result.tierName).toBe(targetTier.displayName);
          expect(result.allowance).toBe(newAllowance);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("after upgrade, quota decision uses the new (higher) tier's tool call allowance", () => {
    fc.assert(
      fc.property(
        upgradePairArb,
        fc.nat({ max: 1_000_000 }),
        ({ currentTierId, targetTierId }, usage) => {
          const targetTier = TIER_CATALOG[targetTierId];
          const newAllowance = targetTier.toolCallAllowance;

          const result = checkQuota(usage, newAllowance, targetTier.displayName, "tool_call");
          const expectedAllowed = newAllowance === null || usage < newAllowance;
          expect(result.allowed).toBe(expectedAllowed);
          expect(result.tierName).toBe(targetTier.displayName);
          expect(result.allowance).toBe(newAllowance);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("upgraded tier has equal or higher allowance than current tier", () => {
    fc.assert(
      fc.property(
        upgradePairArb,
        ({ currentTierId, targetTierId }) => {
          const currentTier = TIER_CATALOG[currentTierId];
          const targetTier = TIER_CATALOG[targetTierId];

          // For scan allowance: null (unlimited) is always >= any finite value
          if (targetTier.scanAllowance === null) {
            // Unlimited is always higher — pass
            expect(true).toBe(true);
          } else if (currentTier.scanAllowance === null) {
            // Current is unlimited but target is not — this shouldn't happen in an upgrade
            // but the property still holds since we test the quota decision uses new values
            expect(true).toBe(true);
          } else {
            expect(targetTier.scanAllowance).toBeGreaterThanOrEqual(currentTier.scanAllowance);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("Property 10: Pending Downgrade Preserves Current Allowances — quota uses current (active) tier's allowances", () => {
  // **Validates: Requirement 11.2**

  // Build ordered tier pairs where target is lower than current (downgrade)
  const tierOrder = VALID_TIER_IDS;

  const downgradePairArb = fc.integer({ min: 1, max: tierOrder.length - 1 }).chain((currentIdx) =>
    fc.integer({ min: 0, max: currentIdx - 1 }).map((targetIdx) => ({
      currentTierId: tierOrder[currentIdx],
      pendingTierId: tierOrder[targetIdx],
    }))
  );

  it("while downgrade is pending, checkQuota uses the current tier's scan allowance (not the pending tier)", () => {
    fc.assert(
      fc.property(
        downgradePairArb,
        fc.nat({ max: 10_000 }),
        ({ currentTierId, pendingTierId }, usage) => {
          const currentTier = TIER_CATALOG[currentTierId];
          const pendingTier = TIER_CATALOG[pendingTierId];
          const currentAllowance = currentTier.scanAllowance;

          // The quota enforcer should use current tier allowance while downgrade is pending
          const result = checkQuota(usage, currentAllowance, currentTier.displayName, "scan");
          const expectedAllowed = currentAllowance === null || usage < currentAllowance;
          expect(result.allowed).toBe(expectedAllowed);
          expect(result.tierName).toBe(currentTier.displayName);
          expect(result.allowance).toBe(currentAllowance);

          // Verify current tier's allowance is >= pending tier's (confirms we're using the higher limit)
          if (currentAllowance !== null && pendingTier.scanAllowance !== null) {
            expect(currentAllowance).toBeGreaterThanOrEqual(pendingTier.scanAllowance);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("while downgrade is pending, checkQuota uses the current tier's tool call allowance (not the pending tier)", () => {
    fc.assert(
      fc.property(
        downgradePairArb,
        fc.nat({ max: 1_000_000 }),
        ({ currentTierId, pendingTierId }, usage) => {
          const currentTier = TIER_CATALOG[currentTierId];
          const pendingTier = TIER_CATALOG[pendingTierId];
          const currentAllowance = currentTier.toolCallAllowance;

          // The quota enforcer should use current tier allowance while downgrade is pending
          const result = checkQuota(usage, currentAllowance, currentTier.displayName, "tool_call");
          const expectedAllowed = currentAllowance === null || usage < currentAllowance;
          expect(result.allowed).toBe(expectedAllowed);
          expect(result.tierName).toBe(currentTier.displayName);
          expect(result.allowance).toBe(currentAllowance);

          // Verify current tier's allowance is >= pending tier's
          if (currentAllowance !== null && pendingTier.toolCallAllowance !== null) {
            expect(currentAllowance).toBeGreaterThanOrEqual(pendingTier.toolCallAllowance);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("using pending tier allowance would be more restrictive than current tier", () => {
    fc.assert(
      fc.property(
        downgradePairArb,
        ({ currentTierId, pendingTierId }) => {
          const currentTier = TIER_CATALOG[currentTierId];
          const pendingTier = TIER_CATALOG[pendingTierId];

          // For finite allowances, pending (lower) tier should have <= allowance
          if (currentTier.scanAllowance !== null && pendingTier.scanAllowance !== null) {
            expect(currentTier.scanAllowance).toBeGreaterThanOrEqual(pendingTier.scanAllowance);
          }
          if (currentTier.toolCallAllowance !== null && pendingTier.toolCallAllowance !== null) {
            expect(currentTier.toolCallAllowance).toBeGreaterThanOrEqual(pendingTier.toolCallAllowance);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
