# Implementation Plan: MCPGuardian UX Improvements

## Overview

This plan converts all 17 requirements from the MCPGuardian UX audit into discrete, ordered coding tasks. Tasks are grouped by the four priority tiers from the design: **Critical Bug Fixes** (Req 1–4) → **High Priority UX** (Req 5–10) → **Medium Priority** (Req 11–14) → **Low Priority** (Req 15–17). Each task references granular requirement sub-clauses and design sections. Property-based tests use **fast-check** and target the 26 Correctness Properties defined in the design document.

---

## Tasks

---

## Tier 1: Critical Bug Fixes

---

- [x] 1. Forgot Password Flow — routes, forms, and login link (Req 1)
  - [x] 1.1 Create `/forgot-password` page and form component
    - Create `app/(auth)/forgot-password/page.tsx` as a minimal Server Component shell
    - Create `components/auth/forgot-password-form.tsx` as a `"use client"` component
    - Form: single email `<Input>`, submit button, calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: process.env.NEXT_PUBLIC_SITE_URL + "/reset-password" })`
    - On any response (success or "email not found"): transition component state to `success` and render "Check your email" confirmation message — never reveal registration status
    - On Supabase rate-limit error: display "Too many requests. Please try again in a few minutes." and keep form enabled
    - _Requirements: 1.2, 1.3, 1.4_

  - [x] 1.2 Create `/reset-password` page and form component
    - Create `app/(auth)/reset-password/page.tsx` as a minimal Server Component shell
    - Create `components/auth/reset-password-form.tsx` as a `"use client"` component
    - On mount: exchange the `code` URL param for a Supabase session via `supabase.auth.exchangeCodeForSession`
    - State machine: `idle` → `submitting` → `success` (redirects to `/dashboard`) | `mismatch` (inline error under confirm field) | `error` (Supabase error + link to `/forgot-password`) | `expired` (expired/invalid token error + link to `/forgot-password`)
    - Render new-password + confirm-password fields; block submission when passwords do not match (do NOT call `updateUser`)
    - On match and valid length ≥ 8: call `supabase.auth.updateUser({ password })`, then `router.push("/dashboard")`
    - _Requirements: 1.5, 1.6, 1.7, 1.8_

  - [x] 1.3 Add "Forgot password?" link to `LoginForm`
    - Edit `components/auth/login-form.tsx`
    - Add `<Link href="/forgot-password" className="text-xs text-slate-400 hover:underline mt-1 block text-right">Forgot password?</Link>` visually beneath the password `<Input>`
    - _Requirements: 1.1_

  - [x] 1.4 Write property test for forgot-password form success behavior (Property 1)
    - **Property 1: Forgot-password form shows success for any valid email**
    - Verify that for any syntactically valid email string, the component transitions to the success/confirmation state without revealing registration status
    - Tag: `// Feature: mcpguardian-ux-improvements, Property 1: Forgot-password form shows success for any valid email`
    - **Validates: Requirements 1.3, 1.4**

  - [x] 1.5 Write property test for reset-password mismatch guard (Property 3)
    - **Property 3: Mismatched passwords always block form submission**
    - For any two distinct strings `p1 ≠ p2`, submitting them as (new-password, confirm-password) must show inline error and must NOT call `supabase.auth.updateUser`
    - Tag: `// Feature: mcpguardian-ux-improvements, Property 3: Mismatched passwords always block form submission`
    - **Validates: Requirements 1.7**

---

- [x] 2. Organization Name Save Action (Req 2)
  - [x] 2.1 Create `lib/actions/settings.ts` server actions file
    - Create `lib/actions/settings.ts` with `"use server"` directive
    - Implement `updateOrgName(prevState: ActionState, formData: FormData): Promise<ActionState>`:
      1. Read and validate `name` from `formData` (length 1–100, trim whitespace)
      2. Authenticate via `createClient().auth.getUser()`
      3. Look up `organization_id` from `organization_members` where `user_id = user.id` and `invitation_status = 'accepted'`
      4. Verify role is `admin` or `owner`; return `{ error: "Unauthorized" }` otherwise
      5. Call `svc.from("organizations").update({ name }).eq("id", orgId)`
      6. Return `{ success: true }` or `{ error: string }`
    - Add stub exports for `updateOrgTimezone`, `uploadOrgLogo`, `deleteOrganization` (to be implemented in Tier 4)
    - Export `ActionState` interface from `lib/types/settings.ts`
    - _Requirements: 2.1, 2.2_

  - [x] 2.2 Wire `updateOrgName` into `settings/general/page.tsx`
    - Create a `"use client"` wrapper component (e.g., `components/settings/org-name-form.tsx`) using `useActionState(updateOrgName, {})`
    - Wrap org name `<Input>` and Save `<Button>` in `<form action={formAction}>`
    - Pending state: disable button and show spinner in place of label (Req 2.5)
    - On `state.success`: show success toast via `sonner` (matches existing pattern); retain saved value in input
    - On `state.error`: show error toast; do NOT clear input field
    - Embed `OrgNameForm` in `app/(app)/settings/general/page.tsx`, passing the SSR-fetched `orgName` as initial value
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 2.3 Write property test for org name persistence (Property 5)
    - **Property 5: Org name persistence round trip**
    - For any string of length 1–100, calling `updateOrgName` and reading back `organizations.name` must equal the submitted value (use a Supabase test client against a test org)
    - Tag: `// Feature: mcpguardian-ux-improvements, Property 5: Org name persistence round trip`
    - **Validates: Requirements 2.2**

---

- [x] 3. Alert Navigation to Related Context (Req 3)
  - [x] 3.1 Add `session_id` and `server_id` to the alerts query
    - Edit `app/(app)/alerts/page.tsx` (or the data-fetching helper it uses)
    - Extend the Supabase select to include `session_id` and `server_id` columns
    - Update the TypeScript alert type/interface to include these two nullable fields
    - _Requirements: 3.1_

  - [x] 3.2 Create `POST /api/alerts/[alertId]/mark-read` API route
    - Create `app/api/alerts/[alertId]/mark-read/route.ts`
    - Validate authenticated user and org membership
    - Execute: `UPDATE alerts SET read = true WHERE id = alertId AND organization_id = orgId`
    - Return `200 { ok: true }` on success; `403` for unauthorized; `404` if not found
    - _Requirements: 3.1_

  - [x] 3.3 Implement click handler with navigation priority logic
    - Convert alert rows on `app/(app)/alerts/page.tsx` to use a `"use client"` wrapper component (or convert the whole page to client) with an `onClick` async handler
    - Handler logic:
      1. `POST /api/alerts/{alertId}/mark-read`
      2. Resolve target: `session_id` non-null → `/sessions/{session_id}`; else `server_id` non-null → `/servers/{server_id}`; else `/activity`
      3. Call `router.push(target)`
    - Handle 404/missing referent by falling back to `/activity`
    - Filter state (severity/status) is already URL-encoded — no additional work needed for back-button restoration (Req 3.6)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

---

- [x] 4. Server Detail Scan Link Route (Req 4)
  - [x] 4.1 Create `/reports/[scanId]` page
    - Create `app/(app)/reports/[scanId]/page.tsx` as a Server Component
    - Fetch scan record: `svc.from("scans").select("*").eq("id", scanId).eq("organization_id", orgId).maybeSingle()`
    - If null: call Next.js `notFound()` which renders the not-found UI with a back link to `/servers`
    - If found: render full scan report reusing `components/scan/issue-card.tsx` and `components/scan/mini-score-ring.tsx`
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 4.2 Fix scan row links on `Server_Detail_Page` and limit to 5
    - Edit `app/(app)/servers/[serverId]/page.tsx`
    - Change scan row `<Link href>` from the current broken path to `/reports/{scan.id}`
    - Limit recent scans to 5: add `.limit(5)` to the scans query (or `scans.slice(0, 5)` client-side)
    - _Requirements: 4.1, 4.4_

  - [x] 4.3 Write property test for 5-scan limit (Property 6)
    - **Property 6: Server detail shows at most 5 recent scans**
    - For any array of ≥ 6 scan objects with distinct `created_at` values, `getRecentScans(scans)` must return exactly 5 items, all from the top-5 most-recent set
    - Extract `getRecentScans` as a pure helper function and test it
    - Tag: `// Feature: mcpguardian-ux-improvements, Property 6: Server detail shows at most 5 recent scans`
    - **Validates: Requirements 4.4**

---

- [x] 5. Checkpoint — Critical Bug Fixes
  - Ensure all tests pass. Verify that `/forgot-password`, `/reset-password`, and `/reports/[scanId]` routes render without errors. Ask the user if any questions arise before proceeding.

---

## Tier 2: High Priority UX

---

- [x] 6. Signup Page Improvements (Req 5)
  - [x] 6.1 Create `PasswordStrengthMeter` component and `computeStrength` function
    - Create `components/auth/password-strength-meter.tsx` as `"use client"`
    - Export pure function `computeStrength(password: string): StrengthLevel`:
      - `"weak"` if `password.length < 8`
      - `"strong"` if length ≥ 8 AND has uppercase + lowercase + (digit or non-alphanumeric printable ASCII `[0-9!-/:-@[-\`{-~]`)
      - `"fair"` for all other inputs
    - UI: three horizontal segments — `--threat` (weak), amber (fair), `--secure` (strong) — with labels "Weak", "Fair", "Strong"
    - _Requirements: 5.4, 5.5, 5.6, 5.7_

  - [x] 6.2 Write property test for `computeStrength` (Property 2)
    - **Property 2: Password strength classification covers all inputs**
    - `fc.assert(fc.property(fc.string(), (password) => { ... }))` — validate all three classification branches against the spec rules for any arbitrary string
    - Minimum 100 iterations
    - Tag: `// Feature: mcpguardian-ux-improvements, Property 2: Password strength classification covers all inputs`
    - **Validates: Requirements 5.5, 5.6, 5.7**

  - [x] 6.3 Update `SignupForm` — remove confirm-password, add Google OAuth, add terms link, add strength meter, add weak-password gate
    - Edit `components/auth/signup-form.tsx`
    - Remove the `confirmPassword` field and any associated validation
    - Add Google OAuth button: `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: .../auth/callback?next=/onboarding } })`
    - Ensure GitHub OAuth button similarly redirects to `/onboarding` on success
    - Render `<PasswordStrengthMeter password={passwordValue} />` beneath the password `<Input>` (controlled via `useState`)
    - Add `<a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>` link
    - Client-side gate: if `computeStrength(password) === "weak"`, call `e.preventDefault()` on form submit and display inline error beneath password field; do NOT submit
    - _Requirements: 5.1, 5.2, 5.3, 5.8, 5.9_

  - [x] 6.4 Write property test for weak-password signup gate (Property 4)
    - **Property 4: Weak password blocks signup submission**
    - For any password string where `computeStrength` returns `"weak"`, form submission must show inline error and must NOT invoke the signup server action
    - Tag: `// Feature: mcpguardian-ux-improvements, Property 4: Weak password blocks signup submission`
    - **Validates: Requirements 5.9**

---

- [x] 7. Onboarding Step 1 — Split Form/Scan Screens and Stepper Labels (Req 6)
  - [x] 7.1 Update `OnboardingSteps` component labels and design tokens
    - Edit `components/onboarding/onboarding-steps.tsx`
    - Update step labels array to exactly: `["Create Org", "Scan Server", "Connect Proxy", "Done"]`
    - Replace `bg-blue-500` hard-coded colour classes with `var(--secure)` for active/completed indicator and `var(--monitor)` for inactive
    - Completed steps (index < activeIndex): render checkmark icon using `--secure` design token
    - Active step (index == activeIndex): filled/highlighted indicator
    - Upcoming steps (index > activeIndex): unfilled indicator
    - _Requirements: 6.3, 6.4, 6.5, 6.6_

  - [x] 7.2 Fix form/scan screen split and error handling in `onboarding/page.tsx`
    - Edit `app/(app)/onboarding/page.tsx`
    - Confirm the two-state render is correct: `step === "form"` shows only the registration form (no scan UI); `step === "scanning"` or `step === "complete"` shows only scan progress (no form fields)
    - Stepper index: `step === "form"` → pass `activeStep={0}`; `step === "scanning"` / `step === "complete"` → pass `activeStep={1}`
    - In the `catch` block of `handleCreate`: call `setStep("form")`, set `setScanError(err.message)`, display `scanError` in the form view, and re-enable the submit button
    - _Requirements: 6.1, 6.2, 6.5, 6.6, 6.7_

  - [x] 7.3 Write property test for `OnboardingSteps` rendering (Property 7)
    - **Property 7: Onboarding Stepper renders correct state for any step index**
    - For any `i ∈ {0, 1, 2, 3}`, the rendered output must have exactly one active step at `i`, checkmarks for all `< i`, and unfilled for all `> i`
    - Tag: `// Feature: mcpguardian-ux-improvements, Property 7: Onboarding Stepper renders correct state for any step index`
    - **Validates: Requirements 6.4, 6.5, 6.6**

---

- [x] 8. Onboarding Step 2 — Client-Specific Instructions and Debug Checklist (Req 7)
  - [x] 8.1 Create `ClientInstructions` tab-switcher component
    - Create `components/onboarding/client-instructions.tsx` as `"use client"`
    - Use shadcn/ui `<Tabs>` with four values: `"claude-desktop"`, `"cursor"`, `"cline"`, `"custom"`; default to `"claude-desktop"`
    - **Claude Desktop tab:** display macOS path `~/Library/Application Support/Claude/claude_desktop_config.json` AND Windows path `%APPDATA%\Claude\claude_desktop_config.json`; show copy/paste code block with `mcpServers` key and proxy URL; selecting this tab hides all others
    - **Cursor tab:** display instructions: Cursor Settings → MCP → Add Server → paste proxy URL + Authorization header; content exclusive to this tab
    - **Cline tab:** display instructions: MCP Servers panel → Add Server → HTTP transport → paste proxy URL + bearer token; content exclusive
    - **Custom tab:** display generic JSON `{ "url": "<proxy_url>", "headers": { "Authorization": "Bearer <token>" } }`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 8.2 Add timeout detection and debug checklist to proxy-setup page
    - Convert `app/(app)/onboarding/proxy-setup/page.tsx` to `"use client"`
    - Add `connectionState` state: `"waiting"` | `"timeout"` | `"connected"`
    - `useEffect` on mount: start a 3-minute countdown; poll `GET /api/proxy/connection-status` every 10 seconds
    - On successful tool call detected: set `connectionState = "connected"`
    - On 3-minute timeout without connection: set `connectionState = "timeout"`
    - When `connectionState === "timeout"`: render debug checklist with exactly four items: (a) verify proxy URL matches, (b) confirm Authorization header contains full bearer token, (c) restart MCP client after saving config, (d) check firewall allows outbound HTTPS port 443
    - _Requirements: 7.7_

  - [x] 8.3 Write property test for tab content mutual exclusivity (Property 8)
    - **Property 8: Onboarding Step 2 tab content is mutually exclusive**
    - For any tab value in `{"Claude Desktop", "Cursor", "Cline", "Custom"}`, after selection: selected panel is visible, other three are not visible
    - Tag: `// Feature: mcpguardian-ux-improvements, Property 8: Onboarding Step 2 tab content is mutually exclusive`
    - **Validates: Requirements 7.1, 7.3, 7.4, 7.5, 7.6**

---

- [x] 9. Onboarding Step 3 — Success Animation and "What Now?" Cards (Req 8)
  - [x] 9.1 Create `SuccessAnimation` component
    - Create `components/onboarding/success-animation.tsx` as `"use client"`
    - CSS keyframe animation (e.g., checkmark draw or confetti) that completes at least one full cycle within 2 seconds of mount
    - Render only when `proxy === "connected"` (prop or derived from URL param)
    - _Requirements: 8.1_

  - [x] 9.2 Update `onboarding/confirmed/page.tsx` with scan target fetch and next-step cards
    - Convert `app/(app)/onboarding/confirmed/page.tsx` to a Server Component
    - Fetch most recent scan: `svc.from("scans").select("id").eq("organization_id", orgId).order("created_at", { ascending: false }).limit(1).maybeSingle()`
    - Derive `scanTarget = latestScan ? /reports/${latestScan.id} : "/servers"`
    - Render `<SuccessAnimation />` conditionally when `searchParams.proxy === "connected"`
    - Render exactly three `<Link>` next-step cards (always visible regardless of `proxy` param):
      1. "View scan report" → `scanTarget`
      2. "Add another server" → `/servers/new`
      3. "Invite a teammate" → `/settings/team`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

---

- [x] 10. Dashboard — Quick Actions Bar, NSA Teaser, Threat Count Link (Req 9)
  - [x] 10.1 Create `QuickActionsBar` component
    - Create `components/dashboard/quick-actions-bar.tsx` as `"use client"`
    - Props: `mostRecentServerId: string | null`
    - "Scan Now": `mostRecentServerId` non-null → `router.push("/servers/{mostRecentServerId}")`; null → `router.push("/servers/new")`
    - "Add Server": `router.push("/servers/new")`
    - "View Alerts": `router.push("/alerts")`
    - Style as a horizontal strip of three `<Button>` elements
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 10.2 Write property test for "Scan Now" navigation (Property 9)
    - **Property 9: "Scan Now" navigates to the most recently created server**
    - For any non-empty array of server objects with distinct `created_at` timestamps, the resolved navigation target must be `/servers/{id}` where `id` belongs to the server with max `created_at`
    - Tag: `// Feature: mcpguardian-ux-improvements, Property 9: "Scan Now" navigates to the most recently created server`
    - **Validates: Requirements 9.2**

  - [x] 10.3 Create `NSAComplianceTeaser` component
    - Create `components/dashboard/nsa-compliance-teaser.tsx`
    - Render: text "NSA MCP Security CSI — 8 controls", CTA button "Upgrade to unlock full compliance reporting", `<Link href="/upgrade">`
    - _Requirements: 9.6_

  - [x] 10.4 Wire `QuickActionsBar`, `NSAComplianceTeaser`, and threat count link into dashboard page
    - Edit `app/(app)/dashboard/page.tsx`
    - Insert `<QuickActionsBar mostRecentServerId={servers?.[0]?.id ?? null} />` above the KPI layout
    - Conditionally render `{!isPaidPlan && <NSAComplianceTeaser />}` alongside/below the NSA panel
    - Replace the static threat count `<span>` with a conditional `<Link href="/alerts?severity=critical">` when `threatCount > 0`, or plain `<span>` when `threatCount === 0`
    - _Requirements: 9.1, 9.6, 9.7, 9.8, 9.9_

  - [x] 10.5 Write property test for threat count link rendering (Property 10)
    - **Property 10: Threat count renders as a link for any positive count**
    - For any integer `threatCount > 0`: element must be a `<Link>` with `href="/alerts?severity=critical"`; for `threatCount === 0`: element must be non-interactive `<span>`
    - Tag: `// Feature: mcpguardian-ux-improvements, Property 10: Threat count renders as a link for any positive count`
    - **Validates: Requirements 9.8, 9.9**

---

- [x] 11. Servers Page — Inline Rescan and Add-Server Route (Req 10)
  - [x] 11.1 Create `/servers/new` page and `AddServerForm` component
    - Create `app/(app)/servers/new/page.tsx` as a Server Component that renders `<AddServerForm>`
    - Create `components/servers/add-server-form.tsx` as `"use client"`
    - Form fields: server name (required, 1–253 chars), transport type toggle (HTTP | STDIO), endpoint URL (shown for HTTP) or STDIO command (shown for STDIO)
    - No organization name field, no org-creation step
    - On submit: `POST /api/servers` with `{ name, transportType, endpointUrl | stdioCommand }`
    - On success: `router.push("/servers")`
    - On error: remain on form, retain all field values, display error message above submit button
    - _Requirements: 10.5, 10.6, 10.7, 10.8, 10.9_

  - [x] 11.2 Create `POST /api/servers` API route
    - Create `app/api/servers/route.ts`
    - Validate auth and org membership
    - Insert new server record under `organization_id`
    - Enqueue initial scan job (insert scan record or call scanner pipeline)
    - Return `{ serverId, scanId }` on success; `400` for validation errors; `403` for unauthorized
    - _Requirements: 10.8_

  - [x] 11.3 Create `POST /api/servers/[serverId]/rescan` API route
    - Create `app/api/servers/[serverId]/rescan/route.ts`
    - Validate auth and org membership (return `403` for cross-org access)
    - Insert new scan job or call scanner pipeline for the given server
    - Return `{ scanId, status }` on success
    - _Requirements: 10.2_

  - [x] 11.4 Create `RescanButton` component and wire into servers page
    - Create `components/servers/rescan-button.tsx` as `"use client"`
    - Props: `serverId: string; onSuccess?: (data: { lastScanAt: string; riskScore: number }) => void`
    - State: `scanning: boolean`, `error: string | null`
    - On click: set `scanning = true`, disable button, show spinner; `POST /api/servers/{serverId}/rescan`
    - On success: invoke `onSuccess` callback (or call `router.refresh()` to update row data); re-enable button
    - On error: re-enable button, remove spinner, set `error` message displayed on the row
    - Edit `app/(app)/servers/page.tsx`: render `<RescanButton>` on every server row in both list and grid views; pass `router.refresh()` as the success callback
    - Change "Add Server" header button from `<Link href="/onboarding">` to `<Link href="/servers/new">`
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 11.5 Write property test for rescan button presence (Property 11)
    - **Property 11: Every server row has a Rescan button**
    - For any non-empty array of server objects, render the servers list and assert that every row contains a `<RescanButton>` element that is enabled by default
    - Tag: `// Feature: mcpguardian-ux-improvements, Property 11: Every server row has a Rescan button`
    - **Validates: Requirements 10.1**

---

- [x] 12. Checkpoint — High Priority UX
  - Ensure all tests pass. Smoke-test `/forgot-password`, `/reset-password`, `/servers/new`, and the dashboard quick actions. Ask the user if any questions arise before proceeding.

---

## Tier 3: Medium Priority

---

- [x] 13. Activity / Threat Log — Pagination, Event Links, CSV Export, and Naming (Req 11)
  - [x] 13.1 Add TypeScript types and data-fetching changes for `MergedEvent`
    - Create/update `lib/types/activity.ts` with `MergedEvent` interface (id, type, title, description, severity, session_id, server_id, createdAt)
    - Update the Supabase queries in `app/(app)/activity/page.tsx` to include `session_id` and `server_id` in both the `tool_invocation_logs` and `alerts` selects
    - _Requirements: 11.6, 11.7, 11.8_

  - [x] 13.2 Implement "Load more" pagination in Activity page
    - Convert `app/(app)/activity/page.tsx` to a Client Component (or add a `"use client"` wrapper for interactive state)
    - Initial load: 50 events ordered by `created_at` descending
    - Add `loadMore()` function: fetch next 50 with `.range(currentCount, currentCount + 49)` and append to `events` state
    - Show "Load more" button only when the last fetch returned exactly 50 results; hide it otherwise
    - Add page `<title>` as "Threat Log — MCPGuardian" via `export const metadata` (or equivalent)
    - Confirm sidebar label for `/activity` in `dashboard-sidebar.tsx` reads "Threat Log"
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 13.3 Write property test for "Load more" visibility threshold (Property 12)
    - **Property 12: "Load more" visibility is determined by event count threshold**
    - Extract `shouldShowLoadMore(n: number): boolean` as a pure function; test with `fc.integer({ min: 0, max: 500 })` that `n > 50` ↔ `true`, `n ≤ 50` ↔ `false`
    - Tag: `// Feature: mcpguardian-ux-improvements, Property 12: Load more button visibility follows n>50 threshold`
    - **Validates: Requirements 11.3, 11.4**

  - [x] 13.4 Implement `EventRow` component with link routing logic
    - Create `components/activity/event-row.tsx` as `"use client"` (or inline in page)
    - Props: `event: MergedEvent`
    - If `event.session_id` non-null → render as `<Link href="/sessions/{session_id}">`, regardless of `server_id`
    - If `event.session_id` null and `event.server_id` non-null → render as `<Link href="/servers/{server_id}">`
    - If both null → render as non-interactive `<div>` (no link wrapping)
    - _Requirements: 11.6, 11.7, 11.8_

  - [x] 13.5 Write property test for event row link priority (Property 13)
    - **Property 13: Activity event row link target follows session_id / server_id priority**
    - For any generated event with arbitrary `session_id` and `server_id` values, assert correct link target or non-interactive render
    - Tag: `// Feature: mcpguardian-ux-improvements, Property 13: Activity event row link target follows session_id / server_id priority`
    - **Validates: Requirements 11.6, 11.7, 11.8**

  - [x] 13.6 Implement CSV export with correct filename and formatting
    - Add `exportCsv(events: MergedEvent[])` function (can live in `lib/utils/csv.ts`)
    - Filename: `threat-log-{YYYY-MM-DD}.csv` using today's UTC date (`new Date().toISOString().slice(0, 10)`)
    - Header row: `id,type,title,description,severity,session_id,server_id,created_at`
    - All `created_at` values formatted as ISO 8601 UTC strings
    - Values with embedded quotes are double-quoted (`"` → `""`)
    - If `events.length === 0`: produce header-only CSV (1 row), no error
    - Blob creation inside `try/finally` to ensure `URL.revokeObjectURL` is always called
    - Add "Export CSV" button in the Activity page header that calls `exportCsv(events)`
    - _Requirements: 11.9, 11.10_

  - [x] 13.7 Write property test for CSV export correctness (Property 14)
    - **Property 14: CSV export contains required columns and correct formatting**
    - For any array of `n` MergedEvent objects: filename matches `threat-log-YYYY-MM-DD.csv`, header is exact, all `created_at` values are ISO 8601 UTC, file has exactly `n + 1` rows
    - Tag: `// Feature: mcpguardian-ux-improvements, Property 14: CSV export contains required columns and correct formatting`
    - **Validates: Requirements 11.10**

---

- [x] 14. Compliance Page — Score Fix, Roadmap Section, OWASP Tab, PDF Request (Req 12)
  - [x] 14.1 Fix compliance score computation to exclude roadmap controls
    - Edit `app/(app)/compliance/page.tsx` (or the score-calculation helper)
    - Extract `computeComplianceScore(controls: Control[]): number` as a pure function:
      - Filter out items where `c.defaultStatus === "roadmap"`
      - `score = Math.round((passedNonRoadmapCount / totalNonRoadmapCount) * 100)`
      - Guard: if `totalNonRoadmapCount === 0`, return `0`
    - _Requirements: 12.1_

  - [x] 14.2 Write property test for compliance score (Property 15)
    - **Property 15: Compliance score excludes roadmap controls**
    - `fc.array(fc.record({ defaultStatus: fc.oneof(fc.constant("passed"), fc.constant("roadmap")), passed: fc.boolean() }), { minLength: 1 })` — assert `computeComplianceScore` equals the expected formula
    - Tag: `// Feature: mcpguardian-ux-improvements, Property 15: Compliance score excludes roadmap controls`
    - **Validates: Requirements 12.1**

  - [x] 14.3 Add "Coming Soon" roadmap section to compliance page
    - Separate roadmap controls from the active controls list in the render
    - Render roadmap controls in a visually distinct "Coming Soon" card section below the active list
    - Each roadmap card shows a shadcn/ui `<Badge>` with the scheduled delivery date (e.g., "Q3 2026") sourced from the control definition
    - _Requirements: 12.2_

  - [x] 14.4 Add OWASP MCP Top 10 control definitions and `FrameworkTabs` component
    - Add OWASP MCP Top 10 control definitions (MCP01–MCP10) to `lib/compliance-mappings.ts` — each with `id`, `label`, `description`, and computed `passed` status
    - Create `FrameworkTabs` Client Component using shadcn/ui `<Tabs>`:
      - Tab 1 ("NSA MCP CSI"): existing NSA controls list (active by default)
      - Tab 2 ("OWASP MCP Top 10"): OWASP MCP01–MCP10 with pass/fail badge per category
    - Wire `FrameworkTabs` into `app/(app)/compliance/page.tsx`
    - _Requirements: 12.3, 12.4, 12.5, 12.6_

  - [x] 14.5 Add "Request PDF Report" button with server action and pending state
    - Create `lib/actions/compliance.ts` with `requestPdfReport(prevState, formData): Promise<ActionState>`:
      - Insert a record into `pdf_generation_requests` table with `status = "pending"` and `organization_id`
      - Return `{ success: true }` or `{ error: string }`
    - Add "Request PDF Report" button to the score card column using `useActionState(requestPdfReport, {})`
    - Pending state: disable button, label shows "Generating…"
    - Success state: show confirmation message "Your report is being generated and will appear in the Reports section within a few minutes."
    - _Requirements: 12.7, 12.8, 12.9_

---

- [x] 15. Telemetry Page — Sparklines, Per-Server Uptime, Full Log Link (Req 13)
  - [x] 15.1 Create `Sparkline` SVG component
    - Create `components/telemetry/sparkline.tsx` (no chart library — pure SVG `<polyline>`)
    - Props: `data: number[]` (latency_ms values, oldest-first), `width?: number`, `height?: number`, `color?: string`
    - Renders data points left-to-right (oldest → newest), normalize Y axis to `[0, max(data)]`
    - When `data.length === 0`: render nothing or a flat line
    - _Requirements: 13.1_

  - [x] 15.2 Write property test for sparkline data ordering (Property 16)
    - **Property 16: Sparkline data is ordered oldest-to-newest**
    - For any array of `server_health_metrics` records, after grouping and sorting by `recorded_at` ascending, the data fed to `<Sparkline>` must match the ascending order — leftmost = oldest, rightmost = newest
    - Tag: `// Feature: mcpguardian-ux-improvements, Property 16: Sparkline data is ordered oldest-to-newest`
    - **Validates: Requirements 13.1**

  - [x] 15.3 Implement `computeUptime` helper and update data fetching
    - Create/export pure function `computeUptime(metrics: HealthMetric[]): string`:
      - Filter to last 30 days: `m.recorded_at >= subDays(now, 30)`
      - If `last30.length === 0`: return `"—"`
      - Return `(Math.round((reachable / total) * 1000) / 10).toFixed(1) + "%"`
    - Update telemetry page data fetching query to select `mcp_server_id, latency_ms, is_reachable, recorded_at` from `server_health_metrics` for the last 30 days, ordered by `mcp_server_id, recorded_at ASC`
    - Group client-side by `mcp_server_id`, take the 24 most recent per server for sparkline data
    - Render `"Insufficient data"` in both sparkline cell and uptime cell when total record count for a server is < 5 (regardless of date range)
    - Add `<Link href="/activity" className="text-xs text-blue-400">View full log →</Link>` in the page header row
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [x] 15.4 Write property tests for uptime formula and insufficient-data guard (Properties 17, 18)
    - **Property 17: Uptime percentage formula correctness**
    - For any server with ≥ 5 records in the last 30 days: `computeUptime` output equals `(Math.round(r/t * 1000) / 10).toFixed(1) + "%"`; for `t = 0`: returns `"—"`
    - **Property 18: Insufficient data threshold applies to both sparkline and uptime**
    - For any server with `< 5` total records: both sparkline and uptime display `"Insufficient data"`
    - Tag both with the correct property annotations
    - **Validates: Requirements 13.2, 13.3, 13.4**

---

- [x] 16. Sessions Page — Date Range Filter, Rug Pull Tooltip, Tool Call Count (Req 14)
  - [x] 16.1 Add date range filter to sessions page
    - Edit `app/(app)/sessions/page.tsx`
    - Read `from` and `to` from `searchParams`; extend Supabase query:
      - `from` set: `.gte("started_at", \`${from}T00:00:00.000Z\`)`
      - `to` set: `.lte("started_at", \`${to}T23:59:59.999Z\`)`
      - Both, one, or neither work independently (no lower/upper bound when not provided)
    - Render `<form method="GET">` with two `<input type="date">` fields labeled "From" and "To" positioned above the session list (GET submit preserves status filter in URL)
    - _Requirements: 14.1, 14.2, 14.3, 14.4_

  - [x] 16.2 Write property test for date range filter inclusivity (Property 19)
    - **Property 19: Session date range filter is inclusive of boundary values**
    - `applyDateFilter(sessions, from, to)` pure function: for any `(from, to, sessions)`, filtered results must only contain sessions within the inclusive boundary
    - Tag: `// Feature: mcpguardian-ux-improvements, Property 19: Session date range filter is inclusive of boundary values`
    - **Validates: Requirements 14.2, 14.3, 14.4**

  - [x] 16.3 Add rug-pull tooltip using shadcn/ui Tooltip
    - Add `components/ui/tooltip.tsx` from shadcn/ui if not already present (run `npx shadcn@latest add tooltip` or copy the component)
    - Wrap every rendered "rug pull" label (status filter pill and session row badge) in `<TooltipProvider><Tooltip><TooltipTrigger>…</TooltipTrigger><TooltipContent>…</TooltipContent></Tooltip></TooltipProvider>`
    - Tooltip text (exact): "Rug pull: the MCP server attempted to exfiltrate data or execute unauthorized actions, causing the session to be terminated."
    - _Requirements: 14.5_

  - [x] 16.4 Write property test for rug-pull tooltip coverage (Property 20)
    - **Property 20: Rug pull tooltip appears on every rug pull label**
    - For any session with `status = "terminated_rug_pull"`, every rendered label for that session must have an accessible tooltip with the exact required text
    - Tag: `// Feature: mcpguardian-ux-improvements, Property 20: Rug pull tooltip appears on every rug pull label`
    - **Validates: Requirements 14.5**

  - [x] 16.5 Add tool call count header to sessions page
    - In `app/(app)/sessions/page.tsx`, compute: `const totalToolCalls = (sessions ?? []).reduce((sum, s) => sum + (s.tool_call_count ?? 0), 0)`
    - Render `<span className="text-slate-400">{totalToolCalls.toLocaleString()} tool calls total</span>` in the page header
    - _Requirements: 14.6_

  - [x] 16.6 Write property test for tool call count sum (Property 21)
    - **Property 21: Header tool call count equals the sum of displayed sessions**
    - For any array of session objects with nullable `tool_call_count`, `computeTotalToolCalls(sessions)` must equal the arithmetic sum treating null as 0
    - Tag: `// Feature: mcpguardian-ux-improvements, Property 21: Header tool call count equals the sum of displayed sessions`
    - **Validates: Requirements 14.6**

---

- [x] 17. Checkpoint — Medium Priority
  - Ensure all tests pass. Verify CSV export downloads correctly in the browser, compliance score reflects non-roadmap-only controls, and sparklines render for servers with sufficient data. Ask the user if any questions arise before proceeding.

---

## Tier 4: Low Priority

---

- [x] 18. Settings > General — Logo Upload, Timezone Selector, Delete Organization (Req 15)
  - [x] 18.1 Run database migrations for `organizations.logo_url` and `organizations.timezone`
    - Create a migration file (e.g., `supabase/migrations/016_org_logo_timezone.sql`):
      ```sql
      ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url TEXT;
      ALTER TABLE organizations ADD COLUMN IF NOT EXISTS timezone  TEXT DEFAULT 'UTC';
      ```
    - _Requirements: 15.2, 15.4_

  - [x] 18.2 Create `OrgLogoUpload` component
    - Create `components/settings/org-logo-upload.tsx` as `"use client"`
    - `<input type="file" accept="image/png,image/jpeg,image/svg+xml" />`
    - Client-side validation: `file.size <= 2 * 1024 * 1024` AND `file.type ∈ { "image/png", "image/jpeg", "image/svg+xml" }`
    - On invalid: show inline validation error beneath the upload control; do NOT upload
    - On valid: upload to Supabase Storage `org-logos` bucket; persist resulting public URL to `organizations.logo_url` via the `uploadOrgLogo` server action in `lib/actions/settings.ts`
    - Show existing logo preview when `organizations.logo_url` is set
    - _Requirements: 15.1, 15.2, 15.3_

  - [x] 18.3 Write property test for logo upload file validation (Property 22)
    - **Property 22: File validation rejects any oversized or wrong-MIME upload**
    - For any file `f`: if `f.size > 2MB` OR `f.type ∉ allowedMIMEs` → error shown, upload blocked; if both valid → proceed
    - Extract `validateLogoFile(file: { size: number; type: string }): ValidationResult` as pure function and test with fast-check
    - Tag: `// Feature: mcpguardian-ux-improvements, Property 22: File validation rejects any oversized or wrong-MIME upload`
    - **Validates: Requirements 15.3**

  - [x] 18.4 Create `TimezoneSelector` component and `updateOrgTimezone` server action
    - Implement `updateOrgTimezone` in `lib/actions/settings.ts` (same pattern as `updateOrgName`)
    - Create `components/settings/timezone-selector.tsx` as `"use client"`:
      - Populate `<Select>` options from `Intl.supportedValuesOf("timeZone")`
      - Pre-select `org.timezone` (passed as prop)
      - On save: call `updateOrgTimezone` via `useActionState`; show success toast on success
    - Wire into `app/(app)/settings/general/page.tsx`
    - _Requirements: 15.4, 15.5_

  - [x] 18.5 Create `DeleteOrgSection` component and `deleteOrganization` server action
    - Implement `deleteOrganization` in `lib/actions/settings.ts`:
      1. Verify calling user is `owner` of the org
      2. Delete all associated records: servers, sessions, scans, alerts, members
      3. Delete the organization record
      4. Return `{ success: true }` → client redirects to `/signup`
    - Create `components/settings/delete-org-section.tsx` as `"use client"`:
      - Red-bordered `<Card>` with "Danger Zone" heading and "Delete Organization" button
      - Click opens shadcn/ui `<AlertDialog>` with: body "Type your organization name to confirm deletion", `<Input>` tracking typed value, "Confirm Delete" button
      - "Confirm Delete" disabled unless `typed === orgName` (exact, case-sensitive)
      - On confirm: call `deleteOrganization`; on success: `router.push("/signup")`
    - Wire into `app/(app)/settings/general/page.tsx`
    - _Requirements: 15.6, 15.7, 15.8, 15.9_

  - [x] 18.6 Write property test for delete confirmation guard (Property 23)
    - **Property 23: Delete confirmation requires exact org name match**
    - For any `(typed: string, orgName: string)`, `isDeleteConfirmEnabled(typed, orgName)` must return `true` iff `typed === orgName` (case-sensitive)
    - Tag: `// Feature: mcpguardian-ux-improvements, Property 23: Delete confirmation requires exact org name match`
    - **Validates: Requirements 15.9**

---

- [x] 19. Database Migrations for Invoice History and PDF Requests (Req 16, 12)
  - [x] 19.1 Create `invoices` table and `pdf_generation_requests` table migrations
    - Create migration file `supabase/migrations/017_invoices_pdf_requests.sql`:
      ```sql
      CREATE TABLE IF NOT EXISTS invoices (
        id                  TEXT PRIMARY KEY,
        organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        amount_paid         INTEGER NOT NULL,
        currency            TEXT NOT NULL DEFAULT 'usd',
        status              TEXT NOT NULL,
        hosted_invoice_url  TEXT,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS pdf_generation_requests (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        status          TEXT NOT NULL DEFAULT 'pending',
        pdf_url         TEXT,
        requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at    TIMESTAMPTZ
      );
      ```
    - _Requirements: 16.2, 12.7_

  - [x] 19.2 Add `alerts` table migration for `session_id` and `server_id` columns
    - Create or append to a migration file:
      ```sql
      ALTER TABLE alerts ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES proxy_sessions(id) ON DELETE SET NULL;
      ALTER TABLE alerts ADD COLUMN IF NOT EXISTS server_id  UUID REFERENCES mcp_servers(id) ON DELETE SET NULL;
      ```
    - This unblocks Req 3 (Alert navigation) and Req 11 (Activity event links) data fetching
    - _Requirements: 3.1, 11.6_

---

- [x] 20. Settings > Billing — Annual Switch and Invoice History (Req 16)
  - [x] 20.1 Create `AnnualSwitchButton` component
    - Create `components/billing/annual-switch-button.tsx` as `"use client"`
    - On click: `POST /api/billing/checkout` with `{ planId: currentPlanId, billingCycle: "annual" }`; on success: `window.location.href = data.checkoutUrl`
    - Loading state during fetch: disable button and show spinner
    - _Requirements: 16.1_

  - [x] 20.2 Add `Invoice` TypeScript type and invoice history section to billing page
    - Create `lib/types/invoice.ts` with `Invoice` interface
    - In `app/(app)/settings/billing/page.tsx` (Server Component section): fetch invoices from `invoices` table ordered by `created_at` descending
    - Render `InvoiceHistory` section after the add-ons card:
      - Each row: formatted date (`MMM d, yyyy`), formatted amount with currency symbol, status `<Badge>`, download `<a>` if `hosted_invoice_url` is non-null (with `target="_blank" rel="noopener noreferrer"`)
      - When no invoices: render "No invoices yet"
    - _Requirements: 16.2, 16.3, 16.4_

  - [x] 20.3 Write property test for invoice row completeness (Property 24)
    - **Property 24: Every invoice row contains all required fields**
    - For any Invoice object, the rendered row must include date, amount, status badge, and download link (or "No invoices yet" for empty list)
    - Tag: `// Feature: mcpguardian-ux-improvements, Property 24: Every invoice row contains all required fields`
    - **Validates: Requirements 16.2, 16.3**

  - [x] 20.4 Write property test for invoice download link security attributes (Property 25)
    - **Property 25: Invoice download links have correct security attributes**
    - For any invoice with non-null `hosted_invoice_url`, the rendered `<a>` must have both `target="_blank"` and `rel="noopener noreferrer"`
    - Tag: `// Feature: mcpguardian-ux-improvements, Property 25: Invoice download links have correct security attributes`
    - **Validates: Requirements 16.4**

---

- [x] 21. Upgrade / Pricing Page — Feature Comparison Table, Contact Page, Social Proof (Req 17)
  - [x] 21.1 Create `FeatureComparisonTable` component
    - Create `components/upgrade/feature-comparison-table.tsx`
    - Column headers: Free, Developer, Team, Startup, Enterprise
    - Feature rows (minimum): scans/month, tool calls/month, seats, MCP servers, runtime proxy protection, sandbox execution, NSA compliance reports, support tier, scan retention
    - Cells: `<Check className="text-emerald-400" />` for included, `<Minus className="text-slate-600" />` for not included — no other notation
    - Render below the pricing cards in `app/(app)/upgrade/page.tsx`
    - _Requirements: 17.1, 17.2_

  - [x] 21.2 Write property test for feature comparison table notation (Property 26)
    - **Property 26: Feature comparison table uses correct notation per plan**
    - For any feature-row/plan-column combination, the cell must contain either a `<Check>` (included) or `<Minus>` (not included) — no other element types
    - Tag: `// Feature: mcpguardian-ux-improvements, Property 26: Feature comparison table uses correct notation per plan`
    - **Validates: Requirements 17.2**

  - [x] 21.3 Create `/contact` page and wire Enterprise CTA
    - Create `app/(app)/contact/page.tsx` rendering a contact inquiry form with fields: name, email, company, message; submits to `POST /api/contact`
    - Alternatively, render an embedded Calendly `<iframe>` (both satisfy Req 17.4)
    - In `app/(app)/upgrade/page.tsx`: replace the Enterprise `mailto:` CTA with `<Button onClick={() => router.push("/contact")}>Contact Sales</Button>`
    - _Requirements: 17.3, 17.4_

  - [x] 21.4 Create `SocialProofSection` component
    - Create `components/upgrade/social-proof-section.tsx`
    - Render at least one of: a customer testimonial quote with attribution, customer logo row, or aggregate stat (e.g., "X tool calls protected this month" — can be static/hardcoded for now)
    - Position above the pricing card grid in `app/(app)/upgrade/page.tsx`
    - _Requirements: 17.5_

---

- [x] 22. Final Checkpoint — Ensure all tests pass
  - Run the full test suite. Verify that all 26 property-based tests pass with at least 100 iterations each. Ask the user if any questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references the specific requirements and properties it covers for full traceability
- Migrations in Tier 4 (tasks 18.1, 19.1, 19.2) should be run before implementing the features that depend on the new columns
- Property-based tests use **fast-check** and each must be tagged: `// Feature: mcpguardian-ux-improvements, Property {N}: {description}`
- All property tests must run a minimum of 100 iterations
- Pure functions (`computeStrength`, `computeUptime`, `computeComplianceScore`, `getRecentScans`, `shouldShowLoadMore`, `applyDateFilter`, `isDeleteConfirmEnabled`, `validateLogoFile`, `exportCsv`) should be extracted to their own modules to enable property testing without DOM/network dependencies
- Checkpoints ensure incremental validation between tiers

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "2.1", "3.1", "4.1", "13.1", "19.1", "19.2"] },
    { "id": 1, "tasks": ["1.4", "1.5", "2.2", "3.2", "4.2", "6.1", "7.1", "8.1", "9.1", "10.1", "10.3", "11.1", "11.2", "11.3", "13.3", "14.1", "15.1", "16.5", "18.1", "20.1"] },
    { "id": 2, "tasks": ["2.3", "3.3", "4.3", "6.2", "6.3", "7.2", "8.2", "9.2", "10.4", "11.4", "13.2", "13.4", "13.6", "14.3", "14.4", "14.5", "15.3", "16.1", "16.3", "18.2", "18.4", "18.5", "20.2", "21.1", "21.3", "21.4"] },
    { "id": 3, "tasks": ["6.4", "7.3", "8.3", "10.2", "10.5", "11.5", "13.5", "13.7", "14.2", "15.2", "15.4", "16.2", "16.4", "16.6", "18.3", "18.6", "20.3", "20.4", "21.2"] }
  ]
}
```
