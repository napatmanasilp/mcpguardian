import { Button, Section, Text } from "@react-email/components";
import * as React from "react";

import { EmailLayout } from "./components/email-layout";

interface InviteMemberEmailProps {
  inviterName: string;
  organizationName: string;
  inviteUrl: string;
}

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mcpguardian.dev";

export const InviteMemberEmail = ({
  inviterName,
  organizationName,
  inviteUrl,
}: InviteMemberEmailProps) => {
  return (
    <EmailLayout
      previewText={`${inviterName} invited you to join ${organizationName} on MCPGuardian`}
    >
      <Section>
        <Text style={emoji}>👋</Text>
        <Text style={heading}>You&apos;ve Been Invited</Text>

        <Text style={paragraph}>
          <strong>{inviterName}</strong> has invited you to join{" "}
          <strong>{organizationName}</strong> on MCPGuardian.
        </Text>

        <Text style={paragraph}>
          MCPGuardian scans and monitors MCP servers for security threats,
          credential leaks, and supply chain attacks. As a team member, you&apos;ll
          have access to scan results, alert configurations, and the proxy
          dashboard.
        </Text>

        <Section style={ctaSection}>
          <Button href={inviteUrl} style={button}>
            Accept Invitation
          </Button>
        </Section>

        <Text style={smallText}>
          This invitation will expire in 7 days. If you weren&apos;t expecting this
          invitation, you can safely ignore this email.
        </Text>
      </Section>
    </EmailLayout>
  );
};

export default InviteMemberEmail;

const emoji = { fontSize: "32px", textAlign: "center" as const, margin: "0 0 8px" };
const heading = { margin: "0 0 16px", fontSize: "20px", fontWeight: 700, color: "#18181b", textAlign: "center" as const };
const paragraph = { margin: "0 0 12px", fontSize: "14px", lineHeight: "1.5", color: "#52525b" };
const ctaSection = { margin: "24px 0", textAlign: "center" as const };
const button = { backgroundColor: "#2563eb", borderRadius: "6px", color: "#ffffff", fontSize: "14px", fontWeight: 600, padding: "12px 24px", textDecoration: "none", textAlign: "center" as const, display: "inline-block" };
const smallText = { margin: "16px 0 0", fontSize: "11px", color: "#a1a1aa", textAlign: "center" as const };
