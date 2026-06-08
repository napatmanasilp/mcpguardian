import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

import { createServiceClient } from "@/lib/supabase/service";

export const POST = async (request: NextRequest) => {
  try {
    const rawBody = await request.text();

    const signature = request.headers.get("webhook-signature");
    if (!signature) {
      return NextResponse.json(
        { error: "Missing webhook signature" },
        { status: 401 },
      );
    }

    const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("POLAR_WEBHOOK_SECRET is not configured");
      return NextResponse.json(
        { error: "Webhook not configured" },
        { status: 500 },
      );
    }

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (signature !== expectedSignature) {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 },
      );
    }

    let event: { type?: string; data?: { metadata?: Record<string, string> } };
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "Invalid webhook body" },
        { status: 400 },
      );
    }

    const eventType = event.type || "";
    const metadata = event.data?.metadata || {};
    const userId = metadata.user_id;

    if (!userId) {
      console.warn(`Polar webhook: no user_id in metadata for event ${eventType}`);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const supabase = createServiceClient();

    if (eventType === "subscription.created" || eventType === "subscription.active") {
      const { error } = await supabase
        .from("profiles")
        .update({
          plan: "pro",
          max_scans: 999999,
        })
        .eq("id", userId);

      if (error) {
        console.error("Failed to update profile on subscription activation:", error);
        return NextResponse.json({ error: "Database update failed" }, { status: 500 });
      }

      console.log(`Polar webhook: activated pro for user ${userId}`);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    if (eventType === "subscription.canceled" || eventType === "subscription.revoked") {
      const { error } = await supabase
        .from("profiles")
        .update({
          plan: "free",
          max_scans: 3,
          scans_this_month: 0,
        })
        .eq("id", userId);

      if (error) {
        console.error("Failed to update profile on subscription cancellation:", error);
        return NextResponse.json({ error: "Database update failed" }, { status: 500 });
      }

      console.log(`Polar webhook: deactivated pro for user ${userId}`);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (e) {
    console.error("Polar webhook error:", e);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
};