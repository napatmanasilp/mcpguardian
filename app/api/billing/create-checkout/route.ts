import { NextRequest } from "next/server";

import {
  createCheckoutSession,
  validateBillingCycle,
  CheckoutRequest,
} from "@/lib/subscription-manager";
import { TierId } from "@/lib/tier-catalog";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/billing/create-checkout
 *
 * Creates a Polar.sh checkout URL for a subscription plan.
 * The user is redirected to Polar's hosted checkout page.
 *
 * Body:
 *   plan: 'developer' | 'team' | 'startup' | 'enterprise'
 *   billing: 'monthly' | 'annual'
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { plan?: string; billing?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const validPlans: TierId[] = ["developer", "team", "startup", "enterprise"];
  if (!body.plan || !validPlans.includes(body.plan as TierId)) {
    return Response.json(
      { error: "Invalid plan. Choose: developer, team, startup, or enterprise." },
      { status: 400 },
    );
  }

  const billing = body.billing ?? "annual";

  // Validate billing cycle using subscription manager
  if (!validateBillingCycle(billing)) {
    return Response.json(
      { error: 'Invalid billing cycle. Must be "monthly" or "annual".' },
      { status: 400 },
    );
  }

  // Resolve the user's organization ID
  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("role", "owner")
    .single();

  const organizationId = membership?.organization_id;
  if (!organizationId) {
    return Response.json(
      { error: "No organization found for this user." },
      { status: 404 },
    );
  }

  const successUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/settings/billing?checkout_success=true`;

  const checkoutRequest: CheckoutRequest = {
    orgId: organizationId,
    targetTierId: body.plan as TierId,
    billingCycle: billing,
    userEmail: user.email!,
    userId: user.id,
    successUrl,
  };

  const result = await createCheckoutSession(checkoutRequest, supabase);

  // Enterprise tier → redirect to contact page
  if (result.contactSales) {
    return Response.json({
      url: "/contact",
      plan: body.plan,
    });
  }

  // Error from checkout session creation
  if (result.error) {
    return Response.json(
      { error: result.error },
      { status: 500 },
    );
  }

  // Success → return checkout URL
  return Response.json({
    url: result.checkoutUrl,
    plan: body.plan,
    billing,
  });
}
