import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface EmailLayoutProps {
  previewText: string;
  children: React.ReactNode;
  unsubscribeUrl?: string;
}

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://mcpguardian.dev";

export const EmailLayout = ({
  previewText,
  children,
  unsubscribeUrl,
}: EmailLayoutProps) => {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Img
              src={`${baseUrl}/logo.png`}
              width="40"
              height="40"
              alt="MCPGuardian"
              style={logo}
            />
            <Text style={brand}>
              MCP<span style={brandAccent}>Guardian</span>
            </Text>
          </Section>

          <Section style={content}>{children}</Section>

          <Hr style={hr} />

          <Section style={footer}>
            <Text style={footerText}>
              MCPGuardian — MCP Server Security Scanner
            </Text>
            <Text style={footerText}>
              <Link href={baseUrl} style={link}>
                mcpguardian.dev
              </Link>
            </Text>
            {unsubscribeUrl && (
              <Text style={footerSmall}>
                <Link href={unsubscribeUrl} style={link}>
                  Unsubscribe from these emails
                </Link>
              </Text>
            )}
            <Text style={footerSmall}>
              &copy; {new Date().getFullYear()} MCPGuardian. All rights
              reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────

const main = {
  margin: 0,
  padding: 0,
  backgroundColor: "#f4f4f5",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
};

const container = {
  maxWidth: "600px",
  margin: "24px auto",
  padding: "0",
  backgroundColor: "#ffffff",
  borderRadius: "8px",
  overflow: "hidden" as const,
};

const header = {
  padding: "24px 32px 16px",
  textAlign: "center" as const,
  borderBottom: "1px solid #e4e4e7",
};

const logo = {
  margin: "0 auto 8px",
};

const brand = {
  margin: 0,
  fontSize: "20px",
  fontWeight: 700,
  color: "#18181b",
};

const brandAccent = {
  color: "#3b82f6",
};

const content = {
  padding: "24px 32px",
};

const hr = {
  borderTop: "1px solid #e4e4e7",
  margin: "0",
};

const footer = {
  padding: "16px 32px",
  textAlign: "center" as const,
  backgroundColor: "#fafafa",
};

const footerText = {
  margin: "4px 0",
  fontSize: "12px",
  color: "#71717a",
};

const footerSmall = {
  margin: "2px 0",
  fontSize: "11px",
  color: "#a1a1aa",
};

const link = {
  color: "#3b82f6",
  textDecoration: "underline",
};
