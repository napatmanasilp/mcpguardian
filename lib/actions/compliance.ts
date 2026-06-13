"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ActionState } from "@/lib/types/settings";

export async function requestPdfReport(
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

  // Insert a PDF generation request with status "pending"
  const { error: insertError } = await svc
    .from("pdf_generation_requests")
    .insert({
      organization_id: membership.organization_id,
      status: "pending",
    });

  if (insertError) {
    return { error: insertError.message };
  }

  return { success: true };
}
