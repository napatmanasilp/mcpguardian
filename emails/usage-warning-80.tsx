import { Button, Section, Text } from "@react-email/components";
import * as React from "react";

import { EmailLayout } from "./components/email-layout";

interface UsageWarning80EmailProps {
  userName: string;
  planName: string;
  type: "scans" | "tool_calls";
  used: number;
  limit: number;
  percentUsed: number;
  dashboardUrl?: string;
}

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mcpguardian.dev";

export const UsageWarning80Email = ({
  userName,
  planName,
  type,
  used,
  limit,
  percentUsed,
  dashboardUrl = `${baseUrl}/settings/billing`,
}: UsageWarning80EmailProps) => {
  const label = type === "scans" ? "scans" : "tool calls";

  return (
    <EmailLayout
      previewText={`You've used ${percentUsed}% of your monthly ${label}`}
    >
      <Section>
        <Text style={emoji}>📊</Text>
        <Text style={heading}>Usage Warning — {percentUsed}% Used</Text>

        <Text style={paragraph}>
          Hi {userName}, your organization has used{" "}
          <strong>{percentUsed}%</strong> of your {planName} plan&apos;s{" "}
          {label} limit this period.
        </Text>

        <Section style={meterBox}>
          <Section style={meterBar}>
            <Section
              style={{
                ...meterFill,
                width: `${Math.min(percentUsed, 100)}%`,
                backgroundColor: percentUsed >= 95 ? "#dc2626" : "#f59e0b",
              }}
            />
          </Section>
          <Text style={meterLabel}>
            {used.toLocaleString()} / {limit.toLocaleString()} {label}
          </Text>
        </Section>

        <Text style={paragraph}>
          {percentUsed >= 95
            ? "You're approaching your limit and overage charges will apply soon."
            : "Consider upgrading your plan or reviewing your usage to avoid reaching the limit."}
        </Text>

        <Section style={ctaSection}>
          <Button href={dashboardUrl} style={button}>
            View Usage
          </Button>
        </Section>
      </Section>
    </EmailLayout>
  );
};

export default UsageWarning80Email;

const emoji = { fontSize: "32px", textAlign: "center" as const, margin: "0 0 8px" };
const heading = { margin: "0 0 16px", fontSize: "20px", fontWeight: 700, color: "#18181b", textAlign: "center" as const };
const paragraph = { margin: "0 0 12px", fontSize: "14px", lineHeight: "1.5", color: "#52525b" };
const meterBox = { margin: "16px 0", padding: "16px", backgroundColor: "#fffbeb", borderRadius: "6px", border: "1px solid #fde68a" };
const meterBar = { height: "12px", backgroundColor: "#e4e4e7", borderRadius: "6px", overflow: "hidden" as const };
const meterFill = { height: "100%", borderRadius: "6px", transition: "width 0.3s" };
const meterLabel = { margin: "8px 0 0", fontSize: "12px", color: "#52525b", textAlign: "center" as const, fontFamily: "monospace" };
const ctaSection = { margin: "24px 0", textAlign: "center" as const };
const button = { backgroundColor: "#2563eb", borderRadius: "6px", color: "#ffffff", fontSize: "14px", fontWeight: 600, padding: "12px 24px", textDecoration: "none", textAlign: "center" as const, display: "inline-block" };
