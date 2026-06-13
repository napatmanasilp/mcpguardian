// Feature: ui-launch-readiness, Property 10: Auth redirect determination
// **Validates: Requirements 22.1, 22.4**

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  resolveAuthRedirect,
  resolveLoggedInAuthRouteRedirect,
  AUTH_ROUTES,
} from "@/lib/utils/auth";

describe("Property 10: Auth redirect determination", () => {
  it("redirects to redirectTo when it starts with /", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).map((s) => "/" + s), // always starts with /
        (redirectTo) => {
          const result = resolveAuthRedirect(redirectTo);
          expect(result).toBe(redirectTo);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("redirects to /dashboard when redirectTo does not start with /", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !s.startsWith("/")), // never starts with /
        (redirectTo) => {
          const result = resolveAuthRedirect(redirectTo);
          expect(result).toBe("/dashboard");
        }
      ),
      { numRuns: 200 }
    );
  });

  it("redirects to /dashboard when redirectTo is undefined or null", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(undefined, null),
        (redirectTo) => {
          const result = resolveAuthRedirect(redirectTo);
          expect(result).toBe("/dashboard");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("redirects to /dashboard for empty string redirectTo", () => {
    const result = resolveAuthRedirect("");
    expect(result).toBe("/dashboard");
  });

  it("redirect is always deterministic for any redirectTo value", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(),
          fc.constant(undefined),
          fc.constant(null),
          fc.string({ minLength: 1 }).map((s) => "/" + s)
        ),
        (redirectTo) => {
          const first = resolveAuthRedirect(redirectTo);
          const second = resolveAuthRedirect(redirectTo);
          expect(first).toBe(second);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("logged-in users on auth routes always get redirected to /dashboard", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...AUTH_ROUTES),
        (route) => {
          const result = resolveLoggedInAuthRouteRedirect(route);
          expect(result).toBe("/dashboard");
        }
      ),
      { numRuns: 100 }
    );
  });

  it("logged-in users on auth sub-routes also get redirected to /dashboard", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...AUTH_ROUTES),
        fc.string({ minLength: 1 }).map((s) => "/" + s.replace(/\//g, "")), // sub-path segment
        (route, subPath) => {
          const fullPath = route + subPath;
          const result = resolveLoggedInAuthRouteRedirect(fullPath);
          expect(result).toBe("/dashboard");
        }
      ),
      { numRuns: 200 }
    );
  });

  it("logged-in users on non-auth routes do NOT get redirected", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          "/dashboard",
          "/servers",
          "/sessions",
          "/settings/general",
          "/activity",
          "/alerts",
          "/telemetry",
          "/compliance"
        ),
        (route) => {
          const result = resolveLoggedInAuthRouteRedirect(route);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("result is always either the redirectTo path or /dashboard", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(),
          fc.constant(undefined),
          fc.constant(null),
          fc.string({ minLength: 1 }).map((s) => "/" + s)
        ),
        (redirectTo) => {
          const result = resolveAuthRedirect(redirectTo);
          // Result is always a string starting with /
          expect(result.startsWith("/")).toBe(true);
          // Result is either the redirectTo (if it started with /) or /dashboard
          if (typeof redirectTo === "string" && redirectTo.startsWith("/")) {
            expect(result).toBe(redirectTo);
          } else {
            expect(result).toBe("/dashboard");
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});
