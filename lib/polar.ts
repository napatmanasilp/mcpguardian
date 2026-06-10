import { Polar } from "@polar-sh/sdk";

if (!process.env.POLAR_ACCESS_TOKEN) {
  throw new Error(
    "POLAR_ACCESS_TOKEN environment variable is required for Polar.sh billing.",
  );
}

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
export const polar = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
  server:
    process.env.POLAR_ENV === "sandbox" ? "sandbox" : "production",
});
