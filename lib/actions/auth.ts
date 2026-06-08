"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/supabase/env";

const getOrigin = async () => {
  const headersList = await headers();
  return headersList.get("origin") ?? getSiteUrl();
};

export interface AuthActionState {
  error?: string;
  success?: boolean;
}

export const signInWithEmail = async (
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> => {
  const email = formData.get("email");
  const password = formData.get("password");
  const redirectTo = formData.get("redirectTo");

  if (typeof email !== "string" || typeof password !== "string") {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  const destination =
    typeof redirectTo === "string" && redirectTo.startsWith("/")
      ? redirectTo
      : "/dashboard";

  redirect(destination);
};

export const signUpWithEmail = async (
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> => {
  const email = formData.get("email");
  const password = formData.get("password");
  const confirmPassword = formData.get("confirmPassword");

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    typeof confirmPassword !== "string"
  ) {
    return { error: "All fields are required." };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const origin = await getOrigin();
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
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
