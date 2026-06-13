// Feature: ui-launch-readiness, Property 5: Breadcrumb trail structure
// **Validates: Requirements 12.1, 12.2, 12.4**

import { describe, it, expect, vi, afterEach } from "vitest";
import * as fc from "fast-check";
import { render, cleanup } from "@testing-library/react";
import React from "react";

// Mock next/link to render as a plain <a> tag
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock lucide-react ChevronRight icon
vi.mock("lucide-react", () => ({
  ChevronRight: (props: Record<string, unknown>) => (
    <svg data-testid="chevron-right" {...props} />
  ),
}));

import { BreadcrumbNav, BreadcrumbSegment } from "@/components/dashboard/breadcrumb-nav";

/**
 * Arbitrary for generating valid href paths (e.g., /servers, /settings/billing, /servers/abc123).
 */
const pathSegmentArbitrary = fc
  .array(fc.constantFrom(...("abcdefghijklmnopqrstuvwxyz0123456789-_".split(""))), {
    minLength: 1,
    maxLength: 15,
  })
  .map((chars) => chars.join(""));

const hrefArbitrary = fc
  .array(pathSegmentArbitrary, { minLength: 1, maxLength: 3 })
  .map((parts) => "/" + parts.join("/"));

/**
 * Arbitrary for generating a label string between 1 and 50 characters.
 */
const labelArbitrary = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);

/**
 * Arbitrary for generating a BreadcrumbSegment with a label and an href.
 * Ancestor segments always have an href to validate the clickable link property.
 */
const ancestorSegmentArbitrary: fc.Arbitrary<BreadcrumbSegment> = fc.record({
  label: labelArbitrary,
  href: hrefArbitrary,
});

/**
 * Arbitrary for generating the last (current page) segment — no href.
 */
const lastSegmentArbitrary: fc.Arbitrary<BreadcrumbSegment> = fc.record({
  label: labelArbitrary,
}).map((s) => ({ label: s.label }));

/**
 * Arbitrary for generating a valid breadcrumb segments array for nested routes.
 * At least 2 segments: 1+ ancestors (with hrefs) + 1 last segment (no href).
 */
const nestedBreadcrumbArbitrary: fc.Arbitrary<BreadcrumbSegment[]> = fc
  .tuple(
    fc.array(ancestorSegmentArbitrary, { minLength: 1, maxLength: 5 }),
    lastSegmentArbitrary
  )
  .map(([ancestors, last]) => [...ancestors, last]);

describe("Property 5: Breadcrumb trail structure", () => {
  afterEach(() => {
    cleanup();
  });

  it("for any nested route (segments >= 2), renders at least 2 segments, last is non-clickable, ancestors have valid hrefs", () => {
    fc.assert(
      fc.property(nestedBreadcrumbArbitrary, (segments) => {
        cleanup();

        const { container } = render(<BreadcrumbNav segments={segments} />);

        // The nav element should exist with aria-label="Breadcrumb"
        const nav = container.querySelector('nav[aria-label="Breadcrumb"]');
        expect(nav).not.toBeNull();

        // The ordered list should contain all segment <li> elements
        const listItems = nav!.querySelectorAll("ol > li");
        expect(listItems.length).toBeGreaterThanOrEqual(2);
        expect(listItems.length).toBe(segments.length);

        // Last segment: should be non-clickable (no <a> tag), has aria-current="page"
        const lastLi = listItems[listItems.length - 1];
        const lastLink = lastLi.querySelector("a");
        expect(lastLink).toBeNull();

        const lastSpan = lastLi.querySelector('[aria-current="page"]');
        expect(lastSpan).not.toBeNull();

        // All ancestor segments (not last) that have an href render as clickable links
        for (let i = 0; i < segments.length - 1; i++) {
          const li = listItems[i];
          const segment = segments[i];

          if (segment.href) {
            const link = li.querySelector("a");
            expect(link).not.toBeNull();
            expect(link!.getAttribute("href")).toBe(segment.href);
            // The href should be a valid path (starts with /)
            expect(link!.getAttribute("href")).toMatch(/^\//);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it("does not render breadcrumbs for single-segment routes (top-level pages)", () => {
    fc.assert(
      fc.property(labelArbitrary, (label) => {
        cleanup();

        const segments: BreadcrumbSegment[] = [{ label }];
        const { container } = render(<BreadcrumbNav segments={segments} />);

        // Should not render anything for single-segment routes
        const nav = container.querySelector('nav[aria-label="Breadcrumb"]');
        expect(nav).toBeNull();
      }),
      { numRuns: 100 }
    );
  });
});
