import { Button, Section, Text } from "@react-email/components";
import * as React from "react";

import { EmailLayout } from "./components/email-layout";

interface ReportReadyEmailProps {
  userName: string;
  reportType: string;
  reportId: string;
  downloadUrl?: string;
}

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mcpguardian.dev";

export const ReportReadyEmail = ({
  userName,
  reportType,
  reportId,
  downloadUrl = `${baseUrl}/api/compliance/reports/${reportId}/download`,
}: ReportReadyEmailProps) => {
  return (
    <EmailLayout
      previewText={`Your ${reportType} report is ready to download`}
    >
      <Section>
        <Text style={heading}>Report Ready</Text>

        <Text style={paragraph}>
          Hi {userName}, your <strong>{reportType}</strong> compliance report has
          been generated and is ready for download.
        </Text>

        <Section style={infoBox}>
          <Text style={infoText}>
            📄 Type: {reportType}
          </Text>
          <Text style={infoText}>
            🆔 Report ID: {reportId}
          </Text>
        </Section>

        <Text style={paragraph}>
          This report includes a detailed compliance assessment with control
          mappings, findings, and remediation recommendations suitable for
          auditors and compliance reviews.
        </Text>

        <Section style={ctaSection}>
          <Button href={downloadUrl} style={button}>
            Download Report
          </Button>
        </Section>

        <Text style={smallText}>
          Reports are available for 30 days. Download and archive for your records.
        </Text>
      </Section>
    </EmailLayout>
  );
};

export default ReportReadyEmail;

const heading = { margin: "0 0 16px", fontSize: "20px", fontWeight: 700, color: "#18181b" };
const paragraph = { margin: "0 0 12px", fontSize: "14px", lineHeight: "1.5", color: "#52525b" };
const infoBox = { margin: "16px 0", padding: "16px", backgroundColor: "#eff6ff", borderRadius: "6px", border: "1px solid #bfdbfe" };
const infoText = { margin: "0 0 4px", fontSize: "13px", color: "#1e40af" };
const ctaSection = { margin: "24px 0", textAlign: "center" as const };
const button = { backgroundColor: "#2563eb", borderRadius: "6px", color: "#ffffff", fontSize: "14px", fontWeight: 600, padding: "12px 24px", textDecoration: "none", textAlign: "center" as const, display: "inline-block" };
const smallText = { margin: "16px 0 0", fontSize: "11px", color: "#a1a1aa", textAlign: "center" as const };
