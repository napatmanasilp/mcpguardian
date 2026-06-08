import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { createClient } from "@/lib/supabase/server";

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
