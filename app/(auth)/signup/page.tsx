import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignupForm } from "@/components/auth/signup-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Sign Up — MCPGuardian",
  description: "Create a free MCPGuardian account to start scanning MCP servers.",
};

const SignupPage = async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return <SignupForm />;
};

export default SignupPage;
