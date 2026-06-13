import { NextResponse } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export const GET = async () => {
  const supabase = createServiceClient();

  try {
    const { data } = await supabase
      .from("tool_definition_snapshots")
      .select("*")
      .gt("change_count", 0)
      .order("last_seen_at", { ascending: false })
      .limit(20);

    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
};
