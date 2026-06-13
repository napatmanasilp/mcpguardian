// Feature: mcpguardian-ux-improvements, Property 13: Activity event row link target follows session_id / server_id priority
// **Validates: Requirements 11.6, 11.7, 11.8**

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { resolveEventHref } from "@/components/activity/event-row";
import type { MergedEvent } from "@/lib/types/activity";

/**
 * Arbitrary generator for a MergedEvent with controlled session_id / server_id combinations.
 */
const mergedEventArb = (
  sessionId: fc.Arbitrary<string | null>,
  serverId: fc.Arbitrary<string | null>
): fc.Arbitrary<MergedEvent> =>
  fc.record({
    id: fc.uuid(),
    type: fc.constantFrom("threat" as const, "alert" as const),
    title: fc.string({ minLength: 1, maxLength: 50 }),
    description: fc.string({ maxLength: 100 }),
    severity: fc.constantFrom(
      "critical" as const,
      "high" as const,
      "medium" as const
    ),
    session_id: sessionId,
    server_id: serverId,
    createdAt: fc.date().map((d) => d.toISOString()),
  });

describe("Property 13: Activity event row link target follows session_id / server_id priority", () => {
  it("session_id non-null → /sessions/{session_id} regardless of server_id", () => {
    const arb = mergedEventArb(
      fc.uuid(), // session_id always non-null
      fc.oneof(fc.uuid(), fc.constant(null)) // server_id can be anything
    );

    fc.assert(
      fc.property(arb, (event) => {
        const href = resolveEventHref(event);
        expect(href).toBe(`/sessions/${event.session_id}`);
      }),
      { numRuns: 200 }
    );
  });

  it("session_id null + server_id non-null → /servers/{server_id}", () => {
    const arb = mergedEventArb(
      fc.constant(null), // session_id null
      fc.uuid() // server_id non-null
    );

    fc.assert(
      fc.property(arb, (event) => {
        const href = resolveEventHref(event);
        expect(href).toBe(`/servers/${event.server_id}`);
      }),
      { numRuns: 200 }
    );
  });

  it("both null → null (non-interactive)", () => {
    const arb = mergedEventArb(
      fc.constant(null), // session_id null
      fc.constant(null) // server_id null
    );

    fc.assert(
      fc.property(arb, (event) => {
        const href = resolveEventHref(event);
        expect(href).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it("for any arbitrary combination of session_id and server_id the priority rule holds", () => {
    const arb = mergedEventArb(
      fc.oneof(fc.uuid(), fc.constant(null)),
      fc.oneof(fc.uuid(), fc.constant(null))
    );

    fc.assert(
      fc.property(arb, (event) => {
        const href = resolveEventHref(event);

        if (event.session_id != null) {
          expect(href).toBe(`/sessions/${event.session_id}`);
        } else if (event.server_id != null) {
          expect(href).toBe(`/servers/${event.server_id}`);
        } else {
          expect(href).toBeNull();
        }
      }),
      { numRuns: 300 }
    );
  });
});
