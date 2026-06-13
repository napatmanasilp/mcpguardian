import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * POST /api/alerts/channels/toggle-notifications
 *
 * Toggles the `email_notifications_enabled` field on the organization.
 * Used by the settings notification toggle with optimistic updates.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== "boolean") {
      return NextResponse.json(
        { error: "enabled (boolean) is required" },
        { status: 400 },
      );
    }

    const svc = createServiceClient();

    // Resolve org membership
    const { data: membership } = await svc
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", user.id)
      .eq("invitation_status", "accepted")
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: "Organization membership not found" },
        { status: 404 },
      );
    }

    // Verify admin or owner role
    if (membership.role !== "admin" && membership.role !== "owner") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 },
      );
    }

    // Update the notification preference on the organization
    const { error: updateError } = await svc
      .from("organizations")
      .update({ email_notifications_enabled: enabled })
      .eq("id", membership.organization_id);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
