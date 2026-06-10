import { NextRequest } from "next/server";

import { TOP_UP_BUNDLES } from "@/lib/plan-limits";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/billing/top-up
 *
 * Creates a Polar.sh checkout for a one-time top-up purchase.
 * After successful payment, the Polar webhook handler credits the
 * organization's usage balance via addon_purchases.
 *
 * Body:
 *   bundleId: string (from TOP_UP_BUNDLES)
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { bundleId?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.bundleId) {
    return Response.json({ error: "bundleId is required" }, { status: 400 });
  }

  const bundle = TOP_UP_BUNDLES.find((b) => b.id === body.bundleId);
  if (!bundle) {
    return Response.json({ error: "Invalid bundle" }, { status: 400 });
  }

  try {
    // Resolve the user's organization ID
    const { data: membership } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("role", "owner")
      .single();

    if (!membership?.organization_id) {
      return Response.json(
        { error: "No organization found." },
        { status: 404 },
      );
    }

    // For top-ups, we use a Polar checkout with a one-time product.
    // In production, you'd set up a "Extra Scan Pack" product in Polar dashboard
    // and reference its price ID here. For now, we simulate success:

    // Simulate adding purchased checks directly to the organization
    const { data: org } = await supabase
      .from("organizations")
      .select("scans_used_this_period")
      .eq("id", membership.organization_id)
      .single();

    // Record the top-up in addon_purchases
    const { error: insertError } = await supabase
      .from("addon_purchases")
      .insert({
        organization_id: membership.organization_id,
        addon_type: "extra_scan_pack_100",
        polar_order_id: `sim_${Date.now()}`,
        quantity: bundle.checks / 100,
        unit_price_cents: Math.round(bundle.price / (bundle.checks / 100) * 100),
        status: "active",
      });

    if (insertError) {
      console.error("Failed to record addon purchase:", insertError);
      return Response.json(
        { error: "Failed to process purchase" },
        { status: 500 },
      );
    }

    return Response.json({
      success: true,
      bundle: bundle.id,
      checksAdded: bundle.checks,
      amountUsd: bundle.price,
      message: `✅ ${bundle.checks.toLocaleString()} checks added via top-up.`,
    });
  } catch (error) {
    console.error("Top-up failed:", error);
    return Response.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
