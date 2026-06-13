"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ActionState } from "@/lib/types/settings";
import { OrgNameSchema, OrgTimezoneSchema } from "@/lib/validation/schemas";

const LOGO_MIME_WHITELIST = ["image/png", "image/jpeg", "image/svg+xml"];
const LOGO_MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

export async function updateOrgName(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const rawName = formData.get("name");

  // Validate with Zod
  const parsed = OrgNameSchema.safeParse({ name: rawName });
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Validation failed.";
    return { error: firstError };
  }

  const name = parsed.data.name;

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
    return { error: "Unauthorized. Only admins and owners can modify settings." };
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
  const raw = { timezone: formData.get("timezone") as string | null ?? "" };

  const parsed = OrgTimezoneSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString();
      if (key && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    const firstError = parsed.error.issues[0]?.message ?? "Validation failed.";
    return { error: firstError, fieldErrors };
  }

  const timezone = parsed.data.timezone.trim();

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

  // Validate input with structured error response
  if (!file || !(file instanceof File) || file.size === 0) {
    return { error: "No file provided.", fieldErrors: { logo: "No file provided." } };
  }

  if (!LOGO_MIME_WHITELIST.includes(file.type)) {
    return {
      error: "Unsupported file type. Please upload a PNG, JPEG, or SVG file.",
      fieldErrors: { logo: "Unsupported file type. Please upload a PNG, JPEG, or SVG file." },
    };
  }

  if (file.size > LOGO_MAX_FILE_SIZE) {
    return {
      error: "File is too large. Maximum size is 2 MB.",
      fieldErrors: { logo: "File is too large. Maximum size is 2 MB." },
    };
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
