import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Sales — MCPGuardian",
  description: "Reach out to discuss MCPGuardian Enterprise for your organization.",
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
