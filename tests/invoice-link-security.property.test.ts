// Feature: mcpguardian-ux-improvements, Property 25: Invoice download link security attributes
// **Validates: Requirements 16.4**

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { getInvoiceLinkAttributes } from "@/lib/utils/invoice";

describe("Property 25: Invoice download link has target=\"_blank\" and rel=\"noopener noreferrer\"", () => {
  it("for any non-null hosted_invoice_url, link attributes include target=_blank and rel=noopener noreferrer", () => {
    fc.assert(
      fc.property(fc.webUrl(), (url: string) => {
        const attrs = getInvoiceLinkAttributes(url);
        expect(attrs).not.toBeNull();
        expect(attrs!.target).toBe("_blank");
        expect(attrs!.rel).toBe("noopener noreferrer");
      }),
      { numRuns: 200 }
    );
  });

  it("for null hosted_invoice_url, no link attributes are returned", () => {
    const attrs = getInvoiceLinkAttributes(null);
    expect(attrs).toBeNull();
  });

  it("for any arbitrary non-null string URL, link attributes are always present with correct values", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (url: string) => {
        const attrs = getInvoiceLinkAttributes(url);
        expect(attrs).not.toBeNull();
        expect(attrs!.target).toBe("_blank");
        expect(attrs!.rel).toBe("noopener noreferrer");
      }),
      { numRuns: 200 }
    );
  });
});
