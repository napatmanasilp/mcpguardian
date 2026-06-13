import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — MCPGuardian",
  description: "Choose the right MCPGuardian plan for your security needs.",
};

export default function UpgradeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
