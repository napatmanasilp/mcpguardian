import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accept Invite — MCPGuardian",
  description: "Accept your team invitation to join an MCPGuardian organization.",
};

export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
