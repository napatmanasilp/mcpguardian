import { Button, Link, Section, Text } from "@react-email/components";
import * as React from "react";

import { EmailLayout } from "./components/email-layout";

interface ThreatAlertEmailProps {
  userName: string;
  serverName: string;
  severity: "critical" | "high" | "medium";
  threatType: string;
  toolName: string;
  wasBlocked: boolean;
  description: string;
  dashboardUrl?: string;
}

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mcpguardian.dev";

export const ThreatAlertEmail = ({
  userName,
  serverName,
  severity,
  threatType,
  toolName,
  wasBlocked,
  description,
  dashboardUrl = `${baseUrl}/dashboard`,
}: ThreatAlertEmailProps) => {
  const severityColor =
    severity === "critical"
      ? "#dc2626"
      : severity === "high"
        ? "#ea580c"
        : "#ca8a04";

  const severityLabel = severity.charAt(0).toUpperCase() + severity.slice(1);

  return (
    <EmailLayout
      previewText={`[${severityLabel}] ${threatType} detected on ${serverName}`}
    >
      <Section>
        <Section style={{ ...severityBadge, backgroundColor: severityColor, marginBottom: "16px" }}>
          <Text style={severityText}>
            {wasBlocked ? "🚫" : "⚠️"} {severityLabel} {wasBlocked ? "Blocked" : "Alert"}
          </Text>
        </Section>

        <Text style={heading}>
          {severity === "critical"
            ? "Critical security threat detected"
            : "Security threat detected"}
        </Text>

        <Text style={paragraph}>
          MCPGuardian detected a <strong>{threatType}</strong>{" "}
          {wasBlocked ? "and blocked it" : "on"} <strong>{serverName}</strong>.
        </Text>

        <Section style={detailsBox}>
          <Text style={detailRow}>
            <strong>Server:</strong> {serverName}
          </Text>
          <Text style={detailRow}>
            <strong>Threat:</strong> {threatType}
          </Text>
          <Text style={detailRow}>
            <strong>Tool:</strong> {toolName}
          </Text>
          <Text style={detailRow}>
            <strong>Action:</strong> {wasBlocked ? "Blocked" : "Logged"}
          </Text>
        </Section>

        <Text style={paragraph}>{description}</Text>

        <Section style={ctaSection}>
          <Button href={dashboardUrl} style={button}>
            Investigate in Dashboard
          </Button>
        </Section>

        {!wasBlocked && (
          <Text style={smallText}>
            Tip: Enable Block Mode to automatically block these threats in the
            future.
          </Text>
        )}
      </Section>
    </EmailLayout>
  );
};

export default ThreatAlertEmail;

const severityBadge = { display: "inline-block", padding: "4px 16px", borderRadius: "999px" };
const severityText = { margin: 0, color: "#ffffff", fontSize: "12px", fontWeight: 600 };
const heading = { margin: "0 0 12px", fontSize: "18px", fontWeight: 700, color: "#18181b" };
const paragraph = { margin: "0 0 12px", fontSize: "14px", lineHeight: "1.5", color: "#52525b" };
const detailsBox = { margin: "16px 0", padding: "16px", backgroundColor: "#fef2f2", borderRadius: "6px", border: "1px solid #fecaca" };
const detailRow = { margin: "0 0 4px", fontSize: "13px", color: "#52525b" };
const ctaSection = { margin: "24px 0", textAlign: "center" as const };
const button = { backgroundColor: "#2563eb", borderRadius: "6px", color: "#ffffff", fontSize: "14px", fontWeight: 600, padding: "12px 24px", textDecoration: "none", textAlign: "center" as const, display: "inline-block" };
const smallText = { margin: "16px 0 0", fontSize: "11px", color: "#a1a1aa", textAlign: "center" as const };
