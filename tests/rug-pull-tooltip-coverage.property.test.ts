// Feature: mcpguardian-ux-improvements, Property 20: Rug-pull tooltip coverage
//
// **Validates: Requirements 14.5**

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { RUG_PULL_DESCRIPTION } from "@/components/sessions/rug-pull-tooltip";
import { requiresRugPullTooltip } from "@/lib/utils/sessions";

const EXPECTED_TOOLTIP_TEXT =
  "Rug pull: the MCP server attempted to exfiltrate data or execute unauthorized actions, causing the session to be terminated.";

const ALL_STATUSES = [
  "active",
  "terminated_clean",
  "terminated_threat",
  "terminated_rug_pull",
  "expired",
] as const;

const validDateArb = fc
  .integer({ min: 1577836800000, max: 1893456000000 })
  .map((ts) => new Date(ts).toISOString());

describe("Property 20: Rug-pull tooltip wraps every 'rug pull' occurrence", () => {
  it("RUG_PULL_DESCRIPTION constant always equals the exact required tooltip text", () => {
    // The tooltip text constant must be exactly the required string — verified as a property
    // that holds regardless of any generated session data
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          status: fc.constant("terminated_rug_pull"),
          tool_call_count: fc.integer({ min: 0, max: 1000 }),
          started_at: validDateArb,
        }),
        (_session) => {
          // For any session with terminated_rug_pull status, the tooltip text must be exact
          expect(RUG_PULL_DESCRIPTION).toBe(EXPECTED_TOOLTIP_TEXT);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("requiresRugPullTooltip returns true for any session with status 'terminated_rug_pull'", () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          status: fc.constant("terminated_rug_pull"),
          tool_call_count: fc.oneof(
            fc.integer({ min: 0, max: 10000 }),
            fc.constant(null)
          ),
          started_at: validDateArb,
          agent_identifier: fc.oneof(fc.string(), fc.constant(null)),
        }),
        (session) => {
          expect(requiresRugPullTooltip(session.status)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("requiresRugPullTooltip returns false for any non-rug-pull status", () => {
    const nonRugPullStatuses = fc.oneof(
      fc.constant("active"),
      fc.constant("terminated_clean"),
      fc.constant("terminated_threat"),
      fc.constant("expired")
    );

    fc.assert(
      fc.property(nonRugPullStatuses, (status) => {
        expect(requiresRugPullTooltip(status)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it("requiresRugPullTooltip returns false for any arbitrary string that is not 'terminated_rug_pull'", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => s !== "terminated_rug_pull"),
        (status) => {
          expect(requiresRugPullTooltip(status)).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("tooltip text length is non-zero and matches expected character count", () => {
    expect(RUG_PULL_DESCRIPTION.length).toBe(EXPECTED_TOOLTIP_TEXT.length);
    expect(RUG_PULL_DESCRIPTION.length).toBeGreaterThan(0);
  });

  it("for any array of sessions, all terminated_rug_pull sessions require tooltip", () => {
    const sessionArb = fc.record({
      id: fc.uuid(),
      status: fc.constantFrom(...ALL_STATUSES),
      tool_call_count: fc.oneof(
        fc.integer({ min: 0, max: 5000 }),
        fc.constant(null)
      ),
      started_at: validDateArb,
    });

    fc.assert(
      fc.property(
        fc.array(sessionArb, { minLength: 1, maxLength: 50 }),
        (sessions) => {
          const rugPullSessions = sessions.filter(
            (s) => s.status === "terminated_rug_pull"
          );
          const nonRugPullSessions = sessions.filter(
            (s) => s.status !== "terminated_rug_pull"
          );

          // Every rug pull session requires tooltip
          for (const s of rugPullSessions) {
            expect(requiresRugPullTooltip(s.status)).toBe(true);
          }

          // No non-rug-pull session requires tooltip
          for (const s of nonRugPullSessions) {
            expect(requiresRugPullTooltip(s.status)).toBe(false);
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});
