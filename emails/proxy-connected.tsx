import { Button, Link, Section, Text } from "@react-email/components";
import * as React from "react";

import { EmailLayout } from "./components/email-layout";

interface ProxyConnectedEmailProps {
  userName: string;
  serverName: string;
  dashboardUrl?: string;
}

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mcpguardian.dev";

export const ProxyConnectedEmail = ({
  userName,
  serverName,
  dashboardUrl = `${baseUrl}/dashboard`,
}: ProxyConnectedEmailProps) => {
  return (
    <EmailLayout
      previewText={`Proxy is now protecting ${serverName}`}
    >
      <Section>
        <Text style={emoji}>🛡️</Text>
        <Text style={heading}>Proxy Connected!</Text>

        <Text style={paragraph}>
          Great news, {userName}! MCPGuardian is now intercepting and inspecting
          all tool calls to <strong>{serverName}</strong> in real-time.
        </Text>

        <Section style={statsBox}>
          <Text style={statsText}>
            ✅ All tool invocations are being logged
          </Text>
          <Text style={statsText}>
            ✅ Token guard is scanning for credential leaks
          </Text>
          <Text style={statsText}>
            ✅ SSRF and injection attempts are being blocked
          </Text>
          <Text style={statsText}>
            ✅ Threat patterns are being analyzed in real-time
          </Text>
        </Section>

        <Text style={paragraph}>
          Your MCP server is now fully protected by both pre-connect scanning
          and runtime proxy interception — the complete MCPGuardian protection
          stack.
        </Text>

        <Section style={ctaSection}>
          <Button href={dashboardUrl} style={button}>
            View Dashboard
          </Button>
        </Section>

        <Text style={smallText}>
          Tip: Set up alert channels to receive notifications when threats are
          detected.
        </Text>
      </Section>
    </EmailLayout>
  );
};

export default ProxyConnectedEmail;

const emoji = { fontSize: "32px", textAlign: "center" as const, margin: "0 0 8px" };
const heading = { margin: "0 0 16px", fontSize: "20px", fontWeight: 700, color: "#18181b", textAlign: "center" as const };
const paragraph = { margin: "0 0 12px", fontSize: "14px", lineHeight: "1.6", color: "#52525b" };
const statsBox = { margin: "16px 0", padding: "16px", backgroundColor: "#f0fdf4", borderRadius: "6px", border: "1px solid #bbf7d0" };
const statsText = { margin: "0 0 6px", fontSize: "13px", color: "#166534", lineHeight: "1.5" };
const ctaSection = { margin: "24px 0", textAlign: "center" as const };
const button = { backgroundColor: "#2563eb", borderRadius: "6px", color: "#ffffff", fontSize: "14px", fontWeight: 600, padding: "12px 24px", textDecoration: "none", textAlign: "center" as const, display: "inline-block" };
const smallText = { margin: "16px 0 0", fontSize: "12px", color: "#a1a1aa", textAlign: "center" as const };
