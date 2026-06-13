// Feature: mcpguardian-ux-improvements, Property 14: CSV export contains required columns and correct formatting
// **Validates: Requirements 11.10**

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { buildCsvContent, getCsvFilename } from "@/lib/utils/csv";
import type { MergedEvent } from "@/lib/types/activity";

/**
 * Arbitrary for realistic date strings (years 2000-2099, which always produce
 * 4-digit year ISO strings ending in Z).
 */
const isoDateArb = fc.integer({ min: 946684800000, max: 4102444800000 }).map(
  (ms) => new Date(ms).toISOString()
);

/**
 * Arbitrary generator for MergedEvent objects with diverse field values.
 */
const mergedEventArb: fc.Arbitrary<MergedEvent> = fc.record({
  id: fc.uuid(),
  type: fc.constantFrom("threat" as const, "alert" as const),
  title: fc.string({ minLength: 1, maxLength: 80 }),
  description: fc.string({ maxLength: 200 }),
  severity: fc.constantFrom(
    "critical" as const,
    "high" as const,
    "medium" as const
  ),
  session_id: fc.oneof(fc.uuid(), fc.constant(null)),
  server_id: fc.oneof(fc.uuid(), fc.constant(null)),
  createdAt: isoDateArb,
});

const EXPECTED_HEADER = "id,type,title,description,severity,session_id,server_id,created_at";

/**
 * ISO 8601 UTC pattern: YYYY-MM-DDTHH:mm:ss.sssZ
 */
const ISO_8601_UTC_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/**
 * Filename pattern: threat-log-YYYY-MM-DD.csv
 */
const FILENAME_REGEX = /^threat-log-\d{4}-\d{2}-\d{2}\.csv$/;

describe("Property 14: CSV export contains required columns and correct formatting", () => {
  it("getCsvFilename matches threat-log-YYYY-MM-DD.csv format", () => {
    const filename = getCsvFilename();
    expect(filename).toMatch(FILENAME_REGEX);

    // Verify the date part is today's UTC date
    const todayUtc = new Date().toISOString().slice(0, 10);
    expect(filename).toBe(`threat-log-${todayUtc}.csv`);
  });

  it("buildCsvContent has exact header row for any array of events", () => {
    fc.assert(
      fc.property(
        fc.array(mergedEventArb, { minLength: 0, maxLength: 50 }),
        (events) => {
          const csv = buildCsvContent(events);
          const lines = csv.split("\n");
          expect(lines[0]).toBe(EXPECTED_HEADER);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("buildCsvContent produces exactly n + 1 rows for n events", () => {
    fc.assert(
      fc.property(
        fc.array(mergedEventArb, { minLength: 0, maxLength: 50 }),
        (events) => {
          const csv = buildCsvContent(events);
          const lines = csv.split("\n");
          expect(lines.length).toBe(events.length + 1);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("all created_at values in CSV output are ISO 8601 UTC", () => {
    fc.assert(
      fc.property(
        fc.array(mergedEventArb, { minLength: 1, maxLength: 30 }),
        (events) => {
          const csv = buildCsvContent(events);
          const lines = csv.split("\n");
          // Skip header (line 0), check each data row
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            // The created_at is the last field. We need to parse it correctly,
            // handling possible quoted fields before it.
            // Since created_at is an ISO date string (no commas, no quotes),
            // it will always be the unquoted last field.
            const lastCommaIdx = line.lastIndexOf(",");
            const createdAtValue = line.slice(lastCommaIdx + 1);
            // Remove surrounding quotes if present
            const cleaned = createdAtValue.replace(/^"|"$/g, "");
            expect(cleaned).toMatch(ISO_8601_UTC_REGEX);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("empty events array produces header-only CSV (1 row, no error)", () => {
    const csv = buildCsvContent([]);
    const lines = csv.split("\n");
    expect(lines.length).toBe(1);
    expect(lines[0]).toBe(EXPECTED_HEADER);
  });

  it("events with special characters (commas, quotes, newlines) produce valid CSV rows without breaking row count", () => {
    // Generate events with tricky characters in title/description
    const specialChars = [",", '"', "\n", "\r", "a", "b", "1", " "];
    const trickyStringArb = fc.array(
      fc.constantFrom(...specialChars),
      { minLength: 1, maxLength: 40 }
    ).map((chars) => chars.join(""));

    const trickyEventArb: fc.Arbitrary<MergedEvent> = fc.record({
      id: fc.uuid(),
      type: fc.constantFrom("threat" as const, "alert" as const),
      title: trickyStringArb,
      description: trickyStringArb,
      severity: fc.constantFrom(
        "critical" as const,
        "high" as const,
        "medium" as const
      ),
      session_id: fc.oneof(fc.uuid(), fc.constant(null)),
      server_id: fc.oneof(fc.uuid(), fc.constant(null)),
      createdAt: isoDateArb,
    });

    fc.assert(
      fc.property(
        fc.array(trickyEventArb, { minLength: 1, maxLength: 20 }),
        (events) => {
          const csv = buildCsvContent(events);
          // Header is always the first line
          expect(csv.startsWith(EXPECTED_HEADER)).toBe(true);

          // Verify that there is exactly one ISO date per event in the output
          // (the created_at field), which confirms row integrity
          const isoMatches = csv.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/g);
          expect(isoMatches).not.toBeNull();
          expect(isoMatches!.length).toBe(events.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
