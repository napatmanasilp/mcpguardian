// Feature: mcpguardian-ux-improvements, Property 19: Date range filter inclusivity
// **Validates: Requirements 14.2, 14.3, 14.4**

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { isSessionInDateRange, applyDateFilter } from "@/lib/utils/sessions";

/**
 * Helper: pads a number to 2 digits.
 */
function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/**
 * Arbitrary that generates a YYYY-MM-DD date string directly from integers.
 */
const dateStringArb = fc
  .record({
    year: fc.integer({ min: 2020, max: 2030 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }), // use 28 to avoid invalid dates
  })
  .map(({ year, month, day }) => `${year}-${pad2(month)}-${pad2(day)}`);

/**
 * Arbitrary that generates a valid ISO 8601 timestamp string.
 */
const isoTimestampArb = fc
  .record({
    year: fc.integer({ min: 2020, max: 2030 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }),
    hour: fc.integer({ min: 0, max: 23 }),
    minute: fc.integer({ min: 0, max: 59 }),
    second: fc.integer({ min: 0, max: 59 }),
    millis: fc.integer({ min: 0, max: 999 }),
  })
  .map(
    ({ year, month, day, hour, minute, second, millis }) =>
      `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:${pad2(second)}.${millis.toString().padStart(3, "0")}Z`
  );

/**
 * Arbitrary that generates a session object with a started_at ISO string.
 */
const sessionArb = fc.record({
  id: fc.uuid(),
  started_at: isoTimestampArb,
});

describe("Property 19: Date range filter is inclusive of both boundary dates", () => {
  it("includes sessions exactly at from 00:00:00.000Z (lower boundary)", () => {
    fc.assert(
      fc.property(dateStringArb, (fromDate) => {
        // A session starting exactly at from 00:00:00.000Z must be included
        const startedAt = `${fromDate}T00:00:00.000Z`;
        expect(isSessionInDateRange(startedAt, fromDate, null)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it("includes sessions exactly at to 23:59:59.999Z (upper boundary)", () => {
    fc.assert(
      fc.property(dateStringArb, (toDate) => {
        // A session starting exactly at to 23:59:59.999Z must be included
        const startedAt = `${toDate}T23:59:59.999Z`;
        expect(isSessionInDateRange(startedAt, null, toDate)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it("excludes sessions before from 00:00:00.000Z", () => {
    fc.assert(
      fc.property(dateStringArb, (fromDate) => {
        // A timestamp from the previous day at 23:59:59.999Z is before the boundary
        const boundary = new Date(`${fromDate}T00:00:00.000Z`);
        const before = new Date(boundary.getTime() - 1);
        const startedAt = before.toISOString();
        expect(isSessionInDateRange(startedAt, fromDate, null)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it("excludes sessions after to 23:59:59.999Z", () => {
    fc.assert(
      fc.property(dateStringArb, (toDate) => {
        // A timestamp 1ms after the upper boundary is outside the range
        const boundary = new Date(`${toDate}T23:59:59.999Z`);
        const after = new Date(boundary.getTime() + 1);
        const startedAt = after.toISOString();
        expect(isSessionInDateRange(startedAt, null, toDate)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it("when both from and to provided, filtered results only contain sessions within range", () => {
    fc.assert(
      fc.property(
        dateStringArb,
        dateStringArb,
        fc.array(sessionArb, { minLength: 0, maxLength: 50 }),
        (dateA, dateB, sessions) => {
          // Ensure from <= to
          const from = dateA <= dateB ? dateA : dateB;
          const to = dateA <= dateB ? dateB : dateA;

          const filtered = applyDateFilter(sessions, from, to);
          const lowerBound = `${from}T00:00:00.000Z`;
          const upperBound = `${to}T23:59:59.999Z`;

          // All filtered results must be within the range
          for (const s of filtered) {
            expect(s.started_at >= lowerBound).toBe(true);
            expect(s.started_at <= upperBound).toBe(true);
          }

          // All sessions within the range must be in filtered results
          const filteredIds = new Set(filtered.map((s) => s.id));
          for (const s of sessions) {
            if (s.started_at >= lowerBound && s.started_at <= upperBound) {
              expect(filteredIds.has(s.id)).toBe(true);
            }
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("when only from is provided, no lower bound violation in results", () => {
    fc.assert(
      fc.property(
        dateStringArb,
        fc.array(sessionArb, { minLength: 0, maxLength: 50 }),
        (from, sessions) => {
          const filtered = applyDateFilter(sessions, from, null);
          const lowerBound = `${from}T00:00:00.000Z`;

          for (const s of filtered) {
            expect(s.started_at >= lowerBound).toBe(true);
          }

          // All sessions at or after the boundary must be included
          const filteredIds = new Set(filtered.map((s) => s.id));
          for (const s of sessions) {
            if (s.started_at >= lowerBound) {
              expect(filteredIds.has(s.id)).toBe(true);
            }
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("when only to is provided, no upper bound violation in results", () => {
    fc.assert(
      fc.property(
        dateStringArb,
        fc.array(sessionArb, { minLength: 0, maxLength: 50 }),
        (to, sessions) => {
          const filtered = applyDateFilter(sessions, null, to);
          const upperBound = `${to}T23:59:59.999Z`;

          for (const s of filtered) {
            expect(s.started_at <= upperBound).toBe(true);
          }

          // All sessions at or before the boundary must be included
          const filteredIds = new Set(filtered.map((s) => s.id));
          for (const s of sessions) {
            if (s.started_at <= upperBound) {
              expect(filteredIds.has(s.id)).toBe(true);
            }
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("when both from and to are null, all sessions are returned", () => {
    fc.assert(
      fc.property(
        fc.array(sessionArb, { minLength: 0, maxLength: 50 }),
        (sessions) => {
          const filtered = applyDateFilter(sessions, null, null);
          expect(filtered.length).toBe(sessions.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
