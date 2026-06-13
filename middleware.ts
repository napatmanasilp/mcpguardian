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

const authRoutes = ["/login", "/signup", "/forgot-password"];

export const middleware = async (request: NextRequest) => {
  const supabaseResponse = NextResponse.next({ request });

  const { pathname } = request.nextUrl;
  const isProtected = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  const isAuthRoute = authRoutes.some(
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

  // Redirect authenticated users away from auth routes to dashboard
  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Note: Org membership check is NOT performed in middleware.
  // Server-side components (dashboard layout/page) handle this with
  // the service client (bypasses RLS) and redirect to /onboarding.
  // Performing this check here with the anon-key client can fail due
  // to RLS policies, causing redirect loops back to /onboarding.

  return supabaseResponse;
};

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
