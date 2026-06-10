import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseUrl } from "@/lib/supabase/env";

const projectRef = getSupabaseUrl().match(/https:\/\/(.+)\.supabase\.co/)?.[1] ?? "";

export const updateSession = async (request: NextRequest) => {
  const supabaseResponse = NextResponse.next({ request });

  // Try to get authenticated user from the Supabase auth cookie
  // The cookie contains the full session JWT; we decode the payload client-side style
  const authCookieName = `sb-${projectRef}-auth-token`;
  const authCookie = request.cookies.get(authCookieName);

  let user: { id: string; email?: string } | null = null;

  if (authCookie?.value) {
    try {
      const parsed = JSON.parse(authCookie.value);
      if (parsed?.user?.id) {
        user = { id: parsed.user.id, email: parsed.user.email };
      }
    } catch {
      // Invalid auth cookie — user not authenticated
    }
  }

  return { supabaseResponse, user };
};
