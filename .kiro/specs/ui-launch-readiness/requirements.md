# Requirements Document

## Introduction

MCPGuardian is an MCP server security platform built with Next.js 15 App Router, Supabase Auth + Postgres, shadcn/ui, and Tailwind CSS with a dark theme. Two feature specs (UX improvements and pricing tiers) have been implemented, but many UI components are not working end-to-end. This spec addresses comprehensive UI launch readiness: ensuring all components are wired to real data, server actions function correctly, navigation flows are complete, design tokens are applied consistently, and the application meets production standards for performance, accessibility, and error handling.

The scope covers five pillars:
1. End-to-end component integration — all pages fetch real Supabase data and mutations succeed
2. UI consistency and polish — loading states, error states, empty states, and design token usage across every page
3. Layout and navigation — sidebar, breadcrumbs, mobile responsiveness, page transitions
4. Data flow verification — server actions, real-time subscriptions, optimistic updates
5. Launch readiness — SEO metadata, accessibility, performance, error boundaries, and HTTP error pages

---

## Glossary

- **MCPGuardian**: The MCP server security platform application.
- **App_Shell**: The shared layout at `app/(app)/layout.tsx` comprising the Sidebar, Header, MobileNav, and content area.
- **Sidebar**: The `DashboardSidebar` component providing primary navigation for desktop viewports.
- **MobileNav**: The `MobileNav` component providing bottom-tab navigation for viewports below 768px.
- **Header**: The `DashboardHeader` component rendered at the top of the content area.
- **Page_Skeleton**: A Skeleton-based loading placeholder rendered via Next.js `loading.tsx` convention while a page's server component fetches data.
- **Error_Boundary**: A React error boundary rendered via Next.js `error.tsx` convention that catches runtime errors and displays a recovery UI.
- **Empty_State**: A structured placeholder UI shown when a page has no data to display, including an icon, heading, description, and a primary call-to-action.
- **Design_Token**: A CSS custom property from the theme (e.g., `--bg-surface`, `--secure`, `--threat`, `--caution`, `--monitor`) used to ensure visual consistency.
- **Server_Action**: A Next.js server action (`"use server"` function) used for form submissions and data mutations.
- **Breadcrumb**: A secondary navigation element showing the user's current location within the page hierarchy.
- **SEO_Metadata**: The `metadata` export or `generateMetadata` function on a Next.js page providing title, description, and Open Graph tags.
- **Error_Page**: A custom HTTP error response page (404 Not Found or 500 Internal Server Error) rendered at the app root.
- **Toast**: A transient notification message displayed via the Sonner toast library to confirm actions or surface errors.
- **Skeleton_Shimmer**: An animated placeholder element that mimics content layout while data loads.
- **Focus_Ring**: A visible outline applied to interactive elements when they receive keyboard focus, meeting WCAG 2.1 AA contrast requirements.
- **Code_Split_Boundary**: A dynamic import boundary (`next/dynamic`) that defers loading of heavy client components until needed.
- **Real_Time_Subscription**: A Supabase Realtime channel subscription that pushes database changes to the client without polling.

---

## Requirements

---

## PILLAR 1: END-TO-END COMPONENT INTEGRATION

---

### Requirement 1: Dashboard Page Data Integration

**User Story:** As a returning user, I want the dashboard to display real-time data from my organization's servers, sessions, and usage, so that I can trust the numbers shown are accurate and current.

#### Acceptance Criteria

1. WHEN the Dashboard_Page loads for an authenticated user with an organization, THE Dashboard_Page SHALL fetch on each page load and display the organization's server count, active session count (sessions with `status = "active"`), tool calls today (count of `tool_invocation_logs` with `created_at >= 00:00:00 UTC` of the current date), blocked calls today (count of `tool_invocation_logs` with `was_blocked = true` and `created_at >= 00:00:00 UTC` of the current date), scans used this period as a fraction of the tier's Scan_Allowance, and tool calls used this period as a fraction of the tier's Tool_Call_Allowance.
2. WHEN the Dashboard_Page loads and the organization has zero servers, THE Dashboard_Page SHALL render an Empty_State with the heading "No servers yet", a description of the value of adding a server, and a call-to-action button linking to `/servers/new`.
3. IF the database query for dashboard data fails, THEN THE Dashboard_Page SHALL render the Error_Boundary with a "Retry" button that re-fetches data without a full page reload, up to a maximum of 3 consecutive retry attempts before displaying a persistent error message.
4. WHEN the Quick_Actions_Bar "Scan Now" button is clicked and at least one server exists, THE Dashboard_Page SHALL navigate to `/servers/{mostRecentServerId}` where `mostRecentServerId` is the `id` of the server with the most recent `created_at` timestamp in the organization.
5. WHEN usage data indicates scans used this period or tool calls used this period equal or exceed 80 percent of the organization's current tier Scan_Allowance or Tool_Call_Allowance respectively, THE Dashboard_Page SHALL display a warning badge next to the respective usage meter.
6. IF the organization's current tier has an Unlimited allowance for a given usage metric, THEN THE Dashboard_Page SHALL NOT display a warning badge for that metric regardless of the consumed count.

---

### Requirement 2: Servers Page Data Integration

**User Story:** As a user managing servers, I want the servers list to display real data, inline rescan to trigger actual scans, and add-server to persist new servers, so that server management works end-to-end.

#### Acceptance Criteria

1. WHEN the Servers_Page loads, THE Servers_Page SHALL query `mcp_servers` for the user's organization and render each server with its name, transport type, allowlist status, risk score (displayed as a value out of 100), and last scan timestamp (displayed as a relative time such as "5m ago" or "Never" if no scan has occurred).
2. WHEN a user clicks "Rescan" on a server row, THE Servers_Page SHALL disable the Rescan button for that row, display a spinner in place of the rescan icon during the scan, and upon completion update the row's risk score and last scan timestamp without a full page reload.
3. IF a rescan Server_Action fails, THEN THE Servers_Page SHALL display a Toast with an error message indicating the failure reason, re-enable the Rescan button, and remove the spinner.
4. WHEN a user submits the Add Server form at `/servers/new` with a server name between 1 and 253 characters and either a valid endpoint URL (for HTTP transport) or a non-empty STDIO command (for STDIO transport), THE Server_Action SHALL insert a row into `mcp_servers`, trigger an initial scan, and redirect to `/servers`.
5. IF the Add Server Server_Action fails due to a validation or database error, THEN THE form SHALL display an error message above the submit button indicating the failure reason, retain all entered field values, and re-enable the submit button.
6. IF the Servers_Page query to `mcp_servers` returns an error, THEN THE Servers_Page SHALL display an error message indicating that server data could not be loaded and provide a way for the user to retry.

---

### Requirement 3: Sessions Page Data Integration

**User Story:** As a security analyst, I want the sessions page to fetch real proxy session data with filtering, so that I can investigate sessions by date range.

#### Acceptance Criteria

1. WHEN the Sessions_Page loads, THE Sessions_Page SHALL query `proxy_sessions` for the user's organization ordered by `started_at` descending, return at most 100 results, and display session ID (first 8 characters), status, server name, tool call count, and duration for each session.
2. WHEN a user sets a "From" and "To" date range filter and submits, THE Sessions_Page SHALL re-query sessions with `started_at` between the specified dates inclusive (from 00:00:00 UTC on the "From" date to 23:59:59 UTC on the "To" date) and display only matching results.
3. WHEN a session row is clicked, THE Sessions_Page SHALL navigate to `/sessions/{sessionId}` and that detail page SHALL fetch the full session record scoped to the user's organization and display all tool invocations logged for that session (up to 100 most recent, ordered by creation time descending).
4. IF the sessions query returns zero results for the active filter, THEN THE Sessions_Page SHALL render an Empty_State with the message "No sessions found for this date range" and a button to clear filters.
5. IF the detail page session ID does not exist or does not belong to the user's organization, THEN THE Sessions_Page SHALL return a not-found response.
6. IF the sessions query fails due to a network or server error, THEN THE Sessions_Page SHALL display an error state indicating that sessions could not be loaded.

---

### Requirement 4: Settings Pages Data Integration

**User Story:** As an organization admin, I want all settings pages (General, Billing, Team, API Keys) to load real data and persist changes via server actions, so that configuration changes are actually saved.

#### Acceptance Criteria

1. WHEN the General_Settings_Page loads, THE page SHALL fetch and display the organization's current name, logo URL, and timezone from the `organizations` table.
2. WHEN a user submits the organization name form with a name between 1 and 100 characters (trimmed), THE Server_Action SHALL update the `name` column in `organizations` and display a success Toast.
3. WHEN the Billing_Settings_Page loads, THE page SHALL fetch and display the organization's current plan tier, billing cycle, scans used this period, tool calls used this period, tier-derived allowances, and invoice history ordered by most recent first.
4. WHEN the Team settings page loads, THE page SHALL fetch and display all `organization_members` for the organization with their email, role, and invitation status.
5. WHEN the API Keys settings page loads, THE page SHALL fetch and display all API keys for the organization with their name, prefix, active status, created date, and last-used date.
6. IF any settings Server_Action fails due to a validation error or server error, THEN THE page SHALL display an error Toast indicating the failure reason and SHALL NOT clear form inputs.
7. IF a user without an `admin` or `owner` role attempts a settings Server_Action that modifies organization data, THEN THE Server_Action SHALL return an authorization error and SHALL NOT persist the change.
8. IF the user has no accepted organization membership when loading any settings page, THEN THE page SHALL redirect the user to the onboarding page.

---

### Requirement 5: Activity and Alerts Pages Data Integration

**User Story:** As a security analyst, I want the Threat Log and Alerts pages to load real event data with working pagination and navigation, so that I can investigate security events end-to-end.

#### Acceptance Criteria

1. WHEN the Activity_Page loads, THE page SHALL query `tool_invocation_logs` for events with non-null `threat_type` filtered by organization and ordered by `created_at` descending, limited to 50 rows, and display each event's type, title, description, severity, and timestamp.
2. WHEN a user clicks "Load more" on the Activity_Page, THE page SHALL fetch the next 50 events using offset-based pagination, append them to the existing list, and hide the "Load more" button when the last fetched batch contains fewer than 50 items.
3. WHEN the Alerts_Page loads, THE page SHALL query the `alerts` table for the organization ordered by `created_at` descending, limited to 50 rows, and display each alert's severity, title, message, read status, and timestamp.
4. WHEN a user clicks an alert row, THE Alerts_Page SHALL mark that alert as read via a Server_Action and navigate to `/sessions/{session_id}` if session_id is non-null, otherwise to `/servers/{server_id}` if server_id is non-null, otherwise to `/activity` as a fallback.
5. WHEN a user clicks "Export CSV" on the Activity_Page, THE page SHALL generate and download a CSV file named `threat-log-{YYYY-MM-DD}.csv` containing all currently loaded events with column headers `id,type,title,description,severity,session_id,server_id,created_at` and timestamps formatted as ISO 8601 UTC strings.
6. IF the Activity_Page query returns zero events, THEN THE page SHALL display an empty-state message indicating no security events have been detected.
7. IF the mark-read request returns a 404 status or a network error occurs, THEN THE Alerts_Page SHALL navigate to `/activity` as a fallback.

---

### Requirement 6: Compliance and Telemetry Pages Data Integration

**User Story:** As a compliance officer or infrastructure engineer, I want the Compliance and Telemetry pages to show real control statuses and server health metrics, so that I can make decisions based on actual data.

#### Acceptance Criteria

1. WHEN the Compliance_Page loads, THE page SHALL fetch the organization's most recent `nsa_compliance_assessments` record, derive each control's pass/fail status from the corresponding boolean fields, and compute the Compliance_Score as `Math.round((passed_non_roadmap_count / total_non_roadmap_count) * 100)` yielding an integer from 0 to 100 inclusive, excluding controls with `defaultStatus` of "roadmap".
2. IF no `nsa_compliance_assessments` record exists for the organization, THEN THE Compliance_Page SHALL display the score derived from platform default control statuses and show a notice indicating that no assessment has been recorded yet.
3. WHEN the "OWASP MCP Top 10" tab is selected, THE Compliance_Page SHALL display all 10 OWASP MCP risk categories, each with a pass badge when no `scan_issues` of a matching type exist for the organization, or a fail badge when one or more matching `scan_issues` exist.
4. WHEN the Telemetry_Page loads, THE page SHALL query `server_health_metrics` records from the most recent 30 days for each server belonging to the organization, render a sparkline chart from the 24 most recent latency data points per server, and compute the uptime percentage as `(reachable_records / total_records) * 100` rounded to one decimal place using records within the 30-day window.
5. IF a server has fewer than 5 `server_health_metrics` records within the 30-day window, THEN THE Telemetry_Page SHALL display the text "Insufficient data" in place of both the sparkline chart and the uptime percentage for that server.
6. IF the fetch of compliance control statuses or health metrics fails due to a network or service error, THEN THE respective page SHALL display an error message indicating that data could not be loaded and SHALL NOT render stale or partial results.

---

## PILLAR 2: UI CONSISTENCY AND POLISH

---

### Requirement 7: Loading States for All Pages

**User Story:** As a user navigating between pages, I want to see meaningful loading skeletons that match the page layout, so that I understand content is loading and the app feels responsive.

#### Acceptance Criteria

1. THE App_Shell SHALL provide a `loading.tsx` file for every route segment under `app/(app)/` that contains a `page.tsx`, rendering a Page_Skeleton that includes placeholder elements corresponding to each primary content block (header, cards, tables, or charts) present on the target page.
2. WHEN a page is loading, THE Page_Skeleton SHALL render one Skeleton_Shimmer placeholder element for each primary content block on the target page, using dimensions (height and width) within 20% of the actual content block's rendered size so that the skeleton visually approximates the final layout.
3. THE Page_Skeleton SHALL render within 100ms of navigation start, before any data fetching completes.
4. THE Page_Skeleton SHALL apply the `--bg-surface` Design_Token as the skeleton element background color and the `.shimmer` CSS class for animation, running at a 1.5-second cycle duration.
5. WHILE the user's system has `prefers-reduced-motion: reduce` enabled, THE Page_Skeleton SHALL display static skeleton placeholders with no shimmer animation.
6. WHEN page data finishes loading and the Page_Skeleton is replaced by actual content, THE App_Shell SHALL ensure zero cumulative layout shift (CLS contribution of 0) by maintaining consistent outer dimensions between the skeleton and the loaded page content.

---

### Requirement 8: Error States for All Pages

**User Story:** As a user encountering an error, I want a clear error message with a retry action, so that I can recover without manually refreshing the browser.

#### Acceptance Criteria

1. THE App_Shell SHALL provide an `error.tsx` Error_Boundary for every top-level route segment under `app/(app)/` (activity, alerts, compliance, contact, dashboard, onboarding, reports, servers, sessions, settings, telemetry, upgrade) that catches unhandled runtime errors.
2. WHEN an error is caught, THE Error_Boundary SHALL display the `error.message` string (truncated to a maximum of 200 characters if longer), a "Try again" button that calls `reset()`, and a "Go to Dashboard" link that navigates to `/dashboard`.
3. WHEN an error is caught, THE Error_Boundary SHALL log the error object (message and stack trace) to the browser console via `console.error` for debugging.
4. THE Error_Boundary SHALL use the `--threat` Design_Token for the error icon color and the `--bg-surface` token for the card background.
5. IF the `error.message` property is empty or undefined, THEN THE Error_Boundary SHALL display the fallback text "An unexpected error occurred".

---

### Requirement 9: Empty States for All Data Pages

**User Story:** As a user with no data on a page, I want a helpful empty state that guides me to take action, so that I am never confused by a blank screen.

#### Acceptance Criteria

1. WHEN a data page (Servers, Sessions, Activity, Alerts, Telemetry, Compliance) loads with zero records, THE page SHALL render an Empty_State component.
2. THE Empty_State SHALL include: a relevant Lucide icon (muted, sized at 48×48px), a heading describing what data would appear, a one-sentence description, and a primary call-to-action button.
3. THE Empty_State for the Servers_Page SHALL display the heading "No servers registered" and a CTA button "Add your first server" linking to `/servers/new`.
4. THE Empty_State for the Alerts_Page SHALL display the heading "No alerts" and the description "All clear — no security alerts to show."
5. THE Empty_State for the Sessions_Page SHALL display the heading "No sessions recorded" and a CTA button "Connect your proxy" linking to `/onboarding/proxy-setup`.
6. THE Empty_State for the Activity_Page SHALL display the heading "No threats detected" and the description "Your servers are running clean."
7. THE Empty_State for the Telemetry_Page SHALL display the heading "No telemetry data" and a CTA button "Add a server" linking to `/servers/new`.
8. THE Empty_State for the Compliance_Page SHALL display the heading "No compliance data" and the description "Run your first scan to generate a compliance assessment."

---

### Requirement 10: Consistent Design Token Usage

**User Story:** As a user, I want a visually consistent interface where colors communicate meaning (green for secure, red for threats, amber for caution), so that I can scan the UI quickly and understand status at a glance.

#### Acceptance Criteria

1. THE MCPGuardian UI SHALL use the `--secure` token (green) exclusively for positive/safe states including passing controls, approved servers, healthy uptime, completed onboarding steps, and successful action confirmations.
2. THE MCPGuardian UI SHALL use the `--threat` token (red) exclusively for critical/danger states including blocked actions, failed controls, security alerts with severity "critical" or "high", and destructive action indicators.
3. THE MCPGuardian UI SHALL use the `--caution` token (amber) exclusively for warning states including pending reviews, quota usage above 80%, alerts with severity "warning" or "medium", and expiring credentials.
4. THE MCPGuardian UI SHALL use the `--monitor` token (blue) exclusively for informational/active states including active monitoring indicators, the sidebar active item highlight, scan-in-progress states, and navigation progress bars.
5. THE MCPGuardian UI SHALL use `--bg-surface` for all card backgrounds and `--bg-void` for the sidebar and page background, and SHALL use `--bg-elevated` only for hover states or raised overlays such as dropdowns and tooltips.
6. WHEN a component renders a status indicator (any element whose color communicates one of the four semantic states: secure, threat, caution, or monitor), THE component SHALL reference the corresponding CSS custom property token and SHALL NOT use hardcoded hex values or direct Tailwind color utility classes (e.g., `bg-red-500`, `text-green-400`) to represent that status meaning.
7. THE MCPGuardian UI SHALL ensure that all text rendered over a status-token background meets a minimum contrast ratio of 4.5:1 (WCAG AA) as computed against the token's resolved color value.

---

## PILLAR 3: LAYOUT AND NAVIGATION

---

### Requirement 11: Sidebar Navigation Completeness

**User Story:** As a user navigating the app, I want the sidebar to include links to every section of the app organized by category, so that I can reach any page without guessing URLs.

#### Acceptance Criteria

1. THE Sidebar SHALL display navigation links grouped into three sections: "MONITOR" (Dashboard, Threat Log, Alerts, Telemetry), "PROTECT" (Servers, Sessions, Compliance), and "CONFIGURE" (Settings).
2. WHEN a user clicks a Sidebar link, THE App_Shell SHALL navigate to the target page and the Sidebar SHALL highlight the active link with a left border accent using the `--monitor` Design_Token.
3. WHEN a user clicks the "Settings" Sidebar link, THE App_Shell SHALL navigate to `/settings/general` and the Sidebar SHALL expand to reveal sub-links: General, Billing, Team, and API Keys.
4. THE Sidebar SHALL display an unread alert count badge on the "Alerts" link when the count is greater than zero, capped at "99+" for counts exceeding 99.
5. WHEN the viewport width is between 768px and 1024px, THE Sidebar SHALL auto-collapse to icon-only mode with tooltips shown on hover for each navigation link.
6. WHEN the viewport width is below 768px, THE Sidebar SHALL be hidden and the MobileNav bottom bar SHALL be displayed.
7. WHEN the Sidebar is in collapsed icon-only mode and the unread alert count is greater than zero, THE Sidebar SHALL display a small dot indicator on the Alerts icon.

---

### Requirement 12: Breadcrumb Navigation

**User Story:** As a user on a detail or nested page, I want breadcrumbs showing my location in the hierarchy, so that I can navigate back to parent pages without using the browser back button.

#### Acceptance Criteria

1. WHEN a user is on a nested page (any route deeper than one segment under `app/(app)/`, such as `/servers/{serverId}`, `/sessions/{sessionId}`, `/settings/billing`, `/reports/{scanId}`, `/alerts/channels`), THE Header SHALL display a Breadcrumb trail showing the path from the top-level section to the current page, with segments separated by a "/" or chevron-right icon delimiter.
2. THE Breadcrumb trail SHALL render each ancestor as a clickable link navigating to that ancestor's page, and THE current (last) segment SHALL be rendered as non-clickable text visually distinguished from ancestor links by muted color and no underline.
3. WHEN a breadcrumb segment corresponds to a dynamic route parameter (e.g., `/servers/{serverId}`), THE Breadcrumb trail SHALL display the entity's human-readable name (e.g., server name, session identifier) fetched from the database, truncated with an ellipsis at 30 characters if the name exceeds that length.
4. WHEN a user is on a top-level page (a route exactly one segment deep under `app/(app)/`, such as `/dashboard`, `/servers`, `/sessions`, `/activity`, `/alerts`, `/telemetry`, `/compliance`, `/settings`), THE Header SHALL NOT display a Breadcrumb trail.
5. THE Breadcrumb trail SHALL be wrapped in a `<nav>` element with `aria-label="Breadcrumb"` and SHALL render segments as an ordered list to support screen reader navigation.
6. IF the entity name for a dynamic breadcrumb segment cannot be resolved (e.g., deleted resource), THEN THE Breadcrumb trail SHALL display the raw identifier as the segment label.

---

### Requirement 13: Mobile Responsiveness

**User Story:** As a user on a mobile device, I want the entire application to be usable on a 375px viewport without horizontal scrolling or overlapping elements, so that I can manage security on the go.

#### Acceptance Criteria

1. THE App_Shell SHALL render correctly on viewports as narrow as 375px with no horizontal overflow on any page.
2. WHEN the viewport is below 768px, THE MobileNav bottom bar SHALL be displayed and the Sidebar SHALL be hidden.
3. WHEN the viewport is below 768px, data tables on the Servers, Sessions, and Activity pages SHALL switch to a stacked card layout or a horizontally scrollable container with a visible scroll indicator.
4. WHEN the viewport is below 768px, THE Header SHALL display a condensed version with the page title and a user avatar dropdown, without the full email string.
5. THE MobileNav bottom bar SHALL display icons for: Dashboard, Servers, Alerts, and a "More" button that opens a drawer containing all remaining navigation items accessible from the desktop Sidebar.
6. WHEN the "More" drawer is open, THE drawer SHALL overlay the page content and be dismissible by tapping outside or pressing Escape.

---

### Requirement 14: Page Transitions and Loading Feedback

**User Story:** As a user navigating between pages, I want smooth visual transitions and immediate loading feedback, so that the app feels fast and polished.

#### Acceptance Criteria

1. WHEN navigation is triggered, THE App_Shell SHALL display a top-of-page progress bar (2px height, full viewport width) that animates from 0% to 90% width while the next page loads, and completes to 100% when the page finishes loading.
2. WHEN a new page mounts, THE page content SHALL fade in with a subtle opacity transition (0 to 1 over 150ms).
3. WHEN a Server_Action is in progress (form submission), THE submit button SHALL display a loading spinner and become disabled until the action resolves or fails.
4. THE page transition progress bar SHALL use the `--monitor` Design_Token for its color.
5. IF page loading exceeds 10 seconds, THEN THE progress bar SHALL remain visible at 90% width and SHALL NOT disappear until the page loads or an error boundary renders.

---

## PILLAR 4: DATA FLOW VERIFICATION

---

### Requirement 15: Server Actions Validation and Error Handling

**User Story:** As a user submitting forms, I want all server actions to validate inputs, return meaningful errors, and confirm success, so that I always know whether my action succeeded or what went wrong.

#### Acceptance Criteria

1. WHEN a Server_Action receives invalid input (missing required fields, out-of-range values, or malformed data), THE Server_Action SHALL return a structured error response with a field-level or form-level error message without throwing an unhandled exception.
2. WHEN a Server_Action completes successfully, THE calling page SHALL display a success Toast within 500ms confirming the action (e.g., "Server added", "Settings saved", "Scan started").
3. WHEN a Server_Action fails due to a database or network error, THE calling page SHALL display an error Toast with a human-readable message and SHALL NOT clear the form inputs.
4. WHILE a Server_Action is in flight, THE calling page SHALL disable the submit button and display a loading spinner in place of the button label.
5. IF a Server_Action throws an unhandled exception, THEN THE Error_Boundary SHALL catch it and render the error UI rather than showing a blank screen.

---

### Requirement 16: Real-Time Updates for Critical Data

**User Story:** As a user monitoring servers, I want alerts and scan statuses to update in real time without manual refresh, so that I see security events the moment they occur.

#### Acceptance Criteria

1. WHEN a new alert is inserted into the `alerts` table for the user's organization, THE Sidebar alert badge count SHALL increment within 5 seconds without a page reload via a Real_Time_Subscription.
2. WHEN a scan completes and updates a server's `risk_score` in `mcp_servers`, THE Servers_Page (if open) SHALL update that server's displayed risk score within 5 seconds without a page reload.
3. IF the Real_Time_Subscription connection is lost, THEN THE App_Shell SHALL attempt to reconnect with exponential backoff (1s, 2s, 4s, max 30s intervals) and SHALL display a non-intrusive "Reconnecting" indicator in the Sidebar after 5 seconds of disconnection.
4. WHEN the Real_Time_Subscription reconnects after a disconnection, THE App_Shell SHALL re-fetch the latest alert count and the current risk scores for any servers displayed on the Servers_Page (if open) to synchronize state, and SHALL hide the "Reconnecting" indicator.
5. IF the Real_Time_Subscription fails to reconnect after 5 consecutive attempts, THEN THE App_Shell SHALL display a persistent "Live updates unavailable" indicator in the Sidebar with a manual "Retry" button that resets the reconnection sequence.

---

### Requirement 17: Optimistic Updates for User Actions

**User Story:** As a user performing actions like marking alerts as read or toggling settings, I want the UI to update immediately before server confirmation, so that the interface feels instant.

#### Acceptance Criteria

1. WHEN a user marks an alert as read, THE Alerts_Page SHALL update the alert's visual state to "read" and decrement the Sidebar badge count within 100ms of the user's click, before the Server_Action response returns.
2. IF the mark-as-read Server_Action fails, THEN THE Alerts_Page SHALL revert the alert's visual state to "unread", re-increment the badge count, and display an error Toast indicating the action could not be completed.
3. WHEN a user toggles a boolean setting (e.g., notification preference), THE Settings page SHALL reflect the toggled state within 100ms of the user's click, before the Server_Action response returns.
4. IF the settings toggle Server_Action fails, THEN THE Settings page SHALL revert the toggle to its previous state and display an error Toast indicating the setting could not be saved.
5. WHILE an optimistic Server_Action is in flight for a specific element (alert or toggle), THE page SHALL ignore additional clicks on that same element until the Server_Action resolves or fails.

---

## PILLAR 5: LAUNCH READINESS

---

### Requirement 18: SEO Metadata for All Pages

**User Story:** As the product owner, I want every page to have proper SEO metadata so that shared links display correct titles and descriptions in search engines and social previews.

#### Acceptance Criteria

1. THE MCPGuardian app SHALL export a `metadata` object or `generateMetadata` function from every page file under `app/(app)/` and `app/(auth)/` that sets `title` and `description`, where `title` does not exceed 60 characters and `description` does not exceed 160 characters.
2. THE page title format SHALL follow the pattern "{Page Name} — MCPGuardian" (e.g., "Dashboard — MCPGuardian", "Servers — MCPGuardian") for all static pages.
3. THE root layout SHALL define default Open Graph tags including `og:site_name` as "MCPGuardian", `og:type` as "website", a default `og:image` URL pointing to an image of at least 1200×630 pixels, and a default `og:description` matching the root metadata description.
4. WHEN a page has dynamic content (e.g., `/servers/[serverId]`), THE `generateMetadata` function SHALL include the resource name in the title following the pattern "{Resource Name} — {Section} — MCPGuardian" (e.g., "My Server — Servers — MCPGuardian"), truncating the resource name portion to keep the total title at or below 60 characters.
5. IF a dynamic page's `generateMetadata` function cannot resolve the resource (e.g., resource deleted or inaccessible), THEN THE MCPGuardian app SHALL fall back to the section-level title and description (e.g., "Servers — MCPGuardian") rather than rendering empty or undefined metadata.

---

### Requirement 19: Accessibility Compliance

**User Story:** As a user relying on keyboard navigation or a screen reader, I want the application to be navigable and understandable without a mouse, so that the platform is accessible to all users.

#### Acceptance Criteria

1. THE MCPGuardian UI SHALL ensure all interactive elements (buttons, links, form inputs, tabs) are reachable via keyboard Tab navigation in the visual left-to-right, top-to-bottom reading order of the page layout.
2. WHEN an interactive element receives keyboard focus, THE MCPGuardian UI SHALL display a Focus_Ring with a minimum width of 2px and a contrast ratio of at least 3:1 against adjacent colors.
3. THE MCPGuardian UI SHALL provide `aria-label` or `aria-labelledby` attributes on all icon-only buttons and interactive elements that have no visible text label.
4. THE MCPGuardian UI SHALL ensure all text has a contrast ratio of at least 4.5:1 against its background for normal text (below 18pt regular or 14pt bold) and 3:1 for large text (18pt regular or 14pt bold and above), per WCAG 2.1 AA.
5. WHEN a Toast notification appears, THE Toast component SHALL announce its content to screen readers via an `aria-live="polite"` region.
6. THE Sidebar navigation SHALL use `<nav>` with an `aria-label="Main navigation"` attribute.
7. WHEN a modal or dialog opens, THE modal SHALL move keyboard focus to the first focusable element inside it, trap Tab cycling within the modal while it is open, and return focus to the triggering element when dismissed via the Escape key or a close action.
8. WHEN a form validation error occurs, THE form SHALL associate each error message with its field via `aria-describedby` and announce errors to screen readers via an `aria-live="assertive"` region or by moving focus to the first invalid field.
9. THE App_Shell SHALL render a visually hidden "Skip to main content" link as the first focusable element on the page that, when activated, moves focus to the main content area bypassing the Sidebar and Header.

---

### Requirement 20: Performance Optimization

**User Story:** As a user on varying network conditions, I want the application to load quickly and feel responsive, so that I can use it effectively regardless of connection speed.

#### Acceptance Criteria

1. THE MCPGuardian app SHALL use `next/dynamic` with `{ ssr: false }` to code-split client components larger than 50 KB (gzipped) that are not needed on initial render, including charts, modals, and CSV export logic.
2. THE MCPGuardian app SHALL lazy-load images using the `loading="lazy"` attribute or Next.js `<Image>` component defaults.
3. THE App_Shell layout SHALL render the Sidebar and Header without waiting for page-level data fetches, displaying the shell within 500 milliseconds of navigation start while page content loads asynchronously.
4. WHEN the initial page load completes, THE Largest Contentful Paint (LCP) SHALL occur within 2.5 seconds on a simulated 4G connection (150 ms RTT, 1.6 Mbps download, 750 Kbps upload) for the Dashboard_Page.
5. IF a dynamically imported component fails to load due to a network error, THEN THE MCPGuardian app SHALL display a non-blocking error message indicating the component could not be loaded and provide a retry action to re-attempt the import.

---

### Requirement 21: Error Pages (404 and 500)

**User Story:** As a user who hits a broken link or experiences a server error, I want a branded error page that helps me navigate back to the app, so that I am not stranded on a generic browser error.

#### Acceptance Criteria

1. THE MCPGuardian app SHALL render a custom `not-found.tsx` page at the app root that displays a "404 — Page Not Found" heading (as an `h1` element), a description of no more than 150 characters explaining the page does not exist, and a navigation link whose destination is determined by the user's authentication state.
2. THE MCPGuardian app SHALL render a custom `global-error.tsx` page at the app root that displays a "Something went wrong" heading (as an `h1` element), a description of no more than 150 characters explaining an unexpected error occurred, and a "Try again" button that triggers a full page reload.
3. THE 404 page SHALL use the MCPGuardian brand styling (dark theme, logo, Design_Tokens), SHALL NOT display the app Sidebar or Header, and SHALL be rendered within 2 seconds of navigation to a non-existent route.
4. THE 500 error page SHALL use the MCPGuardian brand styling (dark theme, logo, Design_Tokens), SHALL NOT display the app Sidebar or Header, and SHALL be rendered within 2 seconds of a server error occurring.
5. WHEN an authenticated user navigates to a non-existent route, THE 404 page SHALL display a "Back to Dashboard" link navigating to `/dashboard`.
6. WHEN an unauthenticated user navigates to a non-existent route, THE 404 page SHALL display a "Go to Login" link navigating to `/login`.
7. IF the `global-error.tsx` page itself fails to render, THEN THE MCPGuardian app SHALL fall back to the browser's default error display without a blank screen or infinite error loop.

---

### Requirement 22: Auth Flow Completeness

**User Story:** As a new or returning user, I want login, signup, forgot password, and reset password flows to work end-to-end with proper redirects and error handling, so that I can always access my account.

#### Acceptance Criteria

1. WHEN a user successfully logs in via email/password or OAuth, THE Login_Page SHALL redirect to the `redirectTo` query parameter path if present and starting with `/`, or to `/dashboard` if no valid `redirectTo` is provided.
2. WHEN a user successfully signs up via OAuth, THE Signup_Page SHALL redirect to `/onboarding` via the auth callback. WHEN a user successfully signs up via email/password, THE Signup_Page SHALL display a confirmation message prompting the user to verify their email address, and SHALL provide a "Resend email" control.
3. WHEN login fails due to invalid credentials, THE Login_Page SHALL display an error notification containing the error reason returned by the authentication provider, without clearing the email field value.
4. WHEN a logged-in user visits `/login`, `/signup`, or `/forgot-password`, THE App_Shell SHALL redirect them to `/dashboard`.
5. WHEN an unauthenticated user visits any `app/(app)/` route, THE App_Shell SHALL redirect them to `/login`.
6. WHEN a user completes password reset by submitting a valid new password (minimum 8 characters) with matching confirmation, THE Reset_Password_Page SHALL redirect to `/dashboard` with an active session.
7. IF the password reset link is expired, missing, or invalid, THEN THE Reset_Password_Page SHALL display an error message indicating the link is expired or invalid and SHALL provide a link to request a new reset link via `/forgot-password`.
8. WHEN a user submits the forgot-password form with an email address, THE Forgot_Password_Page SHALL display a confirmation message stating a reset link has been sent (regardless of whether the email exists in the system) to prevent email enumeration.
9. IF the forgot-password request is rate-limited by the authentication provider, THEN THE Forgot_Password_Page SHALL display an error message indicating too many requests and SHALL keep the form in an editable state so the user can retry.
