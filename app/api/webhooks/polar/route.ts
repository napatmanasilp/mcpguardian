import { NextRequest, NextResponse } from "next/server";
import {
  validateEvent,
  WebhookVerificationError,
} from "@polar-sh/sdk/webhooks";

import { createServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/webhooks/polar
 *
 * Handles incoming Polar.sh webhook events. This is the ONLY place
 * that updates organizations.plan_id and subscription_status.
 *
 * Supported events (from Polar SDK):
 *   subscription.created    — New subscription activated
 *   subscription.updated    — Plan change, renewal, or status change
 *   subscription.canceled   — Subscription canceled (still active until period end)
 *   subscription.revoked    — Immediate cancellation (fraud, chargeback)
 *   subscription.active     — Moved from trialing → active
 *   subscription.past_due   — Payment failed, in grace period
 *   order.created           — One-time purchase completed
 *   order.refunded          — Purchase refunded
 */
export const POST = async (request: NextRequest) => {
  try {
    const body = await request.text();
    const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("POLAR_WEBHOOK_SECRET is not configured");
      return NextResponse.json(
        { error: "Webhook not configured" },
        { status: 500 },
      );
    }

    // Convert Next.js Headers to Record<string, string> for Polar SDK
    const rawHeaders = request.headers;
    const headers: Record<string, string> = {};
    rawHeaders.forEach((value, key) => {
      headers[key] = value;
    });

    // Validate webhook signature using Polar SDK
    let event: Record<string, unknown>;
    try {
      event = validateEvent(body, headers, webhookSecret) as Record<string, unknown>;
    } catch (error) {
      if (error instanceof WebhookVerificationError) {
        return NextResponse.json(
          { error: "Invalid webhook signature" },
          { status: 403 },
        );
      }
      throw error;
    }

    const eventType = (event.type as string) || "";
    const eventData = (event.data as Record<string, unknown>) || {};
    const metadata = (eventData.metadata as Record<string, string>) || {};
    const organizationId = metadata.organizationId;

    // ── Type-safe extraction helpers ──────────────────────────────
    const getStr = (obj: Record<string, unknown> | undefined, key: string): string | undefined =>
      obj && typeof obj[key] === "string" ? (obj[key] as string) : undefined;

    const getNum = (obj: Record<string, unknown> | undefined, key: string): number | undefined =>
      obj && typeof obj[key] === "number" ? (obj[key] as number) : undefined;

    const getPrice = (obj: Record<string, unknown> | undefined): { id?: string } | undefined =>
      obj && typeof obj.price === "object" && obj.price !== null
        ? (obj.price as Record<string, unknown>)
        : undefined;

    const supabase = createServiceClient();

    // ── Helpers ──────────────────────────────────────────────────
    async function resolveOrg(): Promise<string | null> {
      if (organizationId) return organizationId;
      const customer = eventData.customer as Record<string, unknown> | undefined;
      const customerId = getStr(customer, "id");
      if (customerId) {
        const { data: org } = await supabase
          .from("organizations")
          .select("id")
          .eq("polar_customer_id", customerId)
          .single();
        return org?.id ?? null;
      }
      return null;
    }

    async function resolvePlanFromPrice(priceId: string): Promise<string | null> {
      const { data: plan } = await supabase
        .from("plans")
        .select("id")
        .or(
          `polar_monthly_price_id.eq.${priceId},polar_annual_price_id.eq.${priceId}`,
        )
        .single();
      return plan?.id ?? null;
    }

    async function resolveSubscriptionId(): Promise<string | undefined> {
      const subId = getStr(eventData, "id");
      if (subId) return subId;
      // Some events nest the subscription ID deeper
      const sub = eventData.subscription as Record<string, unknown> | undefined;
      return getStr(sub, "id");
    }

    // ── Event Handlers ───────────────────────────────────────────
    switch (eventType) {
      case "subscription.created":
      case "subscription.active": {
        const price = getPrice(eventData);
        const priceId = price ? getStr(price, "id") : undefined;
        if (!priceId) {
          console.warn(`Polar webhook: no price ID in ${eventType}`);
          return NextResponse.json({ received: true }, { status: 200 });
        }

        const resolvedOrgId = await resolveOrg();
        if (!resolvedOrgId) {
          console.warn(`Polar webhook: could not resolve org for ${eventType}`);
          return NextResponse.json({ received: true }, { status: 200 });
        }

        const planId = await resolvePlanFromPrice(priceId);
        if (!planId) {
          console.warn(`Polar webhook: unknown price ID ${priceId} for ${eventType}`);
          return NextResponse.json({ received: true }, { status: 200 });
        }

        const customerData = eventData.customer as Record<string, unknown> | undefined;
        const customerId = getStr(customerData, "id");
        const subscriptionId = await resolveSubscriptionId();
        const periodStart = getStr(eventData, "current_period_start");
        const periodEnd = getStr(eventData, "current_period_end");

        const updateData: Record<string, unknown> = {
          plan_id: planId,
          subscription_status: "active",
        };
        if (periodStart) updateData.current_period_start = periodStart;
        if (periodEnd) updateData.current_period_end = periodEnd;
        if (customerId) updateData.polar_customer_id = customerId;
        if (subscriptionId) updateData.polar_subscription_id = subscriptionId;
        if (periodStart) {
          updateData.scans_used_this_period = 0;
          updateData.tool_calls_used_this_period = 0;
        }

        const { error: updateError } = await supabase
          .from("organizations")
          .update(updateData)
          .eq("id", resolvedOrgId);

        if (updateError) {
          console.error(`Failed to update organization on ${eventType}:`, updateError);
          return NextResponse.json({ error: "Database update failed" }, { status: 500 });
        }

        console.log(`Polar webhook: activated plan ${planId} for org ${resolvedOrgId}`);
        return NextResponse.json({ received: true }, { status: 200 });
      }

      case "subscription.updated": {
        const price = getPrice(eventData);
        const updatedPriceId = price ? getStr(price, "id") : undefined;
        if (!updatedPriceId) {
          return NextResponse.json({ received: true }, { status: 200 });
        }

        const resolvedOrgId2 = await resolveOrg();
        if (!resolvedOrgId2) {
          return NextResponse.json({ received: true }, { status: 200 });
        }

        const updatedPlanId = await resolvePlanFromPrice(updatedPriceId);
        if (!updatedPlanId) {
          return NextResponse.json({ received: true }, { status: 200 });
        }

        const updateData2: Record<string, unknown> = {
          plan_id: updatedPlanId,
          subscription_status: getStr(eventData, "status") || "active",
        };
        const pStart = getStr(eventData, "current_period_start");
        const pEnd = getStr(eventData, "current_period_end");
        if (pStart) updateData2.current_period_start = pStart;
        if (pEnd) updateData2.current_period_end = pEnd;

        await supabase
          .from("organizations")
          .update(updateData2)
          .eq("id", resolvedOrgId2);

        console.log(`Polar webhook: updated subscription for org ${resolvedOrgId2} to plan ${updatedPlanId}`);
        return NextResponse.json({ received: true }, { status: 200 });
      }

      case "subscription.canceled": {
        const canceledOrgId = await resolveOrg();
        if (!canceledOrgId) {
          return NextResponse.json({ received: true }, { status: 200 });
        }
        await supabase
          .from("organizations")
          .update({ subscription_status: "canceled" })
          .eq("id", canceledOrgId);
        console.log(`Polar webhook: canceled subscription for org ${canceledOrgId}`);
        return NextResponse.json({ received: true }, { status: 200 });
      }

      case "subscription.revoked": {
        const revokedOrgId = await resolveOrg();
        if (!revokedOrgId) {
          return NextResponse.json({ received: true }, { status: 200 });
        }
        await supabase
          .from("organizations")
          .update({
            plan_id: "free",
            subscription_status: "canceled",
            scans_used_this_period: 0,
            tool_calls_used_this_period: 0,
          })
          .eq("id", revokedOrgId);
        console.log(`Polar webhook: revoked subscription for org ${revokedOrgId}`);
        return NextResponse.json({ received: true }, { status: 200 });
      }

      case "subscription.past_due": {
        const pastDueOrgId = await resolveOrg();
        if (!pastDueOrgId) {
          return NextResponse.json({ received: true }, { status: 200 });
        }
        await supabase
          .from("organizations")
          .update({ subscription_status: "past_due" })
          .eq("id", pastDueOrgId);
        console.log(`Polar webhook: past_due subscription for org ${pastDueOrgId}`);
        return NextResponse.json({ received: true }, { status: 200 });
      }

      case "order.created": {
        const orderOrgId = await resolveOrg();
        if (!orderOrgId) {
          return NextResponse.json({ received: true }, { status: 200 });
        }
        const orderId = getStr(eventData, "id");
        const amount = getNum(eventData, "amount") || 0;
        const product = eventData.product as Record<string, unknown> | undefined;
        const productName = getStr(product, "name") || "unknown";

        const { error: insertError } = await supabase
          .from("addon_purchases")
          .insert({
            organization_id: orderOrgId,
            addon_type: "extra_scan_pack_100",
            polar_order_id: orderId || `order_${Date.now()}`,
            unit_price_cents: Math.round(amount),
            quantity: 1,
            status: "active",
          });

        if (insertError) {
          console.error(`Failed to record addon purchase:`, insertError);
          return NextResponse.json({ error: "Failed to record purchase" }, { status: 500 });
        }
        console.log(`Polar webhook: recorded order ${orderId} (${productName}) for org ${orderOrgId}`);
        return NextResponse.json({ received: true }, { status: 200 });
      }

      case "order.refunded": {
        const refundedOrderId = getStr(eventData, "id");
        if (!refundedOrderId) {
          return NextResponse.json({ received: true }, { status: 200 });
        }
        await supabase
          .from("addon_purchases")
          .update({ status: "refunded" })
          .eq("polar_order_id", refundedOrderId);
        console.log(`Polar webhook: refunded order ${refundedOrderId}`);
        return NextResponse.json({ received: true }, { status: 200 });
      }

      default:
        console.log(`Polar webhook: unhandled event type ${eventType}`);
        return NextResponse.json({ received: true }, { status: 200 });
    }
  } catch (error) {
    console.error("Polar webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
};
