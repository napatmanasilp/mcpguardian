import { SupabaseClient } from "@supabase/supabase-js";
import { TierId, BillingCycle, VALID_TIER_IDS } from "./tier-catalog";
import { createPolarCheckout } from "./polar-checkout";

export interface CheckoutRequest {
  orgId: string;
  targetTierId: TierId;
  billingCycle: BillingCycle;
  userEmail: string;
  userId: string;
  successUrl: string;
}

export interface CheckoutResult {
  checkoutUrl?: string;
  contactSales?: boolean;
  error?: string;
}

/**
 * Validates that the given value is a valid BillingCycle ("monthly" or "annual").
 */
export function validateBillingCycle(value: unknown): value is BillingCycle {
  return value === "monthly" || value === "annual";
}

/**
 * Returns true if moving from currentTier to targetTier is an upgrade
 * (i.e. targetTier is higher in the tier order).
 */
export function isUpgrade(currentTier: TierId, targetTier: TierId): boolean {
  const order = VALID_TIER_IDS;
  return order.indexOf(targetTier) > order.indexOf(currentTier);
}

/**
 * Returns true if moving from currentTier to targetTier is a downgrade
 * (i.e. targetTier is lower in the tier order).
 */
export function isDowngrade(currentTier: TierId, targetTier: TierId): boolean {
  const order = VALID_TIER_IDS;
  return order.indexOf(targetTier) < order.indexOf(currentTier);
}

/**
 * Creates a checkout session for upgrading to a paid tier.
 * Enterprise tier routes to contact-sales instead of self-serve checkout.
 */
export async function createCheckoutSession(
  request: CheckoutRequest,
  supabase: SupabaseClient
): Promise<CheckoutResult> {
  if (request.targetTierId === "enterprise") {
    return { contactSales: true };
  }

  if (!validateBillingCycle(request.billingCycle)) {
    return { error: 'Invalid billing cycle. Must be "monthly" or "annual".' };
  }

  // Look up Polar price ID from plans table
  const { data: plan } = await supabase
    .from("plans")
    .select("polar_monthly_price_id, polar_annual_price_id")
    .eq("id", request.targetTierId)
    .single();

  const priceId =
    request.billingCycle === "annual"
      ? plan?.polar_annual_price_id
      : plan?.polar_monthly_price_id;

  if (!priceId) {
    return {
      error: `No Polar price configured for ${request.targetTierId} (${request.billingCycle}).`,
    };
  }

  try {
    const url = await createPolarCheckout({
      priceId,
      customerEmail: request.userEmail,
      organizationId: request.orgId,
      successUrl: request.successUrl,
      metadata: { user_id: request.userId },
    });
    return { checkoutUrl: url };
  } catch {
    return { error: "Checkout unavailable. Please try again." };
  }
}

/**
 * Schedules a pending downgrade by setting the target tier and effective date
 * on the organization record. The downgrade takes effect at the start of the
 * next billing period.
 */
export async function schedulePendingDowngrade(
  supabase: SupabaseClient,
  orgId: string,
  targetTierId: TierId,
  effectiveAt: string
): Promise<void> {
  await supabase
    .from("organizations")
    .update({
      pending_plan_id: targetTierId,
      pending_plan_effective_at: effectiveAt,
    })
    .eq("id", orgId);
}

/**
 * Applies a pending downgrade if the effective date has passed.
 * Sets the organization's plan_id to the pending tier and clears
 * the pending fields.
 */
export async function applyPendingDowngrade(
  supabase: SupabaseClient,
  orgId: string
): Promise<void> {
  const { data: org } = await supabase
    .from("organizations")
    .select("pending_plan_id, pending_plan_effective_at")
    .eq("id", orgId)
    .single();

  if (!org?.pending_plan_id || !org?.pending_plan_effective_at) return;

  if (new Date(org.pending_plan_effective_at) > new Date()) return;

  await supabase
    .from("organizations")
    .update({
      plan_id: org.pending_plan_id,
      pending_plan_id: null,
      pending_plan_effective_at: null,
    })
    .eq("id", orgId);
}
