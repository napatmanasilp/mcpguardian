import { Button, Section, Text } from "@react-email/components";
import * as React from "react";

import { EmailLayout } from "./components/email-layout";

interface PaymentFailedEmailProps {
  userName: string;
  planName: string;
  amountDueCents: number;
  dueDate: string;
  retryCount?: number;
  billingUrl?: string;
}

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mcpguardian.dev";

export const PaymentFailedEmail = ({
  userName,
  planName,
  amountDueCents,
  dueDate,
  retryCount = 0,
  billingUrl = `${baseUrl}/settings/billing`,
}: PaymentFailedEmailProps) => {
  const amountDue = (amountDueCents / 100).toFixed(2);

  return (
    <EmailLayout
      previewText="Payment failed — update your billing information to keep your plan active"
    >
      <Section>
        <Text style={emoji}>💳</Text>
        <Text style={heading}>Payment Failed</Text>

        <Text style={paragraph}>
          Hi {userName}, we were unable to process your {planName} plan
          payment of <strong>${amountDue}</strong>.
        </Text>

        <Section style={alertBox}>
          <Text style={alertText}>
            💳 Amount due: ${amountDue}
          </Text>
          <Text style={alertText}>
            📅 Due date: {dueDate}
          </Text>
          {retryCount > 0 && (
            <Text style={alertText}>
              🔄 Retries attempted: {retryCount}
            </Text>
          )}
        </Section>

        <Text style={paragraph}>
          {retryCount < 3
            ? "We'll automatically retry the payment. Please update your payment method to prevent service interruption."
            : "We've exhausted automatic retries. Please update your payment method immediately to keep your plan active."}
        </Text>

        <Section style={ctaSection}>
          <Button href={billingUrl} style={button}>
            Update Payment Method
          </Button>
        </Section>

        <Text style={smallText}>
          If payment is not resolved within 7 days, your plan may be downgraded
          to Free. Your data will not be deleted.
        </Text>
      </Section>
    </EmailLayout>
  );
};

export default PaymentFailedEmail;

const emoji = { fontSize: "32px", textAlign: "center" as const, margin: "0 0 8px" };
const heading = { margin: "0 0 16px", fontSize: "20px", fontWeight: 700, color: "#18181b", textAlign: "center" as const };
const paragraph = { margin: "0 0 12px", fontSize: "14px", lineHeight: "1.5", color: "#52525b" };
const alertBox = { margin: "16px 0", padding: "16px", backgroundColor: "#fef2f2", borderRadius: "6px", border: "1px solid #fecaca" };
const alertText = { margin: "0 0 4px", fontSize: "13px", color: "#52525b" };
const ctaSection = { margin: "24px 0", textAlign: "center" as const };
const button = { backgroundColor: "#dc2626", borderRadius: "6px", color: "#ffffff", fontSize: "14px", fontWeight: 600, padding: "12px 24px", textDecoration: "none", textAlign: "center" as const, display: "inline-block" };
const smallText = { margin: "16px 0 0", fontSize: "11px", color: "#a1a1aa", textAlign: "center" as const };
