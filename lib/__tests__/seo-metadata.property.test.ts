// Feature: ui-launch-readiness, Property 4: SEO metadata title format
// **Validates: Requirements 18.1, 18.2**

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { formatPageTitle } from "@/lib/seo";

describe("Property 4: SEO metadata title format", () => {
  const SUFFIX = " — MCPGuardian";

  it("title never exceeds 60 characters for any page name", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 80 }), (pageName) => {
        const title = formatPageTitle(pageName);
        expect(title.length).toBeLessThanOrEqual(60);
      }),
      { numRuns: 200 }
    );
  });

  it("title matches '{Page Name} — MCPGuardian' when total length ≤ 60", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 60 - SUFFIX.length }),
        (pageName) => {
          const title = formatPageTitle(pageName);
          expect(title).toBe(`${pageName}${SUFFIX}`);
          expect(title).toContain(SUFFIX);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("title is truncated with ellipsis when full title would exceed 60 chars", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 60 - SUFFIX.length + 1, maxLength: 100 }),
        (pageName) => {
          const fullTitle = `${pageName}${SUFFIX}`;
          // Only test when the full title actually exceeds 60
          if (fullTitle.length > 60) {
            const title = formatPageTitle(pageName);
            expect(title.length).toBeLessThanOrEqual(60);
            expect(title.endsWith("…")).toBe(true);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("non-truncated title always ends with '— MCPGuardian'", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 60 - SUFFIX.length }),
        (pageName) => {
          const title = formatPageTitle(pageName);
          expect(title.endsWith("— MCPGuardian")).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("empty page name still produces a valid title with suffix", () => {
    const title = formatPageTitle("");
    expect(title).toBe(SUFFIX);
    expect(title.length).toBeLessThanOrEqual(60);
  });
});
