"use client";

import { useActionState, useCallback, useState } from "react";
import Link from "next/link";
import { Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { signUpWithEmail, type AuthActionState } from "@/lib/actions/auth";

const initialState: AuthActionState = {};

export const SignupForm = () => {
  const [state, formAction, isPending] = useActionState(
    signUpWithEmail,
    initialState,
  );
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [resending, setResending] = useState(false);

  const handleFormAction = useCallback(
    async (formData: FormData) => {
      const email = formData.get("email") as string;
      if (email) {
        sessionStorage.setItem("signup-email", email);
        setSubmittedEmail(email);
      }
      return formAction(formData);
    },
    [formAction],
  );

  const handleResend = useCallback(async () => {
    if (!submittedEmail) return;
    setResending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: submittedEmail,
      });
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Confirmation email resent");
      }
    } catch {
      toast.error("Failed to resend email");
    } finally {
      setResending(false);
    }
  }, [submittedEmail]);

  if (state.success) {
    return (
      <div className="space-y-6 text-center">
        <div className="space-y-4">
          <div className="size-16 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center mx-auto">
            <Mail className="size-7 text-blue-400" />
          </div>
          <h2 className="text-xl font-semibold text-white">Check your inbox</h2>
          <p className="text-sm text-white/50 max-w-xs mx-auto">
            We sent a confirmation link to{" "}
            <span className="text-white font-mono text-xs">{submittedEmail}</span>.
            Click it to activate your account.
          </p>
          <p className="text-xs text-white/30">
            Didn't get it?{" "}
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="text-blue-400 hover:text-blue-300 underline underline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resending ? "Resending..." : "Resend email"}
            </button>
          </p>
        </div>
        <Button asChild className="w-full">
          <Link href="/login">Back to login</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Create an account
        </h1>
        <p className="text-sm text-muted-foreground">
          Start scanning your MCP configurations for free
        </p>
      </div>

      <form action={handleFormAction} className="space-y-4">
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
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>

        {state.error ? (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}

        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Creating account...
            </>
          ) : (
            "Sign up"
          )}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
};
