import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

const ResetPasswordPage = () => {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
};

export default ResetPasswordPage;
