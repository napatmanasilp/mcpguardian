import { redirect } from "next/navigation";

import { SignupForm } from "@/components/auth/signup-form";
import { createClient } from "@/lib/supabase/server";

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
