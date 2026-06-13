"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ActionState } from "@/lib/types/settings";
import { validateOrgName } from "@/lib/utils/settings";

export async function updateOrgName(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const rawName = formData.get("name");

  const validation = validateOrgName(rawName);
  if (!validation.valid) {
    return { error: validation.error! };
  }

  const name = validation.trimmedName;

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
    .select("organization_id, role")
    .eq("user_id", user.id)
    .eq("invitation_status", "accepted")
    .single();

  if (memberError || !membership) {
    return { error: "Organization membership not found." };
  }

  // Verify admin or owner role
  if (membership.role !== "admin" && membership.role !== "owner") {
    return { error: "Unauthorized" };
  }

  // Update the organization name
  const { error: updateError } = await svc
    .from("organizations")
    .update({ name })
    .eq("id", membership.organization_id);

  if (updateError) {
    return { error: updateError.message };
  }

  return { success: true };
}

export async function updateOrgTimezone(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const rawTimezone = formData.get("timezone");

  if (typeof rawTimezone !== "string" || rawTimezone.trim().length === 0) {
    return { error: "Timezone is required." };
  }

  const timezone = rawTimezone.trim();

  // Validate the timezone is a valid IANA timezone
  try {
    const validTimezones = Intl.supportedValuesOf("timeZone");
    if (!validTimezones.includes(timezone)) {
      return { error: "Invalid timezone." };
    }
  } catch {
    // Fallback: basic format check if Intl.supportedValuesOf is not available
    if (!/^[A-Za-z_/]+$/.test(timezone)) {
      return { error: "Invalid timezone format." };
    }
  }

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
    .select("organization_id, role")
    .eq("user_id", user.id)
    .eq("invitation_status", "accepted")
    .single();

  if (memberError || !membership) {
    return { error: "Organization membership not found." };
  }

  // Verify admin or owner role
  if (membership.role !== "admin" && membership.role !== "owner") {
    return { error: "Unauthorized" };
  }

  // Update the organization timezone
  const { error: updateError } = await svc
    .from("organizations")
    .update({ timezone })
    .eq("id", membership.organization_id);

  if (updateError) {
    return { error: updateError.message };
  }

  return { success: true };
}

export async function uploadOrgLogo(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const file = formData.get("logo");

  if (!file || !(file instanceof File) || file.size === 0) {
    return { error: "No file provided." };
  }

  // Server-side validation
  const MIME_WHITELIST = ["image/png", "image/jpeg", "image/svg+xml"];
  const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

  if (!MIME_WHITELIST.includes(file.type)) {
    return { error: "Unsupported file type. Please upload a PNG, JPEG, or SVG file." };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { error: "File is too large. Maximum size is 2 MB." };
  }

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
    .select("organization_id, role")
    .eq("user_id", user.id)
    .eq("invitation_status", "accepted")
    .single();

  if (memberError || !membership) {
    return { error: "Organization membership not found." };
  }

  // Verify admin or owner role
  if (membership.role !== "admin" && membership.role !== "owner") {
    return { error: "Unauthorized" };
  }

  // Determine file extension from MIME type
  const extMap: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/svg+xml": "svg",
  };
  const ext = extMap[file.type] ?? "png";
  const filePath = `${membership.organization_id}/logo.${ext}`;

  // Upload to Supabase Storage "org-logos" bucket
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await svc.storage
    .from("org-logos")
    .upload(filePath, fileBuffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return { error: `Upload failed: ${uploadError.message}` };
  }

  // Get the public URL
  const { data: publicUrlData } = svc.storage
    .from("org-logos")
    .getPublicUrl(filePath);

  const logoUrl = publicUrlData.publicUrl;

  // Persist public URL to organizations.logo_url
  const { error: updateError } = await svc
    .from("organizations")
    .update({ logo_url: logoUrl })
    .eq("id", membership.organization_id);

  if (updateError) {
    return { error: updateError.message };
  }

  return { success: true };
}

export async function deleteOrganization(
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
    .select("organization_id, role")
    .eq("user_id", user.id)
    .eq("invitation_status", "accepted")
    .single();

  if (memberError || !membership) {
    return { error: "Organization membership not found." };
  }

  // Only owners can delete the organization
  if (membership.role !== "owner") {
    return { error: "Unauthorized. Only the organization owner can delete it." };
  }

  // Delete the organization — all associated records cascade via ON DELETE CASCADE
  const { error: deleteError } = await svc
    .from("organizations")
    .delete()
    .eq("id", membership.organization_id);

  if (deleteError) {
    return { error: deleteError.message };
  }

  return { success: true };
}
