import { createClient } from "@/lib/supabase/server";
import { generateApiKey, PLAN_LIMITS } from "@/lib/api-keys";

// GET — list keys (never return hash or full key)
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { data: keys } = await supabase
    .from("api_keys")
    .select(
      "id, key_prefix, name, plan, calls_this_month, calls_limit, created_at, last_used_at",
    )
    .eq("user_id", user.id)
    .eq("revoked", false)
    .order("created_at", { ascending: false });

  return Response.json({ keys: keys ?? [] });
}

// POST — create key (returns full key ONE TIME ONLY)
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { name = "Default" } = await request.json();

  // Get plan from profiles
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  const plan = profile?.plan ?? "free";
  const limit = PLAN_LIMITS[plan] ?? 100;
  const { key, keyHash, keyPrefix } = generateApiKey();

  // Enforce API key limit per plan
  const { count } = await supabase
    .from("api_keys")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("revoked", false);

  const maxKeys =
    plan === "free" ? 1
    : plan === "developer" ? 3
    : plan === "team" ? 10
    : -1; // unlimited

  if (maxKeys !== -1 && (count ?? 0) >= maxKeys) {
    return Response.json(
      {
        error: `${plan} plan allows max ${maxKeys} API key(s). Upgrade for more.`,
      },
      { status: 403 },
    );
  }

  const { error } = await supabase.from("api_keys").insert({
    user_id: user.id,
    key_hash: keyHash,
    key_prefix: keyPrefix,
    name: name.slice(0, 50),
    plan,
    calls_limit: limit,
  });

  if (error)
    return Response.json({ error: "Failed to create key" }, { status: 500 });

  // Return full key THIS ONE TIME — never stored in plaintext
  return Response.json({ key, key_prefix: keyPrefix, name, plan, calls_limit: limit });
}

// DELETE — revoke
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await request.json();

  await supabase
    .from("api_keys")
    .update({ revoked: true })
    .eq("id", id)
    .eq("user_id", user.id);

  return Response.json({ success: true });
}
