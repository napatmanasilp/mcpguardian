import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Get Started — MCPGuardian",
  description: "Set up your organization and secure your first MCP server.",
};

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
