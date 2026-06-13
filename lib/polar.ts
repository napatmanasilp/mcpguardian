import { Polar } from "@polar-sh/sdk";

/**
 * Polar.sh SDK client.
 *
 * Configure via environment variables:
 *   POLAR_ACCESS_TOKEN  — Polar API token (required)
 *   POLAR_ENV           — 'sandbox' | 'production' (default: 'production')
 *
 * Polar.sh replaces Stripe for all billing operations:
 *   Stripe Customer         → Polar Customer
 *   Stripe Subscription     → Polar Subscription
 *   Stripe Price ID         → Polar Price ID (stored in plans.polar_monthly_price_id etc.)
 *   Stripe Payment Intent   → Polar Order (one-time purchases)
 *   Stripe Checkout Session → Polar Checkout Session
 *   Stripe Customer Portal  → Polar Customer Portal (customerSessions)
 *   Stripe Webhook          → Polar Webhook (validateEvent)
 *   Stripe Invoice          → Polar Order or Subscription Invoice
 *   Stripe Metered Billing  → Polar Meters
 */

// Lazy-initialize the Polar client to avoid throwing at module load time
// when POLAR_ACCESS_TOKEN is not set (e.g. during build or on routes that
// don't use billing).
let _polar: Polar | null = null;

export function getPolarClient(): Polar {
  if (!process.env.POLAR_ACCESS_TOKEN) {
    throw new Error(
      "POLAR_ACCESS_TOKEN environment variable is required for Polar.sh billing.",
    );
  }
  if (!_polar) {
    _polar = new Polar({
      accessToken: process.env.POLAR_ACCESS_TOKEN,
      server: process.env.POLAR_ENV === "sandbox" ? "sandbox" : "production",
    });
  }
  return _polar;
}

// Keep the named `polar` export for any existing imports, but now it's
// a getter-based proxy so it doesn't throw at import time.
export const polar = new Proxy({} as Polar, {
  get(_target, prop) {
    return (getPolarClient() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
