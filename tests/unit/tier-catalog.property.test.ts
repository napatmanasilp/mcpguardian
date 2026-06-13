// Feature: pricing-tiers, Property 1: Tier Catalog Completeness
// Feature: pricing-tiers, Property 2: Invalid Tier Lookup
// Feature: pricing-tiers, Property 3: Annual Total Computation

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  TIER_CATALOG,
  VALID_TIER_IDS,
  getTier,
  getAnnualTotalCents,
  TierId,
} from "@/lib/tier-catalog";

describe("Property 1: Tier Catalog Completeness — assert exactly 5 tier IDs defined", () => {
  // **Validates: Requirements 1.1**

  it("TIER_CATALOG contains exactly the 5 canonical tier IDs", () => {
    const expectedIds: TierId[] = ["free", "developer", "team", "startup", "enterprise"];
    const catalogIds = Object.keys(TIER_CATALOG).sort();
    expect(catalogIds).toEqual([...expectedIds].sort());
    expect(catalogIds).toHaveLength(5);
  });

  it("VALID_TIER_IDS matches the keys of TIER_CATALOG", () => {
    expect([...VALID_TIER_IDS].sort()).toEqual(Object.keys(TIER_CATALOG).sort());
  });

  it("every VALID_TIER_ID resolves via getTier", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...VALID_TIER_IDS),
        (id) => {
          const tier = getTier(id);
          expect(tier).toBeDefined();
          expect(tier!.id).toBe(id);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("Property 2: Invalid Tier Lookup — for any string not in valid IDs, getTier returns undefined", () => {
  // **Validates: Requirements 1.7**

  it("returns undefined for arbitrary strings not matching a valid tier ID", () => {
    const validSet = new Set<string>(VALID_TIER_IDS);

    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 50 }).filter((s) => !validSet.has(s)),
        (invalidId) => {
          expect(getTier(invalidId)).toBeUndefined();
        }
      ),
      { numRuns: 200 }
    );
  });

  it("returns undefined for strings that are close to valid IDs but not exact", () => {
    const mutations = VALID_TIER_IDS.flatMap((id) => [
      id.toUpperCase(),
      ` ${id}`,
      `${id} `,
      `${id}1`,
      `_${id}`,
    ]);

    for (const mutated of mutations) {
      if (!VALID_TIER_IDS.includes(mutated as TierId)) {
        expect(getTier(mutated)).toBeUndefined();
      }
    }
  });
});

describe("Property 3: Annual Total Computation — for paid tiers, getAnnualTotalCents equals annualPricePerMonthCents * 12", () => {
  // **Validates: Requirements 2.4**

  const paidTiers = VALID_TIER_IDS
    .map((id) => getTier(id)!)
    .filter((t) => t.annualPricePerMonthCents > 0);

  it("for each paid tier, annual total equals annualPricePerMonthCents * 12", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...paidTiers),
        (tier) => {
          const result = getAnnualTotalCents(tier);
          expect(result).toBe(tier.annualPricePerMonthCents * 12);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("free tier annual total is 0 (not positive)", () => {
    const freeTier = getTier("free")!;
    expect(getAnnualTotalCents(freeTier)).toBe(0);
  });

  it("enterprise tier annual total is -1 (custom sentinel)", () => {
    const enterpriseTier = getTier("enterprise")!;
    expect(getAnnualTotalCents(enterpriseTier)).toBe(-1);
  });
});
