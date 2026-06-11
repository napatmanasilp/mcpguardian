import { type NextRequest, NextResponse } from "next/server";

const protectedRoutes = [
  "/dashboard",
  "/scan",
  "/reports",
  "/monitors",
  "/alerts",
  "/settings",
  "/servers",
  "/sessions",
  "/activity",
  "/telemetry",
  "/compliance",
  "/onboarding",
];

export const middleware = async (request: NextRequest) => {
  try {
    const supabaseResponse = NextResponse.next({ request });

    // Extract Supabase project ref from env - computed inside the function for Edge safety
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const projectRef = supabaseUrl.match(/https:\/\/(.+)\.supabase\.co/)?.[1] ?? "";

    // Parse user from Supabase auth cookie (sb-{ref}-auth-token)
    let user: { id: string } | null = null;
    if (projectRef) {
      const authCookieName = `sb-${projectRef}-auth-token`;
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
    }

    const { pathname } = request.nextUrl;

    const isProtected = protectedRoutes.some(
      (route) => pathname === route || pathname.startsWith(`${route}/`),
    );

    if (!isProtected) {
      return supabaseResponse;
    }

    if (!user) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(redirectUrl);
    }

    return supabaseResponse;
  } catch (e) {
    console.error("[middleware] Invocation failed:", e);
    // Allow request through — auth enforced by API routes and pages
    return NextResponse.next();
  }
};

export const runtime = "nodejs";

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
