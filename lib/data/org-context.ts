import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// ─── Types ────────────────────────────────────────────────────────────

export interface OrgContext {
  userId: string;
  organizationId: string;
  role: "owner" | "admin" | "member";
  plan: string;
}

// ─── Main Function ────────────────────────────────────────────────────

/**
 * Resolves the authenticated user's organization context.
 *
 * Returns the user ID, organization ID, membership role, and plan tier.
 * Returns `null` if the user is not authenticated or has no accepted
 * organization membership.
 */
export async function getOrgContext(): Promise<OrgContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const svc = createServiceClient();

  const { data: membership } = await svc
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .eq("invitation_status", "accepted")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!membership) return null;

  const { data: org } = await svc
    .from("organizations")
    .select("plan_id")
    .eq("id", membership.organization_id)
    .single();

  return {
    userId: user.id,
    organizationId: membership.organization_id,
    role: membership.role as OrgContext["role"],
    plan: org?.plan_id ?? "free",
  };
}
