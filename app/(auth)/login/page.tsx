import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Log In — MCPGuardian",
  description: "Sign in to your MCPGuardian account to manage MCP server security.",
};

interface LoginPageProps {
  searchParams: Promise<{ redirectTo?: string }>;
}

const LoginPage = async ({ searchParams }: LoginPageProps) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const redirectTo = params.redirectTo ?? "/dashboard";

  return <LoginForm redirectTo={redirectTo} />;
};

export default LoginPage;
