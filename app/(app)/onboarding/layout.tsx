import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Onboarding — MCPGuardian",
  description: "Set up your organization and register your first MCP server.",
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
