# Requirements Document

## Introduction

MCPGuardian is an MCP (Model Context Protocol) server security platform built on Next.js 15 App Router, Supabase Auth, shadcn/ui, and Tailwind CSS. Following a full application audit, a comprehensive set of UX improvements has been identified spanning critical bug fixes, high-priority UX enhancements, and medium/low-priority polish. This document captures all improvements as structured requirements organized by priority and page/flow area.

The stack context for all requirements:
- Pages live in `app/(app)/` with shared layout at `app/(app)/layout.tsx`
- Auth pages live in `app/(auth)/`
- API routes at `app/api/`
- Component library in `components/`
- Dark theme with design tokens: `--bg-surface`, `--secure`, `--threat`, `--caution`, `--monitor`

---

## Glossary

- **MCPGuardian**: The MCP server security platform being improved.
- **Login_Page**: The page at `app/(auth)/login/page.tsx` rendered via `LoginForm` component.
- **Signup_Page**: The page at `app/(auth)/signup/page.tsx` rendered via `SignupForm` component.
- **Password_Reset_Flow**: The forgot-password email + reset sequence handled by Supabase Auth.
- **OAuth_Provider**: An external identity provider (GitHub or Google) used for social sign-in via `supabase.auth.signInWithOAuth`.
- **Password_Strength_Meter**: A visual indicator showing password strength (weak / fair / strong) computed from entropy rules.
- **Onboarding_Step1**: The page at `app/(app)/onboarding/page.tsx` — org creation + MCP server scan.
- **Onboarding_Step2**: The page at `app/(app)/onboarding/proxy-setup/page.tsx` — proxy connection.
- **Onboarding_Step3**: The page at `app/(app)/onboarding/confirmed/page.tsx` — confirmation screen.
- **Stepper**: The `OnboardingSteps` component showing progress through onboarding.
- **Dashboard_Page**: The page at `app/(app)/dashboard/page.tsx`.
- **Alerts_Page**: The page at `app/(app)/alerts/page.tsx`.
- **Servers_Page**: The page at `app/(app)/servers/page.tsx`.
- **Server_Detail_Page**: The page at `app/(app)/servers/[serverId]/page.tsx`.
- **Activity_Page**: The page at `app/(app)/activity/page.tsx` (also called Threat Log).
- **Compliance_Page**: The page at `app/(app)/compliance/page.tsx`.
- **Telemetry_Page**: The page at `app/(app)/telemetry/page.tsx`.
- **Sessions_Page**: The page at `app/(app)/sessions/page.tsx`.
- **General_Settings_Page**: The page at `app/(app)/settings/general/page.tsx`.
- **Billing_Settings_Page**: The page at `app/(app)/settings/billing/page.tsx`.
- **Upgrade_Page**: The page at `app/(app)/upgrade/page.tsx`.
- **Server_Action**: A Next.js server action (inline `"use server"` function or imported action).
- **Quick_Actions_Bar**: A horizontal strip of shortcut buttons on the Dashboard.
- **NSA_Compliance_Teaser**: The locked compliance panel shown to free-tier users on the Dashboard.
- **Add_Server_Modal**: A lightweight modal at `/servers/new` for adding a server without re-running onboarding org creation.
- **Rug_Pull**: A session termination reason indicating the MCP server attempted unauthorized data exfiltration; stored as `terminated_rug_pull` in `proxy_sessions.status`.
- **Compliance_Score**: The computed percentage of active NSA controls shown on the Compliance_Page, excluding Roadmap_Control items.
- **Roadmap_Control**: An NSA or OWASP compliance control whose implementation is scheduled for a future release date, identified by `defaultStatus: "roadmap"` in the control definition.
- **PDF_Report**: A downloadable compliance assessment PDF for an organization.
- **Sparkline**: A small inline chart rendered left-to-right (oldest to newest) showing a latency trend over time.
- **Uptime_Percentage**: The ratio of reachable health checks to total health checks for a server over the most recent 30 days, displayed as a percentage rounded to one decimal place.
- **CSV_Export**: A downloadable comma-separated-values file of event data with ISO 8601 UTC timestamps.
- **Invoice_History**: A list of past billing invoices with date, amount, status, and download link.
- **Feature_Comparison_Table**: A detailed side-by-side matrix of features per pricing plan.
- **Contact_Page**: A dedicated page at `/contact` for Enterprise inquiries, displaying an inquiry form or embedded Calendly widget.
- **Social_Proof**: Testimonials, customer logos, or aggregate usage statistics displayed on the Upgrade_Page.

---

## Requirements

---

## CRITICAL BUG FIXES

---

### Requirement 1: Forgot Password Flow

**User Story:** As a user who has forgotten their password, I want a "Forgot password?" link on the login page and a complete reset flow, so that I can regain access to my account without contacting support.

#### Acceptance Criteria

1. THE Login_Page SHALL display a "Forgot password?" link visually positioned beneath the password input field.
2. WHEN a user clicks the "Forgot password?" link, THE Login_Page SHALL navigate the user to `/forgot-password`.
3. WHEN a user submits a valid email address on the forgot-password page, THE Password_Reset_Flow SHALL send a password reset email and display a success confirmation message on that same page.
4. WHEN a user submits an email address that is not registered, THE Password_Reset_Flow SHALL display the same success confirmation message as a valid email submission to prevent email enumeration.
5. WHEN a user follows the reset link from their email and lands on `/reset-password`, THE Password_Reset_Flow SHALL display a form with a new password field and a confirm-password field.
6. WHEN a user submits matching passwords of at least 8 characters on the reset-password page, THE Password_Reset_Flow SHALL update the user's password and redirect to `/dashboard`.
7. WHEN the new-password and confirm-password values do not match on submission, THE Password_Reset_Flow SHALL display an inline error beneath the confirm-password field and SHALL NOT submit the form.
8. IF the password reset link is expired or invalid when the user lands on `/reset-password`, THEN THE Password_Reset_Flow SHALL display an error message and render a link to `/forgot-password`.

---

### Requirement 2: Organization Name Save Action

**User Story:** As an organization admin, I want the "Save" button on the General Settings page to persist my organization name, so that my changes are actually applied.

#### Acceptance Criteria

1. THE General_Settings_Page SHALL wrap the organization name input and Save button inside a `<form>` element bound to a Server_Action.
2. WHEN an authenticated organization member with admin or owner role submits the organization name form with a non-empty string of 1–100 characters, THE Server_Action SHALL update the `name` column on the `organizations` table for that organization.
3. WHEN the Server_Action completes successfully, THE General_Settings_Page SHALL display a success toast and retain the saved name in the input field.
4. IF the Server_Action fails due to a database error or validation failure, THEN THE General_Settings_Page SHALL display an error toast describing the failure and SHALL NOT clear the input field.
5. WHILE the Server_Action is pending, THE General_Settings_Page SHALL disable the Save button and render a loading spinner in place of the button label.

---

### Requirement 3: Alert Navigation to Related Context

**User Story:** As a security analyst, I want to click an alert and navigate to the related session or server, so that I can investigate the security event in full context.

#### Acceptance Criteria

1. WHEN a user clicks an alert row on the Alerts_Page, THE Alerts_Page SHALL first mark the alert as read, then navigate the user to the most relevant detail page.
2. IF the alert record contains a non-null `session_id`, THEN THE Alerts_Page SHALL navigate to `/sessions/{session_id}`.
3. IF the alert record has a null `session_id` and a non-null `server_id`, THEN THE Alerts_Page SHALL navigate to `/servers/{server_id}`.
4. IF the alert record has both `session_id` and `server_id` as null, THEN THE Alerts_Page SHALL navigate to `/activity`.
5. IF the `session_id` or `server_id` referenced in an alert no longer exists in the database, THEN THE Alerts_Page SHALL navigate to `/activity` as a fallback.
6. WHEN a user navigates back to the Alerts_Page via the browser back button, THE Alerts_Page SHALL display the same severity and read/unread filter values that were active before navigation, as encoded in the URL query parameters.

---

### Requirement 4: Server Detail Scan Link Route

**User Story:** As a security user, I want scan links on the Server Detail page to navigate to a valid report page, so that clicking a scan result does not produce a 404 error.

#### Acceptance Criteria

1. WHEN a user clicks a scan row on the Server_Detail_Page, THE Server_Detail_Page SHALL navigate to `/reports/{scan_id}`.
2. THE `/reports/[scanId]` route SHALL exist as a valid Next.js App Router page that renders scan report data for the given `scanId`.
3. IF a scan record with the given `scanId` does not exist or does not belong to the user's organization, THEN the report page SHALL display a not-found message and a link back to `/servers/{serverId}/scans`.
4. THE Server_Detail_Page SHALL display only the 5 most recent scans in the recent scans list.

---

## HIGH PRIORITY UX

---

### Requirement 5: Signup Page Improvements

**User Story:** As a new user, I want a streamlined signup experience with Google and GitHub OAuth, password strength feedback instead of a confirm-password field, and a terms of service link, so that account creation is faster and more trustworthy.

#### Acceptance Criteria

1. WHEN a user clicks "Sign up with Google" on the Signup_Page, THE Signup_Page SHALL initiate Google OAuth sign-in and redirect to `/onboarding` on success.
2. WHEN a user clicks "Sign up with GitHub" on the Signup_Page, THE Signup_Page SHALL initiate GitHub OAuth sign-in and redirect to `/onboarding` on success.
3. THE Signup_Page SHALL NOT display a confirm-password input field in the email/password signup form.
4. WHEN a user types in the password field, THE Password_Strength_Meter SHALL display exactly three labeled levels: "Weak" (red), "Fair" (yellow), and "Strong" (green).
5. WHEN the password field contains fewer than 8 characters, THE Password_Strength_Meter SHALL display the "Weak" level.
6. WHEN the password contains 8 or more characters but does not contain at least one uppercase letter, one lowercase letter, and one digit (0–9) or non-alphanumeric printable ASCII character, THE Password_Strength_Meter SHALL display the "Fair" level.
7. WHEN the password contains 8 or more characters and contains at least one uppercase letter, one lowercase letter, and one digit (0–9) or non-alphanumeric printable ASCII character, THE Password_Strength_Meter SHALL display the "Strong" level.
8. THE Signup_Page SHALL display a "Terms of Service" link that opens `/terms` in a new browser tab.
9. WHEN a user submits the email/password form with a password that displays the "Weak" level, THE Signup_Page SHALL display an inline error beneath the password field and SHALL NOT submit the form.

---

### Requirement 6: Onboarding Step 1 — Split Form and Scan, Add Step Labels

**User Story:** As a new user going through onboarding, I want the org-creation form and the scan progress shown on separate screens with labeled steps, so that the onboarding flow feels clear and uncluttered.

#### Acceptance Criteria

1. THE Onboarding_Step1 SHALL render the organization name and MCP server registration form as a standalone screen with no scan progress UI visible.
2. WHEN a user submits the registration form, THE Onboarding_Step1 SHALL transition to a scan-progress screen; the form fields SHALL NOT be visible on the scan-progress screen.
3. THE Stepper SHALL display exactly four labeled steps in order: "Create Org" (index 0), "Scan Server" (index 1), "Connect Proxy" (index 2), "Done" (index 3).
4. THE Stepper SHALL render the active step with a filled or highlighted indicator, completed steps with a checkmark icon, and upcoming steps with an unfilled indicator, using the app's `--secure` and `--monitor` design tokens for active/completed states.
5. WHEN the registration form screen is active, THE Stepper SHALL highlight only step index 0 ("Create Org") as active.
6. WHEN the scan-progress screen is active, THE Stepper SHALL highlight only step index 1 ("Scan Server") as active.
7. IF form submission fails due to a server error, THEN THE Onboarding_Step1 SHALL remain on the form screen, display an error message, and re-enable the submit button.

---

### Requirement 7: Onboarding Step 2 — Client-Specific Instructions and Debug Checklist

**User Story:** As a developer connecting my AI agent, I want the proxy setup page to show client-specific copy/paste instructions when I select my MCP client, and a helpful debug checklist when the connection times out, so that I can complete setup without leaving the page to search documentation.

#### Acceptance Criteria

1. THE Onboarding_Step2 SHALL display exactly four mutually exclusive client tabs: "Claude Desktop", "Cursor", "Cline", and "Custom". Selecting one tab SHALL hide the content panels of all other tabs.
2. THE Onboarding_Step2 SHALL default to the "Claude Desktop" tab as the selected tab on first render.
3. WHEN the "Claude Desktop" tab is selected, THE Onboarding_Step2 SHALL display instructions specifying that the user must edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows) and add the MCPGuardian proxy URL under the `mcpServers` key.
4. WHEN the "Cursor" tab is selected, THE Onboarding_Step2 SHALL display instructions specifying that the user must open Cursor Settings → MCP, add a new server entry, and paste the proxy URL and Authorization header into the corresponding fields.
5. WHEN the "Cline" tab is selected, THE Onboarding_Step2 SHALL display instructions specifying that the user must open Cline's MCP Servers panel, click "Add Server", set transport to HTTP, and paste the proxy URL and bearer token.
6. WHEN the "Custom" tab is selected, THE Onboarding_Step2 SHALL display generic JSON configuration showing the `url` and `headers.Authorization` fields, applicable to any MCP client supporting HTTP transport with Bearer token authentication.
7. WHEN the connection status transitions to "timeout" (3 minutes elapsed without a detected tool call), THE Onboarding_Step2 SHALL display a debug checklist containing exactly these four items: (a) "Verify the proxy URL in your config matches the URL shown above", (b) "Confirm the Authorization header contains your full bearer token", (c) "Restart your MCP client after saving the config", (d) "Check that your firewall allows outbound HTTPS on port 443".

---

### Requirement 8: Onboarding Step 3 — "What Now?" Next Steps and Success Animation

**User Story:** As a user who has just completed proxy setup, I want to see a success animation and clear next steps for what to do in the product, so that I feel oriented and motivated to explore the platform.

#### Acceptance Criteria

1. WHEN the `proxy` query parameter equals "connected" on the Onboarding_Step3 page, THE Onboarding_Step3 SHALL render a visible success animation that completes at least one full cycle within 2 seconds of mount.
2. THE Onboarding_Step3 SHALL always display a "What now?" section containing exactly three next-step action cards regardless of the `proxy` query parameter value.
3. THE three next-step cards SHALL be labeled: "View scan report", "Add another server", and "Invite a teammate".
4. WHEN a user clicks "View scan report", THE Onboarding_Step3 SHALL navigate to `/reports/{scanId}` where `scanId` is the most recent scan for the organization ordered by `created_at` descending.
5. IF no scan exists for the organization when a user clicks "View scan report", THEN THE Onboarding_Step3 SHALL navigate to `/servers`.
6. WHEN a user clicks "Add another server", THE Onboarding_Step3 SHALL navigate to `/servers/new`.
7. WHEN a user clicks "Invite a teammate", THE Onboarding_Step3 SHALL navigate to `/settings/team`.

---

### Requirement 9: Dashboard — Quick Actions, NSA Compliance Teaser, Threat Count Link

**User Story:** As a returning user on the dashboard, I want quick-action shortcuts, a meaningful NSA compliance teaser for my free plan, and the threat count to link directly to Alerts, so that I can take action faster from the dashboard.

#### Acceptance Criteria

1. THE Dashboard_Page SHALL display a Quick_Actions_Bar containing exactly three buttons: "Scan Now", "Add Server", and "View Alerts".
2. WHEN a user clicks "Scan Now" and at least one server exists for the organization, THE Dashboard_Page SHALL navigate to the most recently created server's detail page at `/servers/{serverId}`.
3. IF no servers exist for the organization when a user clicks "Scan Now", THEN THE Dashboard_Page SHALL navigate to `/servers/new`.
4. WHEN a user clicks "Add Server" in the Quick_Actions_Bar, THE Dashboard_Page SHALL navigate to `/servers/new`.
5. WHEN a user clicks "View Alerts" in the Quick_Actions_Bar, THE Dashboard_Page SHALL navigate to `/alerts`.
6. WHILE the organization's `plan_id` equals "free", THE Dashboard_Page SHALL display the NSA_Compliance_Teaser panel containing: (a) the text "NSA MCP Security CSI — 8 controls", (b) an "Upgrade to unlock full compliance reporting" CTA button, and (c) a link to `/upgrade`.
7. WHEN the organization's `plan_id` does not equal "free", THE Dashboard_Page SHALL NOT display the NSA_Compliance_Teaser panel.
8. WHEN `threatCount` is greater than zero in the status strip, THE Dashboard_Page SHALL render the threat count as a `<Link>` element navigating to `/alerts?severity=critical`.
9. WHEN `threatCount` equals zero, THE Dashboard_Page SHALL render the threat count as non-interactive plain text.

---

### Requirement 10: Servers Page — Inline Rescan and Lightweight Add-Server Modal

**User Story:** As a user managing my servers, I want to rescan individual servers without leaving the list, and add new servers without re-running the full onboarding org-creation flow, so that day-to-day server management is fast and uninterrupted.

#### Acceptance Criteria

1. THE Servers_Page SHALL display a "Rescan" button on each server row in both list view and grid view.
2. WHEN a user clicks "Rescan" on a server row, THE Servers_Page SHALL call the scan API for that server and display a spinner on that specific row while the scan is in progress; the "Rescan" button SHALL be disabled for that row during the scan.
3. WHEN a rescan completes successfully, THE Servers_Page SHALL update that server row's `last_scan_at` timestamp and `risk_score` value in the UI without a full page reload.
4. IF a rescan fails, THE Servers_Page SHALL re-enable the "Rescan" button, remove the spinner, and display an error message on the server row.
5. THE Servers_Page SHALL display an "Add Server" button in the page header that navigates to `/servers/new`.
6. THE `/servers/new` page SHALL render a form collecting only: server name (required, 1–253 characters), transport type (HTTP or STDIO), and either endpoint URL (for HTTP) or STDIO command (for STDIO).
7. THE `/servers/new` page SHALL NOT display an organization name field or any organization creation step.
8. WHEN a user submits the `/servers/new` form with valid inputs, THE form SHALL register the server under the user's existing organization and trigger an initial scan, then redirect to `/servers`.
9. IF submission of the `/servers/new` form fails, THE form SHALL remain open, retain all entered field values, and display an error message above the submit button.

---

## MEDIUM PRIORITY

---

### Requirement 11: Activity / Threat Log — Pagination, Event Links, CSV Export, and Consistent Naming

**User Story:** As a security analyst reviewing threat events, I want to load more events, click through to the originating session and server, export events to CSV, and see a consistent page title, so that my investigation workflow is complete within the Threat Log page.

#### Acceptance Criteria

1. THE Activity_Page SHALL display the heading "Threat Log" on the page and the browser tab title SHALL be "Threat Log — MCPGuardian".
2. THE Activity_Page sidebar navigation label SHALL read "Threat Log".
3. IF the total number of events for the organization exceeds 50, THEN THE Activity_Page SHALL display a "Load more" button below the event list.
4. IF the total number of events for the organization is 50 or fewer, THEN THE Activity_Page SHALL NOT display a "Load more" button.
5. WHEN a user clicks "Load more", THE Activity_Page SHALL fetch the next 50 events (ordered by `created_at` descending, offset by the current count) and append them to the existing list without clearing already-loaded events.
6. WHEN an event row has a non-null `session_id`, THE Activity_Page SHALL render that event row as a link to `/sessions/{session_id}`.
7. WHEN an event row has a null `session_id` and a non-null `mcp_server_id`, THE Activity_Page SHALL render that event row as a link to `/servers/{mcp_server_id}`.
8. WHEN an event row has both `session_id` and `mcp_server_id` as null, THE Activity_Page SHALL render that event row as non-interactive (no link wrapping).
9. THE Activity_Page SHALL display an "Export CSV" button in the page header.
10. WHEN a user clicks "Export CSV", THE Activity_Page SHALL download a file named `threat-log-{YYYY-MM-DD}.csv` containing all currently loaded events with columns: `id`, `type`, `title`, `description`, `severity`, `session_id`, `server_id`, `created_at` (ISO 8601 UTC format).

---

### Requirement 12: Compliance Page — Roadmap Items, OWASP Tab, PDF Request Button

**User Story:** As a compliance officer, I want roadmap items excluded from my compliance score, an OWASP MCP Top 10 framework tab, and a button to request a PDF report, so that my compliance view accurately reflects implemented controls and supports audit workflows.

#### Acceptance Criteria

1. THE Compliance_Score SHALL be computed as `(passed_non_roadmap_controls / total_non_roadmap_controls) * 100`, excluding all Roadmap_Control items from both numerator and denominator.
2. THE Compliance_Page SHALL display all Roadmap_Control items in a visually distinct "Coming Soon" section, separated from the active controls list, each with a badge showing its scheduled delivery date (e.g., "Q3 2026").
3. THE Compliance_Page SHALL display two framework selection tabs: "NSA MCP CSI" and "OWASP MCP Top 10".
4. WHEN the "NSA MCP CSI" tab is active, THE Compliance_Page SHALL display the NSA control list with the current pass/fail status for each control.
5. WHEN the "OWASP MCP Top 10" tab is active, THE Compliance_Page SHALL display the 10 OWASP MCP risk categories (MCP01–MCP10) with a pass/fail badge for each.
6. THE "NSA MCP CSI" tab SHALL be active by default on first render.
7. THE Compliance_Page SHALL display a "Request PDF Report" button in the score card column.
8. WHEN a user clicks "Request PDF Report" and no PDF generation is in progress, THE Compliance_Page SHALL call a Server_Action to enqueue PDF generation and display a confirmation message: "Your report is being generated and will appear in the Reports section within a few minutes."
9. WHEN a user clicks "Request PDF Report" while a PDF generation request is already pending, THE Compliance_Page SHALL disable the button and display "Generating…" as the button label.

---

### Requirement 13: Telemetry Page — Latency Sparklines, Per-Server Uptime, Full Log Link

**User Story:** As an infrastructure engineer monitoring MCP server health, I want latency trend charts per server, per-server uptime percentages, and a direct link to the full activity log, so that I can assess server health at a glance.

#### Acceptance Criteria

1. THE Telemetry_Page SHALL display a Sparkline chart per server row, rendered left-to-right with the oldest data point on the left and the newest on the right, based on the most recent 24 `server_health_metrics` records ordered by `recorded_at` ascending.
2. THE Telemetry_Page SHALL display an Uptime_Percentage per server computed as `ROUND((reachable_count / total_count) * 100, 1)` where `reachable_count` is the count of records with `is_reachable = true` and `total_count` is the total count of records, both within the most recent 30 days of `server_health_metrics` for that server.
3. IF `total_count` equals zero for a given server, THEN the Uptime_Percentage SHALL be displayed as "—" to avoid division by zero.
4. IF a server has fewer than 5 `server_health_metrics` records in total, THEN THE Telemetry_Page SHALL display "Insufficient data" in place of both the Sparkline and the Uptime_Percentage for that server.
5. THE Telemetry_Page SHALL display a "View full log →" link positioned in the page header row that navigates to `/activity`.

---

### Requirement 14: Sessions Page — Date Range Filter, Rug Pull Tooltip, Tool Call Count Header

**User Story:** As a security analyst reviewing sessions, I want to filter by date range, understand what "rug pull" means, and see the total tool call count in the header, so that my investigation is time-scoped and terminology is clear.

#### Acceptance Criteria

1. THE Sessions_Page SHALL display a date range filter with two date inputs labeled "From" and "To" positioned above the session list.
2. WHEN a user sets both "From" and "To" dates and the page reloads or the filter is applied, THE Sessions_Page SHALL query `proxy_sessions` with `started_at >= From 00:00:00 UTC` and `started_at <= To 23:59:59 UTC`, inclusive of both boundary dates.
3. WHEN only a "From" date is provided, THE Sessions_Page SHALL filter sessions to those with `started_at >= From 00:00:00 UTC` with no upper bound.
4. WHEN only a "To" date is provided, THE Sessions_Page SHALL filter sessions to those with `started_at <= To 23:59:59 UTC` with no lower bound.
5. THE Sessions_Page SHALL display a tooltip on every instance of the "rug pull" label (both as a status filter pill and as a badge on session rows) with the text: "Rug pull: the MCP server attempted to exfiltrate data or execute unauthorized actions, causing the session to be terminated."
6. THE Sessions_Page SHALL display the sum of `tool_call_count` across all currently displayed sessions in the page header, formatted as "{n} tool calls total".

---

## LOW PRIORITY

---

### Requirement 15: Settings > General — Logo Upload, Timezone, Delete Organization

**User Story:** As an organization admin, I want to upload a logo, set a timezone, and have a danger zone to delete my organization, so that the general settings page covers the full scope of organization configuration.

#### Acceptance Criteria

1. THE General_Settings_Page SHALL display an organization logo upload control that accepts files with MIME types `image/png`, `image/jpeg`, and `image/svg+xml`, with a maximum file size of 2 MB.
2. WHEN a user selects a valid image file, THE General_Settings_Page SHALL upload it to Supabase Storage under the `org-logos` bucket and persist the resulting public URL to the `organizations` table.
3. IF a user selects a file exceeding 2 MB or with an unsupported MIME type, THEN THE General_Settings_Page SHALL display an inline validation error beneath the upload control and SHALL NOT upload the file.
4. THE General_Settings_Page SHALL display a timezone selector populated with the full IANA timezone list, with the organization's current timezone pre-selected.
5. WHEN a user selects a new timezone and saves, THE General_Settings_Page SHALL persist the IANA timezone string to the `organizations` table and display a success toast.
6. THE General_Settings_Page SHALL display a "Danger Zone" section with a red or destructive-styled border, visually separated from the other settings sections, containing a "Delete Organization" button.
7. WHEN a user clicks "Delete Organization", THE General_Settings_Page SHALL open a modal dialog prompting the user to type the exact organization name to confirm.
8. WHEN the user types the correct organization name in the confirmation dialog and clicks "Confirm Delete", THE General_Settings_Page SHALL call a Server_Action to soft-delete or hard-delete the organization and all associated records, then redirect to `/signup`.
9. IF the typed name does not exactly match the organization name, THEN THE General_Settings_Page SHALL keep the "Confirm Delete" button disabled.

---

### Requirement 16: Settings > Billing — Annual Switch and Invoice History

**User Story:** As a billing admin, I want the "Switch to Annual" button to actually trigger a plan change, and I want to see my invoice history, so that I can manage subscription costs and keep records.

#### Acceptance Criteria

1. WHEN a user clicks "Switch to Annual" on the Billing_Settings_Page, THE Billing_Settings_Page SHALL call `/api/billing/checkout` with `{ planId: currentPlanId, billingCycle: "annual" }` and redirect the user to the returned `checkoutUrl`.
2. THE Billing_Settings_Page SHALL display an Invoice_History section listing invoices fetched from the billing provider, each showing: invoice date, amount (formatted with currency symbol), status ("paid" / "open" / "void"), and a download link.
3. WHEN no invoices exist for the organization, THE Billing_Settings_Page SHALL display the text "No invoices yet" in the Invoice_History section.
4. WHEN an invoice has a `hosted_invoice_url`, THE Billing_Settings_Page SHALL render its download link as an anchor tag with `target="_blank"` and `rel="noopener noreferrer"`.

---

### Requirement 17: Upgrade / Pricing Page — Feature Comparison Table, Contact Page, Social Proof

**User Story:** As a prospective customer evaluating plans, I want a full feature comparison table, a proper contact page for Enterprise inquiries, and social proof on the pricing page, so that I can make an informed purchasing decision.

#### Acceptance Criteria

1. THE Upgrade_Page SHALL display a Feature_Comparison_Table positioned below the pricing cards, with plans as column headers (Free, Developer, Team, Startup, Enterprise) and feature rows including at minimum: scans/month, tool calls/month, seats, MCP servers, runtime proxy protection, sandbox execution, NSA compliance reports, support tier, and scan retention.
2. THE Feature_Comparison_Table SHALL use a checkmark (✓) to indicate a feature is included and a dash (–) to indicate it is not included, consistent with the plan card notation.
3. THE Upgrade_Page SHALL replace the Enterprise "Contact Sales" `mailto:` href with a button that navigates to `/contact`.
4. THE `/contact` route SHALL display either a contact inquiry form (collecting name, email, company, and message fields) or an embedded Calendly widget; both options satisfy this criterion.
5. THE Upgrade_Page SHALL display a Social_Proof section positioned above the pricing cards containing at least one of: a customer testimonial quote with attribution, a row of customer logo images, or a live or static metric (e.g., "X tool calls protected this month").
