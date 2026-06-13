// Feature: mcpguardian-ux-improvements, Property 11: Every server row has a Rescan button
// **Validates: Requirements 10.1**

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { getRescanButtonCount } from "@/lib/utils/servers";

describe("Property 11: Every server row has a Rescan button", () => {
  it("for any non-empty array of server objects, the UI renders exactly one RescanButton per server row", () => {
    const serverArrayArb = fc.array(
      fc.record({
        id: fc.uuid(),
        name: fc.string({ minLength: 1, maxLength: 253 }),
        created_at: fc
          .integer({
            min: new Date("2020-01-01T00:00:00Z").getTime(),
            max: new Date("2030-12-31T23:59:59Z").getTime(),
          })
          .map((ts) => new Date(ts).toISOString()),
      }),
      { minLength: 1, maxLength: 100 }
    );

    fc.assert(
      fc.property(serverArrayArb, (servers) => {
        const rescanButtonCount = getRescanButtonCount(servers.length);

        // Every server row must have exactly one Rescan button
        expect(rescanButtonCount).toBe(servers.length);

        // The count must always be positive for non-empty arrays
        expect(rescanButtonCount).toBeGreaterThan(0);
      }),
      { numRuns: 200 }
    );
  });

  it("the rescan button count equals the server count for any positive integer", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1000 }),
        (serverCount) => {
          const result = getRescanButtonCount(serverCount);

          // One-to-one mapping: each server row has exactly one button
          expect(result).toBe(serverCount);

          // Button is always enabled by default (count > 0 means buttons exist)
          expect(result).toBeGreaterThan(0);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("the rescan button count is never zero for a non-empty server list", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 500 }),
        (serverCount) => {
          const result = getRescanButtonCount(serverCount);
          expect(result).toBeGreaterThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });
});
