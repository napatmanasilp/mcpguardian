import Link from "next/link";
import { Shield } from "lucide-react";

import { createClient } from "@/lib/supabase/server";

export default async function NotFound() {
  let isAuthenticated = false;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    isAuthenticated = !!user;
  } catch {
    // If auth check fails, default to unauthenticated state
    isAuthenticated = false;
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4"
      style={{ backgroundColor: "var(--bg-void)" }}
    >
      <div className="flex flex-col items-center text-center max-w-md">
        {/* Brand logo */}
        <div className="mb-8 flex items-center gap-2 font-bold tracking-tight">
          <Shield className="size-6" style={{ color: "var(--monitor)" }} aria-hidden />
          <span className="text-xl text-foreground">
            MCP<span style={{ color: "var(--monitor)" }}>Guardian</span>
          </span>
        </div>

        {/* 404 heading */}
        <h1 className="text-4xl font-bold text-foreground mb-4">
          404 — Page Not Found
        </h1>

        {/* Description (≤ 150 chars) */}
        <p className="text-muted-foreground text-base mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved. Check the URL or head back to safety.
        </p>

        {/* Auth-aware navigation link */}
        {isAuthenticated ? (
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-md px-6 py-3 text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: "var(--monitor)" }}
          >
            Back to Dashboard
          </Link>
        ) : (
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-md px-6 py-3 text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: "var(--monitor)" }}
          >
            Go to Login
          </Link>
        )}
      </div>
    </div>
  );
}
