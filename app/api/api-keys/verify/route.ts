import { createClient } from "@/lib/supabase/server";

// Used by verification poller on the Get Protected page
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const prefix = searchParams.get("prefix");
  if (!prefix)
    return Response.json({ error: "Missing prefix" }, { status: 400 });

  const { data } = await supabase
    .from("api_keys")
    .select("last_used_at, calls_this_month")
    .eq("user_id", user.id)
    .eq("key_prefix", prefix)
    .eq("revoked", false)
    .single();

  return Response.json({
    lastUsedAt: data?.last_used_at ?? null,
    checksUsed: data?.calls_this_month ?? 0,
  });
}
