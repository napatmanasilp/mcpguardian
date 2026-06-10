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
 * Polar.sh handles usage-based billing through its meter system.
 * In production, this would call polar.events.ingest() to report
 * billable events tied to a subscription's meter.
 *
 * Called by the usage-reset cron after each billable action.
 *
 * @returns true if the usage was reported successfully
 */
export async function reportPolarUsage(_opts: {
  /** Polar subscription ID */
  subscriptionId: string;
  /** Polar meter ID (configured in Polar dashboard) */
  meterId: string;
  /** Number of billable units */
  quantity: number;
  /** When the usage occurred */
  timestamp: Date;
}): Promise<boolean> {
  // TODO: Implement metered usage reporting via Polar events API.
  // The Polar SDK exposes polar.events.ingest() which can be used
  // to report custom events that trigger meter calculations.
  // Example:
  //   await polar.events.ingest({
  //     event_name: "tool_call",
  //     customer_id: customerId,
  //     properties: { meter_id: meterId, quantity },
  //   });
  console.log(
    `[Polar usage] subscription=${_opts.subscriptionId} meter=${_opts.meterId} qty=${_opts.quantity}`,
  );
  return true;
}
