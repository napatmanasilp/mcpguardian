import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { createServerClient } from "@supabase/ssr";

import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

const protectedRoutes = [
  "/dashboard",
  "/servers",
  "/sessions",
  "/activity",
  "/alerts",
  "/compliance",
  "/settings",
  "/telemetry",
  "/onboarding",
];

export const middleware = async (request: NextRequest) => {
  const supabaseResponse = NextResponse.next({ request });

  const { pathname } = request.nextUrl;
  const isProtected = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  // ── Authenticate via Supabase SSR client ─────────────────────────
  // Use the standard Supabase server client instead of manually parsing
  // the auth cookie. This ensures accurate auth state by actually
  // verifying the session with the Supabase API (refreshing it if
  // needed), preventing redirect loops when cookie state and actual
  // Supabase session state diverge (e.g. stale/expired JWTs).
  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  let user: { id: string } | null = null;
  try {
    const {
      data: { user: u },
    } = await supabase.auth.getUser();
    if (u) user = { id: u.id };
  } catch {
    // Supabase API unreachable or session invalid — treat as unauthenticated
  }

  // Redirect unauthenticated users to login
  if (isProtected && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Org membership check (skip for onboarding itself) ──────────
  if (user && pathname !== "/onboarding" && !pathname.startsWith("/onboarding/")) {
    const isDashboardOrApp = [
      "/dashboard", "/servers", "/sessions", "/activity",
      "/alerts", "/compliance", "/settings", "/telemetry",
    ].some((route) => pathname === route || pathname.startsWith(`${route}/`));

    if (isDashboardOrApp) {
      try {
        const { data: membership } = await supabase
          .from("organization_members")
          .select("id")
          .eq("user_id", user.id)
          .limit(1)
          .maybeSingle();

        if (!membership) {
          return NextResponse.redirect(new URL("/onboarding", request.url));
        }
      } catch {
        // If the membership check fails, allow the request through
        // (enforced by API routes and pages)
      }
    }
  }

  return supabaseResponse;
};

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
