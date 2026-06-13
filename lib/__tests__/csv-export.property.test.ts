// Feature: ui-launch-readiness, Property 9: CSV export column structure
// **Validates: Requirements 5.5**

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { buildCsvContent } from "@/lib/utils/csv";
import type { MergedEvent } from "@/lib/types/activity";

const EXPECTED_HEADERS = "id,type,title,description,severity,session_id,server_id,created_at";

/**
 * ISO 8601 UTC regex: YYYY-MM-DDTHH:mm:ss.sssZ
 */
const ISO_8601_UTC_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/**
 * Arbitrary for realistic ISO date strings (years 2000–2099).
 */
const isoDateArb = fc
  .integer({ min: 946684800000, max: 4102444800000 })
  .map((ms) => new Date(ms).toISOString());

/**
 * Arbitrary generator for MergedEvent objects.
 */
const mergedEventArb: fc.Arbitrary<MergedEvent> = fc.record({
  id: fc.uuid(),
  type: fc.constantFrom("threat" as const, "alert" as const),
  title: fc.string({ minLength: 1, maxLength: 100 }),
  description: fc.string({ maxLength: 200 }),
  severity: fc.constantFrom("critical" as const, "high" as const, "medium" as const),
  session_id: fc.oneof(fc.uuid(), fc.constant(null)),
  server_id: fc.oneof(fc.uuid(), fc.constant(null)),
  createdAt: isoDateArb,
});

describe("Property 9: CSV export column structure", () => {
  it("output always starts with the exact expected header row", () => {
    fc.assert(
      fc.property(
        fc.array(mergedEventArb, { minLength: 0, maxLength: 50 }),
        (events) => {
          const csv = buildCsvContent(events);
          const firstLine = csv.split("\n")[0];
          expect(firstLine).toBe(EXPECTED_HEADERS);
        }
      ),
      { numRuns: 150 }
    );
  });

  it("every row's created_at value is a valid ISO 8601 UTC string", () => {
    fc.assert(
      fc.property(
        fc.array(mergedEventArb, { minLength: 1, maxLength: 50 }),
        (events) => {
          const csv = buildCsvContent(events);
          const lines = csv.split("\n");

          // Skip header row, check each data row
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            // created_at is the last field; ISO timestamps contain no commas or quotes
            const lastCommaIdx = line.lastIndexOf(",");
            const createdAtRaw = line.slice(lastCommaIdx + 1).replace(/^"|"$/g, "");
            expect(createdAtRaw).toMatch(ISO_8601_UTC_REGEX);

            // Verify it's actually parseable as a valid date
            const parsed = new Date(createdAtRaw);
            expect(parsed.getTime()).not.toBeNaN();
          }
        }
      ),
      { numRuns: 150 }
    );
  });

  it("header has exactly 8 columns matching the required schema", () => {
    const csv = buildCsvContent([]);
    const headers = csv.split("\n")[0].split(",");
    expect(headers).toEqual([
      "id",
      "type",
      "title",
      "description",
      "severity",
      "session_id",
      "server_id",
      "created_at",
    ]);
    expect(headers.length).toBe(8);
  });
});
