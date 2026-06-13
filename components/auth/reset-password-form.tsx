"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

type FormState = "idle" | "submitting" | "mismatch" | "error" | "expired" | "success";

export const ResetPasswordForm = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  // On mount: exchange the code URL param for a Supabase session
  useEffect(() => {
    const code = searchParams.get("code");

    if (!code) {
      setFormState("expired");
      setErrorMessage("Invalid or expired password reset link.");
      return;
    }

    const exchangeCode = async () => {
      try {
        const supabase = createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          setFormState("expired");
          setErrorMessage("Your password reset link has expired or is invalid.");
          return;
        }

        setSessionReady(true);
      } catch {
        setFormState("expired");
        setErrorMessage("Your password reset link has expired or is invalid.");
      }
    };

    exchangeCode();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    // Block submission when passwords do not match
    if (password !== confirmPassword) {
      setFormState("mismatch");
      return;
    }

    // Block submission when password is too short
    if (password.length < 8) {
      setFormState("mismatch");
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }

    setFormState("submitting");
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setFormState("error");
        setErrorMessage(error.message);
        return;
      }

      setFormState("success");
      router.push("/dashboard");
    } catch {
      setFormState("error");
      setErrorMessage("An unexpected error occurred. Please try again.");
    }
  };

  // Expired/invalid token state
  if (formState === "expired") {
    return (
      <div className="space-y-6 text-center">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-white">
            Link expired
          </h2>
          <p className="text-sm text-white/50 max-w-xs mx-auto">
            {errorMessage}
          </p>
        </div>
        <Button asChild className="w-full">
          <Link href="/forgot-password">Request a new reset link</Link>
        </Button>
      </div>
    );
  }

  // Loading state while exchanging the code
  if (!sessionReady) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 py-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Verifying your reset link...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Set new password
        </h1>
        <p className="text-sm text-muted-foreground">
          Enter your new password below
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
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
          {formState === "mismatch" && (
            <p className="text-sm text-destructive" role="alert">
              {errorMessage ?? "Passwords do not match."}
            </p>
          )}
        </div>

        {formState === "error" && (
          <div className="space-y-2">
            <p className="text-sm text-destructive" role="alert">
              {errorMessage}
            </p>
            <Link
              href="/forgot-password"
              className="text-sm text-primary hover:underline"
            >
              Request a new reset link
            </Link>
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={formState === "submitting"}
        >
          {formState === "submitting" ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Updating password...
            </>
          ) : (
            "Reset password"
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
