import { polar } from "./polar";

/**
 * Creates a Polar.sh checkout URL for a subscription or one-time purchase.
 *
 * The checkout lets the customer select among the given products.
 * Polar handles customer creation, payment collection, and subscription setup.
 *
 * @returns The checkout URL to redirect the user to.
 */
export async function createPolarCheckout({
  priceId,
  customerEmail,
  organizationId,
  successUrl,
  metadata,
}: {
  priceId: string;
  customerEmail: string;
  organizationId: string;
  successUrl: string;
  metadata?: Record<string, string>;
}) {
  // Polar's checkout.create takes a list of product IDs (not price IDs).
  // The priceId here represents a Polar Price ID. In production you'd
  // resolve the product ID from the price, or use products directly.
  // For our use case, we map price → product via the plans table.
  //
  // Note: The SDK uses `products` (array of product IDs) and optionally
  // `prices` to override catalog prices with custom prices.
  const checkout = await polar.checkouts.create({
    products: [priceId],
    customerEmail,
    successUrl,
    metadata: {
      organizationId,
      ...metadata,
    } as Record<string, string | number | boolean>,
  });

  return checkout.url;
}

/**
 * Creates a Polar.sh customer portal session for subscription management.
 * Users can upgrade, downgrade, cancel, and update payment methods.
 *
 * @returns The portal URL to redirect the user to.
 */
export async function createPolarCustomerPortal({
  polarCustomerId,
  returnUrl,
}: {
  polarCustomerId: string;
  returnUrl: string;
}) {
  const session = await polar.customerSessions.create({
    customerId: polarCustomerId,
  });

  return `${session.customerPortalUrl}?return_url=${encodeURIComponent(returnUrl)}`;
}

/**
 * Reports metered usage to Polar.sh for overage billing.
 *
 * Uses Polar's Events API to ingest billable usage events.
 * Events are tied to meters configured in the Polar dashboard,
 * which drive usage-based pricing on subscriptions.
 *
 * Prerequisites in Polar dashboard:
 *   1. Create event names (e.g. "scan_overage", "tool_call_overage")
 *   2. Create meters that aggregate those events
 *   3. Attach meters to products via usage-based pricing
 *
 * Called by the usage-reset cron after each billing period ends,
 * reporting any scan or tool-call overages as billable events.
 *
 * @returns true if the usage was reported successfully, false otherwise
 */
export async function reportPolarUsage(opts: {
  /** Polar customer ID (from organizations.polar_customer_id) */
  subscriptionId: string;
  /** Event name matching a Polar meter (e.g. "scan_overage") */
  meterId: string;
  /** Number of billable units */
  quantity: number;
  /** When the usage occurred */
  timestamp: Date;
}): Promise<boolean> {
  if (opts.quantity <= 0) return true; // Nothing to report

  try {
    // Polar SDK events.ingest: sends a batch of events that trigger
    // meter calculations and usage-based billing.
    // Each event is tied to a customer via their Polar customer ID.
    await polar.events.ingest({
      events: [
        {
          customerId: opts.subscriptionId,
          name: opts.meterId,
          timestamp: opts.timestamp,
          metadata: {
            quantity: opts.quantity,
          },
        },
      ],
    });

    console.log(
      `[Polar usage] Reported: customer=${opts.subscriptionId} event=${opts.meterId} qty=${opts.quantity}`,
    );
    return true;
  } catch (error) {
    // Log but don't throw — overage reporting is best-effort.
    // If the event name doesn't match a meter or the API is unreachable,
    // we still want the cron to continue processing other orgs.
    console.error(
      `[Polar usage] Failed to report: customer=${opts.subscriptionId} event=${opts.meterId} qty=${opts.quantity}`,
      error,
    );
    return false;
  }
}
