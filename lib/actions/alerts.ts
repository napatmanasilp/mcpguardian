"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ActionState } from "@/lib/types/settings";
import { MarkAlertReadSchema } from "@/lib/validation/schemas";

// ─── Server Actions ───────────────────────────────────────────────────

export async function markAllAlertsRead(
  _prevState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  // Authenticate the user
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Not authenticated." };
  }

  // Look up the user's org membership
  const svc = createServiceClient();
  const { data: membership, error: memberError } = await svc
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("invitation_status", "accepted")
    .single();

  if (memberError || !membership) {
    return { error: "Organization membership not found." };
  }

  // Mark all unread alerts as read for this org
  const { error: updateError } = await svc
    .from("alerts")
    .update({ read: true })
    .eq("organization_id", membership.organization_id)
    .eq("read", false);

  if (updateError) {
    return { error: "Failed to mark alerts as read." };
  }

  return { success: true };
}

export async function markAlertRead(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = { alertId: formData.get("alertId") as string | null ?? "" };

  const parsed = MarkAlertReadSchema.safeParse(raw);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Validation failed.";
    return { error: firstError };
  }

  const { alertId } = parsed.data;

  // Authenticate the user
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Not authenticated." };
  }

  // Look up the user's org membership
  const svc = createServiceClient();
  const { data: membership, error: memberError } = await svc
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("invitation_status", "accepted")
    .single();

  if (memberError || !membership) {
    return { error: "Organization membership not found." };
  }

  // Mark the specific alert as read
  const { data, error: updateError } = await svc
    .from("alerts")
    .update({ read: true })
    .eq("id", alertId)
    .eq("organization_id", membership.organization_id)
    .select("id")
    .single();

  if (updateError || !data) {
    return { error: "Alert not found." };
  }

  return { success: true };
}
