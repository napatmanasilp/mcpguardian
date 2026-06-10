import { NextRequest, NextResponse } from "next/server";

import { createPolarCheckout } from "@/lib/polar-checkout";
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

  let body: { plan?: string; billing?: "monthly" | "annual" };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const validPlans = ["developer", "team", "startup", "enterprise"];
  if (!body.plan || !validPlans.includes(body.plan)) {
    return Response.json(
      { error: "Invalid plan. Choose: developer, team, startup, or enterprise." },
      { status: 400 },
    );
  }

  if (body.plan === "enterprise") {
    // Enterprise has no self-serve checkout — redirect to contact form
    return Response.json({
      url: "/billing/upgrade?plan=enterprise",
      plan: "enterprise",
    });
  }

  const billing = body.billing ?? "annual";

  // Look up the Polar price ID from the plans table
  const { data: plan } = await supabase
    .from("plans")
    .select("polar_monthly_price_id, polar_annual_price_id")
    .eq("id", body.plan)
    .single<{ polar_monthly_price_id: string | null; polar_annual_price_id: string | null }>();

  const priceId =
    billing === "annual"
      ? plan?.polar_annual_price_id
      : plan?.polar_monthly_price_id;

  if (!priceId) {
    return Response.json(
      {
        error: `No Polar price configured for ${body.plan} (${billing}). Contact support.`,
      },
      { status: 500 },
    );
  }

  try {
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

    const successUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/billing?checkout_success=true`;

    const checkoutUrl = await createPolarCheckout({
      priceId,
      customerEmail: user.email!,
      organizationId,
      successUrl,
      metadata: {
        user_id: user.id,
      },
    });

    return Response.json({ url: checkoutUrl, plan: body.plan, billing });
  } catch (error) {
    console.error("Polar checkout creation failed:", error);
    return Response.json(
      { error: "Checkout unavailable. Please try again." },
      { status: 500 },
    );
  }
}
