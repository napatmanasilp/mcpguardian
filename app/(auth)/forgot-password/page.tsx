import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Forgot Password — MCPGuardian",
  description: "Reset your MCPGuardian account password via email.",
};

const ForgotPasswordPage = async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return <ForgotPasswordForm />;
};

export default ForgotPasswordPage;
