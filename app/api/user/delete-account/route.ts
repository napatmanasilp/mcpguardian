import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const POST = async (request: NextRequest) => {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const serviceClient = createServiceClient();

    const { error: profileError } = await serviceClient
      .from("profiles")
      .delete()
      .eq("id", user.id);

    if (profileError) {
      console.error("Failed to delete profile:", profileError);
      return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
    }

    const { error: authError } = await serviceClient.auth.admin.deleteUser(user.id);

    if (authError) {
      console.error("Failed to delete auth user:", authError);
      return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e) {
    console.error("Delete account error:", e);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
};