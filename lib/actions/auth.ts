"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/supabase/env";
import { type ActionState } from "@/lib/types/settings";
import { resolveAuthRedirect } from "@/lib/utils/auth";

export type AuthActionState = ActionState & {
  values?: Record<string, string>;
};

// ─── Zod Schemas ──────────────────────────────────────────────────────

const SignInSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required.")
    .email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required."),
  redirectTo: z.string().optional(),
});

const SignUpSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required.")
    .email("Please enter a valid email address."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters."),
});

// ─── Server Actions ───────────────────────────────────────────────────

export const signInWithEmail = async (
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> => {
  const raw = {
    email: formData.get("email") as string | null ?? "",
    password: formData.get("password") as string | null ?? "",
    redirectTo: formData.get("redirectTo") as string | null ?? "",
  };

  const parsed = SignInSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString();
      if (key && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    const firstError = parsed.error.issues[0]?.message ?? "Validation failed.";
    return { error: firstError, fieldErrors, values: { email: raw.email } };
  }

  const { email, password, redirectTo } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message, values: { email } };
  }

  const destination = resolveAuthRedirect(redirectTo);

  redirect(destination);
};

export const signUpWithEmail = async (
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> => {
  const raw = {
    email: formData.get("email") as string | null ?? "",
    password: formData.get("password") as string | null ?? "",
  };

  const parsed = SignUpSchema.safeParse(raw);

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]?.toString();
      if (key && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    const firstError = parsed.error.issues[0]?.message ?? "Validation failed.";
    return { error: firstError, fieldErrors };
  }

  const { email, password } = parsed.data;

  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
};

export const signOut = async () => {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
};
