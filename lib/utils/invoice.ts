import type { Invoice } from "@/lib/types/invoice";

/**
 * Formats an amount in cents with the appropriate currency symbol.
 */
export function formatCurrency(amountInCents: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amountInCents / 100);
}

/**
 * Formats an invoice date as a human-readable string (e.g., "Jan 1, 2024").
 */
export function formatInvoiceDate(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export interface InvoiceLinkAttributes {
  target: string;
  rel: string;
}

/**
 * Returns the security attributes for an invoice download link.
 * When hosted_invoice_url is non-null, the link must open in a new tab
 * with noopener noreferrer to prevent reverse tabnapping.
 * Returns null when there is no URL (no link should be rendered).
 */
export function getInvoiceLinkAttributes(
  url: string | null
): InvoiceLinkAttributes | null {
  if (url === null) {
    return null;
  }
  return {
    target: "_blank",
    rel: "noopener noreferrer",
  };
}

export interface InvoiceRowFields {
  date: string;
  amount: string;
  status: string;
  hasDownloadLink: boolean;
}

/**
 * Extracts the display fields for an invoice row.
 * Returns all required display data: formatted date, formatted amount with
 * currency symbol, status badge value, and whether a download link should render.
 */
export function getInvoiceRowFields(invoice: Invoice): InvoiceRowFields {
  return {
    date: formatInvoiceDate(invoice.created_at),
    amount: formatCurrency(invoice.amount_paid, invoice.currency),
    status: invoice.status,
    hasDownloadLink: invoice.hosted_invoice_url !== null,
  };
}
