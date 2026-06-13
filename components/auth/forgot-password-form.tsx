"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { getSiteUrl } from "@/lib/supabase/env";

type FormState = "idle" | "submitting" | "success";

export const ForgotPasswordForm = () => {
  const [formState, setFormState] = useState<FormState>("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setFormState("submitting");

    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;

    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${getSiteUrl()}/reset-password`,
        },
      );

      // Rate-limit error: keep form enabled and show message
      if (resetError && resetError.status === 429) {
        setError("Too many requests. Please try again in a few minutes.");
        setFormState("idle");
        return;
      }

      // For any other response (success or "email not found"),
      // always show the success state to prevent email enumeration
      setFormState("success");
    } catch {
      // Network or unexpected errors — still show success to prevent enumeration
      setFormState("success");
    }
  };

  if (formState === "success") {
    return (
      <div className="space-y-6 text-center">
        <div className="space-y-4">
          <div className="size-16 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center mx-auto">
            <Mail className="size-7 text-blue-400" />
          </div>
          <h2 className="text-xl font-semibold text-white">Check your email</h2>
          <p className="text-sm text-white/50 max-w-xs mx-auto">
            If an account exists with that email, we&apos;ve sent a password
            reset link. Please check your inbox and spam folder.
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
          Reset your password
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a reset link
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
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

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={formState === "submitting"}
        >
          {formState === "submitting" ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Sending reset link...
            </>
          ) : (
            "Send reset link"
          )}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Remember your password?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
};
