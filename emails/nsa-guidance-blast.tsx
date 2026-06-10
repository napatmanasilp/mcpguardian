import { Button, Link, Section, Text } from "@react-email/components";
import * as React from "react";

import { EmailLayout } from "./components/email-layout";

interface NSAGuidanceBlastEmailProps {
  userName: string;
  planName: string;
  hasComplianceAccess: boolean;
  upgradeUrl?: string;
  complianceUrl?: string;
}

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mcpguardian.dev";

export const NSAGuidanceBlastEmail = ({
  userName,
  planName,
  hasComplianceAccess,
  upgradeUrl = `${baseUrl}/upgrade`,
  complianceUrl = `${baseUrl}/nsa-mcp-compliance`,
}: NSAGuidanceBlastEmailProps) => {
  return (
    <EmailLayout
      previewText="The NSA just published MCP security requirements — here's what it means for you"
    >
      <Section>
        <Text style={emoji}>🏛️</Text>
        <Text style={heading}>
          The NSA published MCP Security Guidance
        </Text>

        <Text style={paragraph}>
          Hi {userName},
        </Text>

        <Text style={paragraph}>
          The National Security Agency&apos;s AI Security Center has published{" "}
          <strong>Cybersecurity Information Sheet U/OO/6030316-26</strong> —
          the first formal security guidance for the Model Context Protocol
          (MCP).
        </Text>

        <Text style={subheading}>What the NSA says:</Text>

        <Text style={paragraph}>
          The NSA identifies ten critical controls for securing MCP deployments,
          including parameter validation, tool execution sandboxing, message
          signing, output filtering, comprehensive audit logging, and
          least-privilege access controls. Organizations using MCP — especially
          in regulated industries — should treat this guidance as a baseline
          requirement.
        </Text>

        <Text style={subheading}>How MCPGuardian addresses it:</Text>

        <Section style={complianceBox}>
          <Text style={complianceRow}>✅ Parameter validation — Active on all scans</Text>
          <Text style={complianceRow}>✅ Tool execution sandboxing — Docker sandbox active</Text>
          <Text style={complianceRow}>✅ Output filtering — Outbound response scanning active</Text>
          <Text style={complianceRow}>✅ Tool invocation logging — Immutable audit trail</Text>
          <Text style={complianceRow}>✅ Unauthorized server scanning — Allowlist + pipeline</Text>
          <Text style={complianceRow}>✅ Least-privilege tokens — Token guard per session</Text>
          <Text style={complianceRow}>🗺️ Message signing — Roadmap Q3 2026</Text>
        </Section>

        {hasComplianceAccess ? (
          <>
            <Text style={paragraph}>
              Your {planName} plan includes full NSA compliance reporting. View
              your organization&apos;s compliance status and download reports.
            </Text>
            <Section style={ctaSection}>
              <Button href={complianceUrl} style={button}>
                View Compliance Dashboard
              </Button>
            </Section>
          </>
        ) : (
          <>
            <Text style={paragraph}>
              NSA compliance reporting is available on Developer plans and
              above. Upgrade to access the compliance dashboard, downloadable
              reports, and full control mapping.
            </Text>
            <Section style={ctaSection}>
              <Button href={upgradeUrl} style={button}>
                Upgrade to Access Compliance
              </Button>
            </Section>
          </>
        )}

        <Text style={paragraph}>
          Read the full analysis:{" "}
          <Link href={complianceUrl} style={linkText}>
            MCPGuardian NSA Compliance Mapping
          </Link>
        </Text>
      </Section>
    </EmailLayout>
  );
};

export default NSAGuidanceBlastEmail;

const emoji = { fontSize: "36px", textAlign: "center" as const, margin: "0 0 8px" };
const heading = { margin: "0 0 16px", fontSize: "20px", fontWeight: 700, color: "#18181b", textAlign: "center" as const };
const subheading = { margin: "16px 0 8px", fontSize: "16px", fontWeight: 600, color: "#18181b" };
const paragraph = { margin: "0 0 12px", fontSize: "14px", lineHeight: "1.6", color: "#52525b" };
const complianceBox = { margin: "16px 0", padding: "16px", backgroundColor: "#f0fdf4", borderRadius: "6px", border: "1px solid #bbf7d0" };
const complianceRow = { margin: "0 0 4px", fontSize: "13px", color: "#166534" };
const ctaSection = { margin: "24px 0", textAlign: "center" as const };
const button = { backgroundColor: "#2563eb", borderRadius: "6px", color: "#ffffff", fontSize: "14px", fontWeight: 600, padding: "12px 24px", textDecoration: "none", textAlign: "center" as const, display: "inline-block" };
const linkText = { color: "#3b82f6", textDecoration: "underline" };
