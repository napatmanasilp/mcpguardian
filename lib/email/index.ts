import { render } from "@react-email/components";
import { Resend } from "resend";
import React, { type ComponentType } from "react";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_ADDRESS =
  process.env.NODE_ENV === "production"
    ? "MCPGuardian Alerts <alerts@mcpguardian.dev>"
    : "onboarding@resend.dev";

// ─── Generic Send Email ────────────────────────────────────────────────

interface SendEmailProps<T> {
  /** The React Email template component */
  template: ComponentType<T>;
  /** Props to pass to the template */
  props: T;
  /** Recipient email address(es) */
  to: string | string[];
  /** Email subject line */
  subject: string;
  /** Optional reply-to address */
  replyTo?: string;
}

/**
 * Send an email using a React Email template.
 *
 * Usage:
 * ```ts
 * await sendEmail({
 *   template: WelcomeEmail,
 *   props: { userName: "Alice" },
 *   to: "alice@example.com",
 *   subject: "Welcome to MCPGuardian!",
 * });
 * ```
 */
export async function sendEmail<T>(
  opts: SendEmailProps<T>,
): Promise<void> {
  if (!resend) {
    console.warn("Resend not configured: RESEND_API_KEY is missing");
    return;
  }

  try {
    const { template, props, to, subject, replyTo } = opts;

    const html = await render(
      React.createElement(
        template as ComponentType<Record<string, unknown>>,
        props as Record<string, unknown>,
      ),
    );

    await resend.emails.send({
      from: FROM_ADDRESS,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
  } catch (error) {
    console.error("Failed to send email:", error);
  }
}

// ─── Legacy Alert Email (keep for backward compat) ──────────────────────

interface AlertEmailParams {
  to: string;
  monitorName: string;
  alertType: "score_drop" | "new_critical" | "failing_grade";
  severity: "critical" | "high" | "medium";
  grade: string;
  score: number;
  issuesSummary: string;
}

function buildSubject(params: AlertEmailParams): string {
  switch (params.alertType) {
    case "score_drop":
      return `\u26A0\uFE0F Score Drop: ${params.monitorName} dropped to ${params.grade} (${params.score}/100)`;
    case "new_critical":
      return `\uD83D\uDD34 Critical Issue Found: ${params.monitorName}`;
    case "failing_grade":
      return `\u274C Failing Grade: ${params.monitorName} scored ${params.grade} (${params.score}/100)`;
    default:
      return `Alert: ${params.monitorName}`;
  }
}

function buildSeverityBadge(severity: string): string {
  const colors: Record<string, string> = {
    critical: "#dc2626",
    high: "#ea580c",
    medium: "#ca8a04",
  };
  const bg = colors[severity] ?? "#6b7280";
  return `<span style="display:inline-block;background:${bg};color:white;font-size:12px;font-weight:600;padding:2px 10px;border-radius:999px;text-transform:uppercase">${severity.charAt(0).toUpperCase() + severity.slice(1)}</span>`;
}

function buildHtmlEmail(params: AlertEmailParams): string {
  const appUrl =
    process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table align="center" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;margin:24px auto;background:#ffffff;border-radius:8px;overflow:hidden">
<tr>
<td style="padding:32px 24px 16px;text-align:center;border-bottom:1px solid #e4e4e7">
<h1 style="margin:0;font-size:20px;font-weight:700;color:#18181b">MCPGuardian Security Alert</h1>
</td>
</tr>
<tr>
<td style="padding:24px">
<div style="margin-bottom:16px">${buildSeverityBadge(params.severity)}</div>
<p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#18181b">${params.monitorName}</p>
<p style="margin:0 0 4px;font-size:14px;color:#52525b">Current grade: <strong>${params.grade}</strong></p>
<p style="margin:0 0 16px;font-size:14px;color:#52525b">Score: <strong>${params.score}/100</strong></p>
<p style="margin:0 0 4px;font-size:14px;color:#18181b;font-weight:500">Issues Summary</p>
<p style="margin:0 0 24px;font-size:14px;color:#52525b;line-height:1.5">${params.issuesSummary}</p>
<table cellpadding="0" cellspacing="0">
<tr>
<td style="background:#2563eb;border-radius:6px;padding:0">
<a href="${appUrl}/dashboard" style="display:inline-block;padding:10px 20px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none">View Full Report &rarr;</a>
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="padding:16px 24px;background:#f4f4f5;text-align:center">
<p style="margin:0;font-size:12px;color:#71717a">You're receiving this because you have active monitoring on MCPGuardian.</p>
</td>
</tr>
</table>
</body>
</html>`;
}

export async function sendAlertEmail(params: AlertEmailParams): Promise<void> {
  if (!resend) {
    console.warn("Resend not configured: RESEND_API_KEY is missing");
    return;
  }

  try {
    await resend.emails.send({
      from: FROM_ADDRESS,
      to: params.to,
      subject: buildSubject(params),
      html: buildHtmlEmail(params),
    });
  } catch (error) {
    console.error("Failed to send alert email:", error);
  }
}
