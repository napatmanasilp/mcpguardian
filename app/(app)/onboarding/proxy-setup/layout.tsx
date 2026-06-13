import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Proxy Setup — MCPGuardian",
  description: "Connect the MCPGuardian proxy for runtime protection.",
};

export default function ProxySetupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
