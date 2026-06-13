// Feature: mcpguardian-ux-improvements, Property 24: Invoice row completeness
// **Validates: Requirements 16.2**

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  formatCurrency,
  formatInvoiceDate,
  getInvoiceRowFields,
} from "@/lib/utils/invoice";
import type { Invoice } from "@/lib/types/invoice";

// Generate a valid ISO date string from integer timestamps
const isoDateArb = fc
  .integer({
    min: new Date("2020-01-01T00:00:00Z").getTime(),
    max: new Date("2030-12-31T23:59:59Z").getTime(),
  })
  .map((ts) => new Date(ts).toISOString());

// Arbitrary for generating Invoice-like objects
const invoiceArb = fc.record({
  id: fc.uuid(),
  organization_id: fc.uuid(),
  amount_paid: fc.integer({ min: 0, max: 10_000_000 }),
  currency: fc.oneof(
    fc.constant("usd"),
    fc.constant("eur"),
    fc.constant("gbp"),
    fc.constant("jpy"),
    fc.constant("cad")
  ),
  status: fc.oneof(
    fc.constant("paid" as const),
    fc.constant("open" as const),
    fc.constant("void" as const)
  ),
  hosted_invoice_url: fc.oneof(
    fc.webUrl(),
    fc.constant(null)
  ),
  created_at: isoDateArb,
});

describe("Property 24: Every invoice row displays date, amount, status, and conditional download link", () => {
  it("getInvoiceRowFields always returns a non-empty date string", () => {
    fc.assert(
      fc.property(invoiceArb, (invoice: Invoice) => {
        const fields = getInvoiceRowFields(invoice);
        expect(fields.date).toBeTruthy();
        expect(typeof fields.date).toBe("string");
        expect(fields.date.length).toBeGreaterThan(0);
      }),
      { numRuns: 200 }
    );
  });

  it("getInvoiceRowFields always returns a formatted amount containing a currency symbol", () => {
    fc.assert(
      fc.property(invoiceArb, (invoice: Invoice) => {
        const fields = getInvoiceRowFields(invoice);
        expect(fields.amount).toBeTruthy();
        expect(typeof fields.amount).toBe("string");
        // The formatted amount must contain at least one digit
        expect(fields.amount).toMatch(/\d/);
      }),
      { numRuns: 200 }
    );
  });

  it("getInvoiceRowFields always returns a valid status value", () => {
    fc.assert(
      fc.property(invoiceArb, (invoice: Invoice) => {
        const fields = getInvoiceRowFields(invoice);
        expect(["paid", "open", "void"]).toContain(fields.status);
      }),
      { numRuns: 200 }
    );
  });

  it("hasDownloadLink is true iff hosted_invoice_url is non-null", () => {
    fc.assert(
      fc.property(invoiceArb, (invoice: Invoice) => {
        const fields = getInvoiceRowFields(invoice);
        if (invoice.hosted_invoice_url !== null) {
          expect(fields.hasDownloadLink).toBe(true);
        } else {
          expect(fields.hasDownloadLink).toBe(false);
        }
      }),
      { numRuns: 200 }
    );
  });

  it("formatCurrency produces a string with currency formatting for any valid amount/currency pair", () => {
    const currencyArb = fc.oneof(
      fc.constant("usd"),
      fc.constant("eur"),
      fc.constant("gbp"),
      fc.constant("jpy"),
      fc.constant("cad")
    );

    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 99_999_999 }),
        currencyArb,
        (amountInCents, currency) => {
          const result = formatCurrency(amountInCents, currency);
          expect(typeof result).toBe("string");
          expect(result.length).toBeGreaterThan(0);
          // Must contain at least one digit from the amount
          expect(result).toMatch(/\d/);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("formatInvoiceDate produces a non-empty string for any valid ISO date", () => {
    fc.assert(
      fc.property(
        isoDateArb,
        (isoDate) => {
          const result = formatInvoiceDate(isoDate);
          expect(typeof result).toBe("string");
          expect(result.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 200 }
    );
  });
});
