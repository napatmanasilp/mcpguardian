/**
 * Auth utility functions — pure, testable logic extracted from server actions.
 */

/** Routes that are considered auth routes (login, signup, forgot-password) */
export const AUTH_ROUTES = ["/login", "/signup", "/forgot-password"] as const;

/**
 * Determines the redirect destination after a successful login.
 *
 * Rules:
 * - If `redirectTo` is a string starting with `/`, redirect there.
 * - Otherwise, redirect to `/dashboard`.
 */
export function resolveAuthRedirect(redirectTo?: string | null): string {
  if (typeof redirectTo === "string" && redirectTo.startsWith("/")) {
    return redirectTo;
  }
  return "/dashboard";
}

/**
 * Determines whether a logged-in user on an auth route should be redirected.
 *
 * Rules:
 * - Logged-in users visiting auth routes are always redirected to `/dashboard`.
 */
export function resolveLoggedInAuthRouteRedirect(pathname: string): string | null {
  const isAuthRoute = AUTH_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
  if (isAuthRoute) {
    return "/dashboard";
  }
  return null;
}
