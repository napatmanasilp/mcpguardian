// Feature: mcpguardian-ux-improvements, Property 9: "Scan Now" navigates to the most recently created server
// **Validates: Requirements 9.2**

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { resolveScanNowTarget } from "@/lib/utils/navigation";

describe('Property 9: "Scan Now" navigates to the most recently created server', () => {
  it("for any non-empty array of servers with distinct created_at timestamps, returns /servers/{id} of the most recent server", () => {
    // Generate an array of unique timestamps, then assign each a unique id
    const serverArrayArb = fc
      .uniqueArray(
        fc.integer({
          min: new Date("2020-01-01T00:00:00Z").getTime(),
          max: new Date("2030-12-31T23:59:59Z").getTime(),
        }),
        { minLength: 1, maxLength: 50 }
      )
      .chain((timestamps) =>
        fc
          .array(fc.uuid(), {
            minLength: timestamps.length,
            maxLength: timestamps.length,
          })
          .map((ids) =>
            timestamps.map((ts, i) => ({
              id: ids[i],
              created_at: new Date(ts).toISOString(),
            }))
          )
      );

    fc.assert(
      fc.property(serverArrayArb, (servers) => {
        const result = resolveScanNowTarget(servers);

        // Find the server with the max created_at
        const mostRecent = servers.reduce((max, current) =>
          new Date(current.created_at).getTime() >
          new Date(max.created_at).getTime()
            ? current
            : max
        );

        expect(result).toBe(`/servers/${mostRecent.id}`);
      }),
      { numRuns: 200 }
    );
  });

  it("returns /servers/new when the servers array is empty", () => {
    const result = resolveScanNowTarget([]);
    expect(result).toBe("/servers/new");
  });

  it("returns the correct path for a single server", () => {
    fc.assert(
      fc.property(
        fc.record({
          id: fc.uuid(),
          created_at: fc
            .date({
              min: new Date("2020-01-01T00:00:00Z"),
              max: new Date("2030-12-31T23:59:59Z"),
            })
            .map((d) => d.toISOString()),
        }),
        (server) => {
          const result = resolveScanNowTarget([server]);
          expect(result).toBe(`/servers/${server.id}`);
        }
      ),
      { numRuns: 100 }
    );
  });
});
