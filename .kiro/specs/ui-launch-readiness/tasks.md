# Implementation Plan: UI Launch Readiness

## Overview

This plan implements the five pillars of MCPGuardian UI launch readiness: end-to-end component integration, UI consistency and polish, layout and navigation, data flow verification, and launch readiness. Tasks are organized to build foundational shared infrastructure first, then integrate each page, then layer on polish and production concerns. All code is TypeScript using Next.js 15 App Router, Supabase, shadcn/ui, and Tailwind CSS.

## Tasks

- [x] 1. Create shared data access layer and UI primitives
  - [x] 1.1 Implement `getOrgContext()` utility in `lib/data/org-context.ts`
    - Create the `OrgContext` interface with `userId`, `organizationId`, `role`, and `plan`
    - Implement async function that resolves the authenticated user's organization from Supabase auth + `organization_members` table
    - Return `null` if no accepted membership exists
    - _Requirements: 1.1, 4.8_

  - [x] 1.2 Create `PageSkeleton` component in `components/ui/page-skeleton.tsx`
    - Accept `blocks` prop with `{ type: "card" | "table" | "chart" | "header"; height: string }[]`
    - Render shimmer-animated skeleton elements using `--bg-surface` token and `.shimmer` CSS class with 1.5s cycle
    - Respect `prefers-reduced-motion: reduce` by disabling animation
    - _Requirements: 7.1, 7.2, 7.4, 7.5_

  - [x] 1.3 Create `ErrorState` component in `components/ui/error-state.tsx`
    - Accept `error: Error` and `reset: () => void` props
    - Display truncated error message (max 200 chars), "Try again" button, and "Go to Dashboard" link
    - Use `--threat` token for error icon, `--bg-surface` for card background
    - Log error to console via `useEffect`
    - _Requirements: 8.2, 8.3, 8.4, 8.5_

  - [x] 1.4 Create `EmptyState` component in `components/ui/empty-state.tsx`
    - Accept `icon`, `heading`, `description`, and optional `cta: { label, href }` props
    - Render muted 48×48 Lucide icon, heading, description, and CTA button
    - _Requirements: 9.1, 9.2_

  - [x] 1.5 Create empty state registry in `lib/ui/empty-states.ts`
    - Define `EMPTY_STATES` record with entries for servers, sessions, activity, alerts, telemetry, compliance
    - Each entry matches the heading, description, and CTA defined in requirements
    - _Requirements: 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_

  - [x] 1.6 Write property test for empty state rendering consistency
    - **Property 2: Empty state rendering consistency**
    - For each page key in the registry, verify the EmptyState renders with the configured heading
    - **Validates: Requirements 9.1, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8**

- [x] 2. Implement navigation, layout, and page transitions
  - [x] 2.1 Update `DashboardSidebar` with complete navigation links and grouping
    - Group links into "MONITOR" (Dashboard, Threat Log, Alerts, Telemetry), "PROTECT" (Servers, Sessions, Compliance), "CONFIGURE" (Settings)
    - Active link highlighted with left border using `--monitor` token
    - Settings expands to show sub-links: General, Billing, Team, API Keys
    - Alert badge on Alerts link (capped at "99+"), dot indicator in collapsed mode
    - Wrap in `<nav aria-label="Main navigation">`
    - Auto-collapse to icon-only between 768px–1024px with tooltips; hidden below 768px
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 19.6_

  - [x] 2.2 Create `BreadcrumbNav` component in `components/dashboard/breadcrumb-nav.tsx`
    - Accept `segments: BreadcrumbSegment[]` array
    - Render ancestor segments as clickable links, last segment as non-clickable muted text
    - Wrap in `<nav aria-label="Breadcrumb">` with `<ol>` for screen reader support
    - Truncate dynamic names at 30 chars with ellipsis
    - Only display on nested routes (deeper than 1 segment under `app/(app)/`)
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [x] 2.3 Implement `MobileNav` bottom bar for viewports below 768px
    - Display icons for Dashboard, Servers, Alerts, and "More" button
    - "More" opens a drawer with remaining navigation items, dismissible via tap outside or Escape
    - _Requirements: 13.2, 13.5, 13.6_

  - [x] 2.4 Create `NavProgressBar` component in `components/dashboard/nav-progress-bar.tsx`
    - Client component using Next.js router events to animate progress bar
    - 2px height, full width, uses `--monitor` token color
    - Animates 0%→90% while loading, completes to 100% on page mount
    - Stays visible at 90% if loading exceeds 10 seconds
    - _Requirements: 14.1, 14.4, 14.5_

  - [x] 2.5 Add page content fade-in transition and "Skip to main content" link
    - Apply opacity 0→1 over 150ms on page mount in layout
    - Add visually hidden "Skip to main content" link as first focusable element
    - _Requirements: 14.2, 19.9_

  - [x] 2.6 Write property test for breadcrumb trail structure
    - **Property 5: Breadcrumb trail structure**
    - For any nested route, verify at least 2 segments, last is non-clickable, ancestors have valid hrefs
    - **Validates: Requirements 12.1, 12.2, 12.4**

- [x] 3. Checkpoint - Verify shared infrastructure
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement Pillar 1 page data integrations (Dashboard, Servers, Sessions)
  - [x] 4.1 Wire Dashboard page to real Supabase data
    - Fetch org server count, active sessions, tool calls today, blocked calls today, scans used/allowance, tool calls used/allowance via `getOrgContext()` + `createServiceClient()`
    - Display usage meters with warning badges at ≥80% (skip for unlimited tiers)
    - Render empty state when zero servers exist
    - Wire "Scan Now" to navigate to most recently created server
    - Add `loading.tsx` and `error.tsx` for the dashboard route
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 4.2 Wire Servers page to real Supabase data
    - Query `mcp_servers` for org; display name, transport, allowlist, risk score, last scan relative time
    - Implement "Rescan" button with spinner, disable during scan, update row on completion
    - Show toast on rescan failure, re-enable button
    - Add `loading.tsx` and `error.tsx` for the servers route
    - Wire empty state from registry
    - _Requirements: 2.1, 2.2, 2.3, 2.6_

  - [x] 4.3 Wire Add Server form at `/servers/new` with server action
    - Validate name (1–253 chars), endpoint URL or STDIO command via Zod
    - Insert into `mcp_servers`, trigger initial scan, redirect to `/servers`
    - Show error above submit on failure, retain field values
    - _Requirements: 2.4, 2.5_

  - [x] 4.4 Wire Sessions page to real Supabase data
    - Query `proxy_sessions` ordered by `started_at` desc, limit 100
    - Display session ID (first 8 chars), status, server name, tool call count, duration
    - Implement date range filter (From/To)
    - Session detail page at `/sessions/{sessionId}` fetching full record + tool invocations
    - Show empty state for no results, 404 for invalid session ID
    - Add `loading.tsx` and `error.tsx`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 4.5 Write property test for usage warning badge threshold
    - **Property 7: Usage warning badge threshold**
    - Generate random usage/allowance pairs; verify badge shows iff consumed ≥ 80% of allowance (unless unlimited)
    - **Validates: Requirements 1.5, 1.6**

- [x] 5. Implement Pillar 1 page data integrations (Settings, Activity, Alerts, Compliance, Telemetry)
  - [x] 5.1 Wire Settings pages (General, Billing, Team, API Keys) to real data
    - General: fetch org name, logo URL, timezone; update name via server action with Zod (1–100 chars)
    - Billing: fetch plan tier, billing cycle, usage, allowances, invoice history
    - Team: fetch `organization_members` with email, role, invitation status
    - API Keys: fetch keys with name, prefix, active, created, last-used
    - All actions: show toast on success/failure, retain inputs on error, check role authorization
    - Redirect to onboarding if no accepted membership
    - Add `loading.tsx` and `error.tsx` for each settings sub-route
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [x] 5.2 Wire Activity (Threat Log) page to real data
    - Query `tool_invocation_logs` where `threat_type IS NOT NULL`, org-scoped, ordered desc, limit 50
    - Display type, title, description, severity, timestamp
    - Implement "Load more" with offset pagination (hide when < 50 returned)
    - Implement "Export CSV" generating `threat-log-{YYYY-MM-DD}.csv` with correct headers and ISO 8601 timestamps
    - Wire empty state from registry
    - Add `loading.tsx` and `error.tsx`
    - _Requirements: 5.1, 5.2, 5.5, 5.6_

  - [x] 5.3 Wire Alerts page to real data
    - Query `alerts` for org, ordered desc, limit 50; display severity, title, message, read status, timestamp
    - Click row: mark as read via server action, navigate to `/sessions/{session_id}` or `/servers/{server_id}` or `/activity` fallback
    - Handle mark-read failure (404/network): navigate to `/activity`
    - Wire empty state from registry
    - Add `loading.tsx` and `error.tsx`
    - _Requirements: 5.3, 5.4, 5.7_

  - [x] 5.4 Wire Compliance page to real data
    - Fetch most recent `nsa_compliance_assessments`; derive pass/fail per control
    - Compute score: `Math.round((passed_non_roadmap / total_non_roadmap) * 100)`
    - Show notice if no assessment exists; use platform defaults
    - OWASP MCP Top 10 tab: pass/fail badges based on `scan_issues`
    - Wire empty state, add `loading.tsx` and `error.tsx`
    - _Requirements: 6.1, 6.2, 6.3, 6.6_

  - [x] 5.5 Wire Telemetry page to real data
    - Query `server_health_metrics` for 30-day window per server
    - Render sparkline from 24 most recent latency points per server
    - Compute uptime: `(reachable / total) * 100` rounded to 1 decimal
    - Show "Insufficient data" for servers with < 5 records
    - Wire empty state, add `loading.tsx` and `error.tsx`
    - _Requirements: 6.4, 6.5, 6.6_

  - [x] 5.6 Write property test for compliance score computation
    - **Property 8: Compliance score computation**
    - Generate random control result arrays; verify score = `Math.round((passed_non_roadmap / total_non_roadmap) * 100)`, always 0–100
    - **Validates: Requirements 6.1**

  - [x] 5.7 Write property test for CSV export column structure
    - **Property 9: CSV export column structure**
    - Generate random event arrays; verify output has exact headers and valid ISO 8601 `created_at` values
    - **Validates: Requirements 5.5**

- [x] 6. Checkpoint - Verify all page integrations
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement data flow verification (server actions, real-time, optimistic updates)
  - [x] 7.1 Standardize all server actions with Zod validation and `ActionState` return type
    - Audit existing server actions; ensure each validates input with Zod
    - Return `{ success, error, fieldErrors }` on validation failure (no throw)
    - Ensure error boundary catches unhandled exceptions
    - Disable submit button + show spinner while action is in flight
    - Show success/error toast within 500ms of resolution
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

  - [x] 7.2 Implement `RealtimeProvider` in `components/providers/realtime-provider.tsx`
    - Wrap app shell children with Supabase Realtime subscriptions scoped to org
    - Subscribe to `alerts` INSERT → increment badge count within 5s
    - Subscribe to `mcp_servers` UPDATE → update risk scores on Servers page within 5s
    - Implement exponential backoff reconnect (1s, 2s, 4s, max 30s)
    - Show "Reconnecting" indicator in sidebar after 5s disconnection
    - Re-fetch alert count + risk scores on reconnect
    - Show persistent "Live updates unavailable" + manual retry after 5 failed reconnects
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

  - [x] 7.3 Implement optimistic updates for mark-as-read and settings toggles
    - Mark alert read: update UI immediately (< 100ms), decrement badge; revert + toast on failure
    - Settings toggle: reflect new state immediately (< 100ms); revert + toast on failure
    - Ignore duplicate clicks while action is in flight
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

  - [x] 7.4 Write property test for server action validation round-trip
    - **Property 1: Server action validation round-trip**
    - Generate random invalid inputs; verify ActionState has `error` and `success !== true`, form state unchanged
    - **Validates: Requirements 15.1, 15.3**

  - [x] 7.5 Write property test for optimistic update rollback
    - **Property 6: Optimistic update rollback**
    - Simulate failing server actions; verify UI reverts to pre-action value and error toast shown
    - **Validates: Requirements 17.2, 17.4**

- [x] 8. Implement design token consistency and mobile responsiveness
  - [x] 8.1 Audit and fix design token usage across all components
    - Replace any hardcoded hex or direct Tailwind color classes for status indicators with CSS custom property tokens
    - `--secure` for positive/safe, `--threat` for critical/danger, `--caution` for warning, `--monitor` for informational/active
    - Verify `--bg-surface` for card backgrounds, `--bg-void` for page/sidebar, `--bg-elevated` for hover/overlays only
    - Ensure 4.5:1 contrast for text over status-token backgrounds
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

  - [x] 8.2 Implement mobile responsive layouts for data pages
    - Tables on Servers, Sessions, Activity pages: switch to stacked cards or scrollable container below 768px
    - Header: condensed version with page title + avatar dropdown (no full email) below 768px
    - Ensure no horizontal overflow on 375px viewports
    - _Requirements: 13.1, 13.3, 13.4_

  - [x] 8.3 Write property test for design token semantic exclusivity
    - **Property 3: Design token semantic exclusivity**
    - Audit component source for status indicators; verify all use CSS custom property tokens, no hardcoded hex or Tailwind color classes
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.6**

- [x] 9. Implement launch readiness (SEO, accessibility, performance, error pages, auth)
  - [x] 9.1 Add SEO metadata to all pages under `app/(app)/` and `app/(auth)/`
    - Export `metadata` or `generateMetadata` from every page
    - Title format: "{Page Name} — MCPGuardian" (≤ 60 chars)
    - Dynamic pages: "{Resource Name} — {Section} — MCPGuardian" with truncation
    - Fallback to section-level title if resource unresolvable
    - Root layout: define OG tags (`og:site_name`, `og:type`, `og:image` 1200×630, `og:description`)
    - Description ≤ 160 chars per page
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_

  - [x] 9.2 Implement accessibility compliance fixes
    - Ensure all interactive elements reachable via Tab in reading order
    - Focus ring: 2px min, 3:1 contrast
    - `aria-label` on all icon-only buttons
    - 4.5:1 text contrast ratio (WCAG AA)
    - Toast: `aria-live="polite"` region
    - Modals: focus trap, Escape dismissal, focus return
    - Form errors: `aria-describedby` linkage, `aria-live="assertive"`
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.7, 19.8_

  - [x] 9.3 Implement performance optimizations
    - Code-split client components > 50 KB with `next/dynamic({ ssr: false })`
    - Lazy-load images with `loading="lazy"` or `<Image>`
    - Ensure shell (sidebar + header) renders without waiting for page data
    - Handle dynamic import failure with inline error + retry
    - _Requirements: 20.1, 20.2, 20.3, 20.5_

  - [x] 9.4 Create custom 404 and 500 error pages
    - `app/not-found.tsx`: "404 — Page Not Found" h1, description ≤ 150 chars, auth-aware link (dashboard or login)
    - `app/global-error.tsx`: "Something went wrong" h1, description ≤ 150 chars, "Try again" button (full reload)
    - Both use brand styling, dark theme, no sidebar/header
    - Prevent infinite error loop if global-error itself fails
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7_

  - [x] 9.5 Verify and fix auth flow completeness
    - Login: redirect to `redirectTo` param (if starts with `/`) or `/dashboard`
    - Signup email: show confirmation + "Resend email"; OAuth: redirect to `/onboarding`
    - Login failure: show error, retain email
    - Logged-in users on auth routes → redirect to `/dashboard`
    - Unauthenticated users on app routes → redirect to `/login`
    - Password reset: valid submission → `/dashboard` with session; expired link → error + link to `/forgot-password`
    - Forgot password: always show "link sent" message; handle rate limiting
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.7, 22.8, 22.9_

  - [x] 9.6 Write property test for SEO metadata title format
    - **Property 4: SEO metadata title format**
    - Generate page names; verify title matches "{Page Name} — MCPGuardian" and ≤ 60 chars
    - **Validates: Requirements 18.1, 18.2**

  - [x] 9.7 Write property test for auth redirect determination
    - **Property 10: Auth redirect determination**
    - Generate random `redirectTo` values; verify redirect is `redirectTo` if starts with `/`, else `/dashboard`; logged-in users on auth routes → `/dashboard`
    - **Validates: Requirements 22.1, 22.4**

- [x] 10. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All code uses TypeScript with Next.js 15 App Router patterns established in the codebase
- `createServiceClient()` is used for all Supabase queries in server components
- `ActionState` type is used for all server action returns

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5"] },
    { "id": 1, "tasks": ["1.6", "2.1", "2.2", "2.3", "2.4", "2.5"] },
    { "id": 2, "tasks": ["2.6", "4.1", "4.2", "4.3", "4.4"] },
    { "id": 3, "tasks": ["4.5", "5.1", "5.2", "5.3", "5.4", "5.5"] },
    { "id": 4, "tasks": ["5.6", "5.7", "7.1", "7.2", "7.3"] },
    { "id": 5, "tasks": ["7.4", "7.5", "8.1", "8.2"] },
    { "id": 6, "tasks": ["8.3", "9.1", "9.2", "9.3", "9.4", "9.5"] },
    { "id": 7, "tasks": ["9.6", "9.7"] }
  ]
}
```
