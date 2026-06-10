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

// Extract Supabase project ref from the URL env var (set at build time)
const SUPABASE_PROJECT_REF = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  .match(/https:\/\/(.+)\.supabase\.co/)?.[1] ?? "";

export const middleware = async (request: NextRequest) => {
  const supabaseResponse = NextResponse.next({ request });

  // Parse user from Supabase auth cookie (sb-{ref}-auth-token)
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
};

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
