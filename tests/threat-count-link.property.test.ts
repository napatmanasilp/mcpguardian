// Feature: mcpguardian-ux-improvements, Property 10: Threat count renders as a link for any positive count
// **Validates: Requirements 9.8, 9.9**

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { resolveThreatCountElement } from "@/lib/utils/dashboard";

describe("Property 10: Threat count renders as a link for any positive count", () => {
  it("for any positive integer threatCount, returns a link with href=/alerts?severity=critical", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10000 }), (threatCount) => {
        const result = resolveThreatCountElement(threatCount);
        expect(result.tag).toBe("link");
        if (result.tag === "link") {
          expect(result.href).toBe("/alerts?severity=critical");
        }
      }),
      { numRuns: 200 }
    );
  });

  it("for threatCount === 0, returns a non-interactive span", () => {
    const result = resolveThreatCountElement(0);
    expect(result.tag).toBe("span");
  });

  it("for any integer, result is always either a link (positive) or span (zero)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10000 }), (threatCount) => {
        const result = resolveThreatCountElement(threatCount);
        if (threatCount > 0) {
          expect(result).toEqual({ tag: "link", href: "/alerts?severity=critical" });
        } else {
          expect(result).toEqual({ tag: "span" });
        }
      }),
      { numRuns: 200 }
    );
  });

  it("the link href is always exactly /alerts?severity=critical for any positive count", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 99999 }), (threatCount) => {
        const result = resolveThreatCountElement(threatCount);
        expect(result).toHaveProperty("tag", "link");
        expect(result).toHaveProperty("href", "/alerts?severity=critical");
      }),
      { numRuns: 100 }
    );
  });
});
