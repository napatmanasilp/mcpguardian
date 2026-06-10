import { Button, Section, Text } from "@react-email/components";
import * as React from "react";

import { EmailLayout } from "./components/email-layout";

interface OverageSummaryEmailProps {
  userName: string;
  planName: string;
  scanOverage: number;
  toolCallOverage: number;
  scanOverageCostUsd: number;
  toolCallOverageCostUsd: number;
  totalCostUsd: number;
  dashboardUrl?: string;
}

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mcpguardian.dev";

export const OverageSummaryEmail = ({
  userName,
  planName,
  scanOverage,
  toolCallOverage,
  scanOverageCostUsd,
  toolCallOverageCostUsd,
  totalCostUsd,
  dashboardUrl = `${baseUrl}/settings/billing`,
}: OverageSummaryEmailProps) => {
  return (
    <EmailLayout
      previewText={`Overage summary: $${totalCostUsd.toFixed(2)} in charges this week`}
    >
      <Section>
        <Text style={emoji}>💰</Text>
        <Text style={heading}>Overage Summary</Text>

        <Text style={paragraph}>
          Hi {userName}, here&apos;s your weekly overage summary for your{" "}
          {planName} plan.
        </Text>

        <Section style={summaryBox}>
          {scanOverage > 0 && (
            <Section style={row}>
              <Text style={rowLabel}>Scan overages</Text>
              <Text style={rowValue}>{scanOverage} scans — ${scanOverageCostUsd.toFixed(2)}</Text>
            </Section>
          )}
          {toolCallOverage > 0 && (
            <Section style={row}>
              <Text style={rowLabel}>Tool call overages</Text>
              <Text style={rowValue}>{toolCallOverage.toLocaleString()} calls — ${toolCallOverageCostUsd.toFixed(2)}</Text>
            </Section>
          )}
          <Section style={{ ...row, borderTop: "1px solid #e4e4e7", paddingTop: "8px", marginTop: "4px" }}>
            <Text style={{ ...rowLabel, fontWeight: 700 }}>Total this period</Text>
            <Text style={{ ...rowValue, fontWeight: 700 }}>
              ${totalCostUsd.toFixed(2)}
            </Text>
          </Section>
        </Section>

        <Text style={paragraph}>
          These charges will be applied to your next invoice. Consider upgrading
          to a higher plan to reduce overage costs.
        </Text>

        <Section style={ctaSection}>
          <Button href={dashboardUrl} style={button}>
            View Billing
          </Button>
        </Section>
      </Section>
    </EmailLayout>
  );
};

export default OverageSummaryEmail;

const emoji = { fontSize: "32px", textAlign: "center" as const, margin: "0 0 8px" };
const heading = { margin: "0 0 16px", fontSize: "20px", fontWeight: 700, color: "#18181b", textAlign: "center" as const };
const paragraph = { margin: "0 0 12px", fontSize: "14px", lineHeight: "1.5", color: "#52525b" };
const summaryBox = { margin: "16px 0", padding: "16px", backgroundColor: "#f4f4f5", borderRadius: "6px" };
const row = { margin: "0 0 4px", display: "flex" as const, justifyContent: "space-between" as const };
const rowLabel = { margin: 0, fontSize: "13px", color: "#52525b" };
const rowValue = { margin: 0, fontSize: "13px", color: "#18181b", fontFamily: "monospace" };
const ctaSection = { margin: "24px 0", textAlign: "center" as const };
const button = { backgroundColor: "#2563eb", borderRadius: "6px", color: "#ffffff", fontSize: "14px", fontWeight: 600, padding: "12px 24px", textDecoration: "none", textAlign: "center" as const, display: "inline-block" };
