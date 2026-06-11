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

// Extract Supabase project ref from the URL env var (set at build time)
const SUPABASE_PROJECT_REF = (getSupabaseUrl()
  .match(/https:\/\/(.+)\.supabase\.co/)?.[1] ?? "");

export const middleware = async (request: NextRequest) => {
  const supabaseResponse = NextResponse.next({ request });

  // ── Authenticate via cookie ─────────────────────────────────────
  let user: { id: string } | null = null;
  const authCookieName = `sb-${SUPABASE_PROJECT_REF}-auth-token`;
  const authCookie = request.cookies.get(authCookieName);
  if (authCookie?.value) {
    try {
      const parsed = JSON.parse(authCookie.value);
      if (parsed?.user?.id) {
        user = { id: parsed.user.id };
      }
    } catch {
      // Invalid cookie — not authenticated
    }
  }

  const { pathname } = request.nextUrl;
  const isProtected = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

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
        const svc = createServerClient(
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

        const { data: membership } = await svc
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
