import { redirect } from "next/navigation";

export const metadata = {
  title: "Setup Complete — MCPGuardian",
};

// Legacy route — redirect to dashboard
export default function ConfirmedPage() {
  redirect("/dashboard");
}
