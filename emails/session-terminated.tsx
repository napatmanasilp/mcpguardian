import { Button, Section, Text } from "@react-email/components";
import * as React from "react";

import { EmailLayout } from "./components/email-layout";

interface SessionTerminatedEmailProps {
  userName: string;
  serverName: string;
  reason: string;
  toolCallCount: number;
  dashboardUrl?: string;
}

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mcpguardian.dev";

export const SessionTerminatedEmail = ({
  userName,
  serverName,
  reason,
  toolCallCount,
  dashboardUrl = `${baseUrl}/dashboard`,
}: SessionTerminatedEmailProps) => {
  return (
    <EmailLayout
      previewText={`Session terminated on ${serverName}: ${reason}`}
    >
      <Section>
        <Text style={emoji}>🚨</Text>

        <Text style={heading}>Session Terminated</Text>

        <Text style={paragraph}>
          Hi {userName}, MCPGuardian has terminated a proxy session for{" "}
          <strong>{serverName}</strong>.
        </Text>

        <Section style={detailsBox}>
          <Text style={detailRow}>
            <strong>Server:</strong> {serverName}
          </Text>
          <Text style={detailRow}>
            <strong>Reason:</strong> {reason}
          </Text>
          <Text style={detailRow}>
            <strong>Tool calls intercepted:</strong> {toolCallCount}
          </Text>
        </Section>

        <Text style={paragraph}>
          The session was automatically terminated to prevent potential security
          risks. A scan has been triggered to re-evaluate the server&apos;s
          safety.
        </Text>

        <Section style={ctaSection}>
          <Button href={dashboardUrl} style={button}>
            Review in Dashboard
          </Button>
        </Section>
      </Section>
    </EmailLayout>
  );
};

export default SessionTerminatedEmail;

const emoji = { fontSize: "36px", textAlign: "center" as const, margin: "0 0 8px" };
const heading = { margin: "0 0 16px", fontSize: "20px", fontWeight: 700, color: "#18181b", textAlign: "center" as const };
const paragraph = { margin: "0 0 12px", fontSize: "14px", lineHeight: "1.5", color: "#52525b" };
const detailsBox = { margin: "16px 0", padding: "16px", backgroundColor: "#fef2f2", borderRadius: "6px", border: "1px solid #fecaca" };
const detailRow = { margin: "0 0 4px", fontSize: "13px", color: "#52525b" };
const ctaSection = { margin: "24px 0", textAlign: "center" as const };
const button = { backgroundColor: "#2563eb", borderRadius: "6px", color: "#ffffff", fontSize: "14px", fontWeight: 600, padding: "12px 24px", textDecoration: "none", textAlign: "center" as const, display: "inline-block" };
