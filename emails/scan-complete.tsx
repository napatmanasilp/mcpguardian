import { Button, Section, Text } from "@react-email/components";
import * as React from "react";

import { EmailLayout } from "./components/email-layout";

interface ScanCompleteEmailProps {
  userName: string;
  serverName: string;
  result: "clean" | "suspicious" | "malicious";
  riskScore: number;
  criticalIssues: number;
  highIssues: number;
  scanId: string;
  reportUrl?: string;
}

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mcpguardian.dev";

export const ScanCompleteEmail = ({
  userName,
  serverName,
  result,
  riskScore,
  criticalIssues,
  highIssues,
  scanId,
  reportUrl = `${baseUrl}/reports/${scanId}`,
}: ScanCompleteEmailProps) => {
  const isClean = result === "clean";
  const resultColor = isClean ? "#16a34a" : result === "suspicious" ? "#ea580c" : "#dc2626";
  const resultEmoji = isClean ? "✅" : result === "suspicious" ? "⚠️" : "🔴";

  // Only send for non-clean results
  if (isClean) return null;

  return (
    <EmailLayout
      previewText={`Scan complete for ${serverName}: ${result.toUpperCase()} (${riskScore}/100)`}
    >
      <Section>
        <Text style={{ ...resultBadge, backgroundColor: resultColor }}>
          <Text style={badgeText}>
            {resultEmoji} {result.toUpperCase()} — {riskScore}/100
          </Text>
        </Text>

        <Text style={heading}>
          Scan complete: {serverName}
        </Text>

        <Text style={paragraph}>
          The scan pipeline finished analyzing <strong>{serverName}</strong>{" "}
          with a risk score of <strong>{riskScore}/100</strong>{" "}
          ({result}).
        </Text>

        <Section style={summaryBox}>
          {criticalIssues > 0 && (
            <Text style={issueRow}>
              🔴 {criticalIssues} critical issue{criticalIssues !== 1 ? "s" : ""} found
            </Text>
          )}
          {highIssues > 0 && (
            <Text style={issueRow}>
              🟠 {highIssues} high issue{highIssues !== 1 ? "s" : ""} found
            </Text>
          )}
        </Section>

        <Section style={ctaSection}>
          <Button href={reportUrl} style={button}>
            View Full Report
          </Button>
        </Section>

        <Text style={smallText}>
          Recommended action: Review the findings and address critical issues before
          connecting this server to production.
        </Text>
      </Section>
    </EmailLayout>
  );
};

export default ScanCompleteEmail;

const resultBadge = { display: "inline-block", padding: "4px 16px", borderRadius: "999px", marginBottom: "12px" };
const badgeText = { margin: 0, color: "#ffffff", fontSize: "13px", fontWeight: 700 };
const heading = { margin: "0 0 12px", fontSize: "18px", fontWeight: 700, color: "#18181b" };
const paragraph = { margin: "0 0 12px", fontSize: "14px", lineHeight: "1.5", color: "#52525b" };
const summaryBox = { margin: "16px 0", padding: "16px", backgroundColor: "#fef2f2", borderRadius: "6px", border: "1px solid #fecaca" };
const issueRow = { margin: "0 0 4px", fontSize: "14px", color: "#52525b" };
const ctaSection = { margin: "24px 0", textAlign: "center" as const };
const button = { backgroundColor: "#2563eb", borderRadius: "6px", color: "#ffffff", fontSize: "14px", fontWeight: 600, padding: "12px 24px", textDecoration: "none", textAlign: "center" as const, display: "inline-block" };
const smallText = { margin: "16px 0 0", fontSize: "12px", color: "#71717a" };
