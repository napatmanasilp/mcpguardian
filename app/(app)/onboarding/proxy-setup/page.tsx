import { redirect } from "next/navigation";

// Legacy route — proxy setup is now part of the main onboarding flow
export default function ProxySetupPage() {
  redirect("/onboarding");
}
