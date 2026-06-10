import { Button, Section, Text } from "@react-email/components";
import * as React from "react";

import { EmailLayout } from "./components/email-layout";

interface UsageLimitReachedEmailProps {
  userName: string;
  planName: string;
  type: "scans" | "tool_calls";
  used: number;
  limit: number;
  overageRate: string;
  dashboardUrl?: string;
}

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mcpguardian.dev";

export const UsageLimitReachedEmail = ({
  userName,
  planName,
  type,
  used,
  limit,
  overageRate,
  dashboardUrl = `${baseUrl}/settings/billing`,
}: UsageLimitReachedEmailProps) => {
  const label = type === "scans" ? "scans" : "tool calls";

  return (
    <EmailLayout
      previewText={`You've reached your monthly ${label} limit`}
    >
      <Section>
        <Text style={emoji}>⚠️</Text>
        <Text style={heading}>Usage Limit Reached</Text>

        <Text style={paragraph}>
          Hi {userName}, your organization has reached the{" "}
          <strong>{limit.toLocaleString()}</strong> {label} limit included in
          your {planName} plan.
        </Text>

        <Section style={alertBox}>
          <Text style={alertText}>
            🚫 {used.toLocaleString()} / {limit.toLocaleString()} {label} used
          </Text>
          {overageRate !== "Blocked" && overageRate !== "Negotiated" && (
            <Text style={alertSubtext}>
              Additional usage will be billed at{" "}
              <strong>{overageRate}</strong>
            </Text>
          )}
          {overageRate === "Blocked" && (
            <Text style={alertSubtext}>
              Additional usage is blocked.{" "}
              <strong>Upgrade to continue scanning.</strong>
            </Text>
          )}
        </Section>

        <Section style={ctaSection}>
          <Button href={dashboardUrl} style={button}>
            Manage Plan
          </Button>
        </Section>
      </Section>
    </EmailLayout>
  );
};

export default UsageLimitReachedEmail;

const emoji = { fontSize: "32px", textAlign: "center" as const, margin: "0 0 8px" };
const heading = { margin: "0 0 16px", fontSize: "20px", fontWeight: 700, color: "#18181b", textAlign: "center" as const };
const paragraph = { margin: "0 0 12px", fontSize: "14px", lineHeight: "1.5", color: "#52525b" };
const alertBox = { margin: "16px 0", padding: "16px", backgroundColor: "#fef2f2", borderRadius: "6px", border: "1px solid #fecaca" };
const alertText = { margin: "0 0 4px", fontSize: "14px", fontWeight: 600, color: "#dc2626" };
const alertSubtext = { margin: 0, fontSize: "13px", color: "#52525b" };
const ctaSection = { margin: "24px 0", textAlign: "center" as const };
const button = { backgroundColor: "#2563eb", borderRadius: "6px", color: "#ffffff", fontSize: "14px", fontWeight: 600, padding: "12px 24px", textDecoration: "none", textAlign: "center" as const, display: "inline-block" };
