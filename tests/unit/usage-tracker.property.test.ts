// Feature: pricing-tiers, Property 5: Counter Increment
// Feature: pricing-tiers, Property 6: Period Reset Zeroes Counters

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  incrementScans,
  incrementToolCalls,
  resetUsageCounters,
} from "@/lib/usage-tracker";

// ---------------------------------------------------------------------------
// In-memory Supabase mock
// ---------------------------------------------------------------------------

interface OrgRow {
  scans_used_this_period: number;
  tool_calls_used_this_period: number;
  current_period_start: string | null;
  current_period_end: string | null;
}

function createMockSupabase(store: Record<string, OrgRow>) {
  return {
    rpc: async (fnName: string, params: { org_id: string }) => {
      const org = store[params.org_id];
      if (!org) return { error: { message: "not found" } };
      if (fnName === "increment_scans") {
        org.scans_used_this_period += 1;
      } else if (fnName === "increment_tool_calls") {
        org.tool_calls_used_this_period += 1;
      }
      return { error: null };
    },
    from: (_table: string) => ({
      update: (values: Partial<OrgRow>) => ({
        eq: (_col: string, orgId: string) => {
          const org = store[orgId];
          if (org) {
            Object.assign(org, values);
          }
          return Promise.resolve({ error: null });
        },
      }),
      select: (_cols: string) => ({
        eq: (_col: string, orgId: string) => ({
          single: async () => {
            const org = store[orgId];
            return { data: org ?? null, error: org ? null : { message: "not found" } };
          },
        }),
      }),
    }),
  } as any;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Property 5: Counter Increment — for any non-negative starting count n, after one increment the result is n + 1", () => {
  // **Validates: Requirements 4.1, 5.1**

  it("incrementScans: starting from n, after one increment scans_used equals n + 1", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.nat({ max: 1_000_000 }),
        async (startCount) => {
          const orgId = "org-test";
          const store: Record<string, OrgRow> = {
            [orgId]: {
              scans_used_this_period: startCount,
              tool_calls_used_this_period: 0,
              current_period_start: null,
              current_period_end: null,
            },
          };
          const supabase = createMockSupabase(store);

          await incrementScans(supabase, orgId);

          expect(store[orgId].scans_used_this_period).toBe(startCount + 1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("incrementToolCalls: starting from n, after one increment tool_calls_used equals n + 1", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.nat({ max: 1_000_000 }),
        async (startCount) => {
          const orgId = "org-test";
          const store: Record<string, OrgRow> = {
            [orgId]: {
              scans_used_this_period: 0,
              tool_calls_used_this_period: startCount,
              current_period_start: null,
              current_period_end: null,
            },
          };
          const supabase = createMockSupabase(store);

          await incrementToolCalls(supabase, orgId);

          expect(store[orgId].tool_calls_used_this_period).toBe(startCount + 1);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe("Property 6: Period Reset Zeroes Counters — for any scan count s >= 0 and tool-call count t >= 0, after reset both are 0", () => {
  // **Validates: Requirement 6.1**

  it("after resetUsageCounters, both scans_used and tool_calls_used are 0", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.nat({ max: 1_000_000 }),
        fc.nat({ max: 1_000_000 }),
        async (scanCount, toolCallCount) => {
          const orgId = "org-test";
          const store: Record<string, OrgRow> = {
            [orgId]: {
              scans_used_this_period: scanCount,
              tool_calls_used_this_period: toolCallCount,
              current_period_start: "2024-01-01T00:00:00Z",
              current_period_end: "2024-02-01T00:00:00Z",
            },
          };
          const supabase = createMockSupabase(store);

          await resetUsageCounters(supabase, orgId, "2024-02-01T00:00:00Z", "2024-03-01T00:00:00Z");

          const org = store[orgId];
          expect(org.scans_used_this_period).toBe(0);
          expect(org.tool_calls_used_this_period).toBe(0);
          expect(org.current_period_start).toBe("2024-02-01T00:00:00Z");
          expect(org.current_period_end).toBe("2024-03-01T00:00:00Z");
        }
      ),
      { numRuns: 100 }
    );
  });
});
