import { Button, Link, Section, Text } from "@react-email/components";
import * as React from "react";

import { EmailLayout } from "./components/email-layout";

interface WelcomeEmailProps {
  userName: string;
  dashboardUrl?: string;
}

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mcpguardian.dev";

export const WelcomeEmail = ({
  userName,
  dashboardUrl = `${baseUrl}/dashboard`,
}: WelcomeEmailProps) => {
  return (
    <EmailLayout
      previewText="Welcome to MCPGuardian — secure your MCP servers in minutes"
    >
      <Section>
        <Text style={heading}>Welcome to MCPGuardian, {userName}!</Text>

        <Text style={paragraph}>
          You&apos;ve just taken the first step toward securing your Model
          Context Protocol infrastructure. MCPGuardian will scan, monitor, and
          protect your MCP servers from tool poisoning, credential leaks, and
          supply chain attacks.
        </Text>

        <Text style={subheading}>Get started in 3 steps:</Text>

        <Section style={stepCard}>
          <Text style={stepNumber}>1</Text>
          <Text style={stepText}>
            <strong>Register your first MCP server</strong> — Add your server
            configuration to start scanning.
          </Text>
        </Section>

        <Section style={stepCard}>
          <Text style={stepNumber}>2</Text>
          <Text style={stepText}>
            <strong>Review your scan results</strong> — Our pipeline checks
            against OWASP MCP Top 10, known CVEs, and runtime behaviors.
          </Text>
        </Section>

        <Section style={stepCard}>
          <Text style={stepNumber}>3</Text>
          <Text style={stepText}>
            <strong>Connect the proxy</strong> — Route your MCP client through
            MCPGuardian for real-time runtime protection.
          </Text>
        </Section>

        <Section style={ctaSection}>
          <Button href={dashboardUrl} style={button}>
            Go to Dashboard
          </Button>
        </Section>

        <Text style={paragraph}>
          Questions? Reply to this email or visit our{" "}
          <Link href={`${baseUrl}/docs`} style={linkText}>
            documentation
          </Link>
          .
        </Text>
      </Section>
    </EmailLayout>
  );
};

export default WelcomeEmail;

// ─── Styles ─────────────────────────────────────────────────────────────

const heading = {
  margin: "0 0 16px",
  fontSize: "22px",
  fontWeight: 700,
  color: "#18181b",
};

const subheading = {
  margin: "20px 0 12px",
  fontSize: "16px",
  fontWeight: 600,
  color: "#18181b",
};

const paragraph = {
  margin: "0 0 12px",
  fontSize: "14px",
  lineHeight: "1.6",
  color: "#52525b",
};

const stepCard = {
  margin: "0 0 8px",
  padding: "12px 16px",
  backgroundColor: "#f4f4f5",
  borderRadius: "6px",
  display: "flex" as const,
  gap: "12px",
};

const stepNumber = {
  margin: 0,
  fontSize: "14px",
  fontWeight: 700,
  color: "#3b82f6",
  minWidth: "20px",
};

const stepText = {
  margin: 0,
  fontSize: "14px",
  lineHeight: "1.5",
  color: "#52525b",
};

const ctaSection = {
  margin: "24px 0",
  textAlign: "center" as const,
};

const button = {
  backgroundColor: "#2563eb",
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: 600,
  padding: "12px 24px",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
};

const linkText = {
  color: "#3b82f6",
  textDecoration: "underline",
};
