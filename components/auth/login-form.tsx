"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { GitHubIcon } from "@/components/icons/github-icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { signInWithEmail, type AuthActionState } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/client";

interface LoginFormProps {
  redirectTo: string;
}

const initialState: AuthActionState = {};

export const LoginForm = ({ redirectTo }: LoginFormProps) => {
  const [state, formAction, isPending] = useActionState(
    signInWithEmail,
    initialState,
  );

  useEffect(() => {
    if (state.error) {
      toast.error(state.error);
    }
  }, [state.error]);

  const handleGitHubSignIn = async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    });

    if (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to your ShieldMCP account
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="redirectTo" value={redirectTo} />

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      <div className="relative">
        <Separator />
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
          or
        </span>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGitHubSignIn}
      >
        <GitHubIcon className="size-4" />
        Sign in with GitHub
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-primary hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
};
