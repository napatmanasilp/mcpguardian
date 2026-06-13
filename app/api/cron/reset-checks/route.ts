import { createServiceClient } from "@/lib/supabase/service";

export async function GET(request: Request) {
  if (
    request.headers.get("authorization") !==
    `Bearer ${process.env.CRON_SECRET}`
  ) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use service client so RLS doesn't block cross-user writes
  const supabase = createServiceClient();

  // Reset monthly counters
  await supabase
    .from("api_keys")
    .update({ calls_this_month: 0 })
    .neq("calls_this_month", 0);

  // Clear check cache (older than 32 days — keep recent for debugging)
  const thirtyTwoDaysAgo = new Date(
    Date.now() - 32 * 24 * 60 * 60 * 1000,
  ).toISOString();
  await supabase.from("check_cache").delete().lt("checked_at", thirtyTwoDaysAgo);

  return Response.json({ success: true, message: "Monthly checks reset" });
}
