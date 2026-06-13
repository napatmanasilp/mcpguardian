# Design Document — MCPGuardian UX Improvements

## Overview

This document describes the technical design for all UX improvements identified in the MCPGuardian application audit. The improvements span four priority tiers — critical bug fixes, high-priority UX, medium-priority enhancements, and low-priority polish — and touch every major page of the application.

The primary goals are:
1. Fix broken flows that block users from accessing or recovering their accounts (Req 1–4).
2. Streamline onboarding and sign-up to reduce drop-off (Req 5–8).
3. Add actionability to the Dashboard and Servers page (Req 9–10).
4. Improve investigative workflows in Activity, Compliance, Telemetry, and Sessions pages (Req 11–14).
5. Complete the Settings and Billing pages to match enterprise expectations (Req 15–17).

The stack is Next.js 15 App Router, Supabase Auth + Postgres, shadcn/ui, Tailwind CSS, and a dark theme using the `--bg-surface`, `--secure`, `--threat`, `--caution`, and `--monitor` design tokens.

---

## Architecture

The application follows Next.js App Router conventions with Server Components for data-fetching pages and Client Components for interactive islands. The architecture pattern for each improvement follows one of three shapes:

```
Shape A — Server Component page + Server Action mutation
  page.tsx (async, Server Component)
    └── fetches data via createServiceClient()
    └── renders forms bound to Server Actions in lib/actions/
    └── Client Component islands for interactive feedback (toasts, spinners)

Shape B — Client Component page (interactive UI, no SSR data need)
  page.tsx ("use client")
    └── local state + fetch/API calls
    └── useActionState for form state

Shape C — New API route for browser-initiated operations
  app/api/{resource}/route.ts
    └── validates auth
    └── executes Supabase mutation or external call
    └── returns JSON
```

Most new mutations follow Shape A, using `useActionState` for progressive enhancement. Client-side optimistic updates (inline rescan, CSV export) use Shape B or Shape C.

---

## Components and Interfaces

### Auth — Forgot Password Flow (Req 1)

**New routes:**
- `app/(auth)/forgot-password/page.tsx` — email submission form
- `app/(auth)/reset-password/page.tsx` — new password form (reads Supabase session from URL hash)

**New components:**
- `components/auth/forgot-password-form.tsx` — `"use client"`, calls `supabase.auth.resetPasswordForEmail(email, { redirectTo })`
- `components/auth/reset-password-form.tsx` — `"use client"`, calls `supabase.auth.updateUser({ password })` after reading session from the OTP exchange

**Changes to existing:**
- `components/auth/login-form.tsx` — add `<Link href="/forgot-password">` below the password `<Input>`

**Data flow:**
```
User → LoginForm → /forgot-password → ForgotPasswordForm
  → supabase.auth.resetPasswordForEmail()
  → email sent (Supabase) → user clicks link
  → /reset-password?code=... → Supabase exchanges code for session
  → ResetPasswordForm → supabase.auth.updateUser()
  → redirect /dashboard
```

**State machine in `ResetPasswordForm`:**
- `idle` → show new-password + confirm-password fields
- `mismatch` → show inline error beneath confirm field, do not call updateUser
- `submitting` → disabled button with spinner
- `error` → show Supabase error message + link to /forgot-password
- `success` → redirect to /dashboard via `router.push`

---

### Settings > General — Org Name Save Action (Req 2)

**Changes to `app/(app)/settings/general/page.tsx`:**
- Wrap the org name `<Input>` and `<Button>` inside a `<form>` element with `action={updateOrgName}`.
- Import and invoke the `updateOrgName` Server Action.

**New Server Action: `lib/actions/settings.ts` (new file)**
```typescript
"use server";
export async function updateOrgName(prevState: ActionState, formData: FormData): Promise<ActionState>
export async function updateOrgTimezone(prevState: ActionState, formData: FormData): Promise<ActionState>
export async function uploadOrgLogo(prevState: ActionState, formData: FormData): Promise<ActionState>
export async function deleteOrganization(prevState: ActionState, formData: FormData): Promise<ActionState>
```

The `updateOrgName` action:
1. Reads `name` from `formData`, validates length 1–100.
2. Gets the authenticated user via `createClient().auth.getUser()`.
3. Looks up `organization_id` from `organization_members` where `user_id = user.id` and `invitation_status = 'accepted'`.
4. Verifies the user's role is `admin` or `owner` in `organization_members`.
5. Calls `svc.from("organizations").update({ name }).eq("id", orgId)`.
6. Returns `{ success: true }` or `{ error: string }`.

**Client wiring:** The page converts to a hybrid pattern — the `<form>` uses `useActionState` from a small `"use client"` wrapper component so the parent server component can still SSR the initial data.

---

### Alerts — Navigation to Related Context (Req 3)

**Changes to `app/(app)/alerts/page.tsx`:**
- The alerts query must also select `session_id` and `server_id` columns (currently omitted).
- Replace the `<form action={...}>` / `<button type="submit">` pattern on each alert row with an async click handler on a `<div>` (or a Client Component wrapper) that:
  1. POSTs to `/api/alerts/[alertId]/mark-read` (or calls a Server Action via router).
  2. Resolves the navigation target using the priority logic:
     - `session_id` non-null → `/sessions/{session_id}`
     - `server_id` non-null → `/servers/{server_id}`
     - both null or referent missing → `/activity`
  3. Calls `router.push(target)`.

**Filter state persistence:** The existing URL-based filters (`severity`, `status`) are already encoded in the URL. No additional work is needed for Req 3.6 — the browser back button naturally restores the URL.

**New API route: `app/api/alerts/[alertId]/mark-read/route.ts`**
```
POST /api/alerts/{alertId}/mark-read
  → updates alerts SET read = true WHERE id = alertId AND organization_id = orgId
  → returns 200 { ok: true }
```

---

### Server Detail — Scan Link Route (Req 4)

**New route: `app/(app)/reports/[scanId]/page.tsx`** — Server Component
- Fetches the scan record from `scans` table filtered by `scan_id = scanId` and `organization_id = orgId`.
- If not found: renders a 404 UI with a back link to `/servers/{serverId}/scans`.
- If found: renders the full scan report (reusing `components/scan/issue-card.tsx`, `components/scan/mini-score-ring.tsx`).

**Changes to `app/(app)/servers/[serverId]/page.tsx`:**
- Fix the scan row link from the current (broken) path to `/reports/{scan.id}`.
- Limit the displayed recent scans list to 5 items (`.limit(5)` on the query or slice client-side).

---

### Signup Improvements (Req 5)

**Changes to `components/auth/signup-form.tsx`:**
- Remove the `confirmPassword` field entirely.
- Add Google OAuth button alongside the existing GitHub button using `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: .../auth/callback?next=/onboarding } })`.
- Add a `<PasswordStrengthMeter password={passwordValue} />` component rendered beneath the password input.
- Add "Terms of Service" link: `<a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>`.
- Client-side gate: if strength === "weak", call `e.preventDefault()` and show an inline error rather than submitting.

**New component: `components/auth/password-strength-meter.tsx`** (`"use client"`)

```typescript
interface Props { password: string }
export type StrengthLevel = "weak" | "fair" | "strong";

export function computeStrength(password: string): StrengthLevel {
  if (password.length < 8) return "weak";
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigitOrSpecial = /[0-9!-/:-@[-`{-~]/.test(password);
  if (hasUpper && hasLower && hasDigitOrSpecial) return "strong";
  return "fair";
}
```

The `computeStrength` function is a pure function — this is the testable unit.

UI: three horizontal segments rendered with `--secure` (strong), amber (fair), `--threat` (weak) colors and the label text "Weak" / "Fair" / "Strong".

**New auth callback route update:** `app/auth/callback/route.ts` must already handle `next` redirects; confirm `/onboarding` is a valid post-OAuth redirect.

---

### Onboarding Step 1 — Split Form and Scan (Req 6)

**Changes to `app/(app)/onboarding/page.tsx`:**
- The two screen states (`form` and `scanning`/`complete`) are already separate in the existing code — the implementation is largely correct.
- The `OnboardingSteps` component labels need updating.

**Changes to `components/onboarding/onboarding-steps.tsx`:**
- Update step labels from `["Register", "Scan", "Proxy", "Done"]` to `["Create Org", "Scan Server", "Connect Proxy", "Done"]`.
- Update step rendering to use `var(--secure)` for completed/active steps and `var(--monitor)` for the active indicator (currently uses `bg-blue-500` hard-coded).
- The logic already renders index 0 active on the form screen and index 1 on the scanning screen.

**Error handling:** If `handleCreate` throws, the existing `catch` block already sets `setStep("form")` and sets `setScanError`. Add display of `scanError` in the form view.

---

### Onboarding Step 2 — Client Instructions and Debug Checklist (Req 7)

**Changes to `app/(app)/onboarding/proxy-setup/page.tsx`:**

The page must be converted to a Client Component (`"use client"`) to support tab switching and timeout detection.

**New component: `components/onboarding/client-instructions.tsx`** — tab switcher

```typescript
const CLIENTS = ["Claude Desktop", "Cursor", "Cline", "Custom"] as const;
type MCPClient = (typeof CLIENTS)[number];
```

Each tab panel renders:
- **Claude Desktop:** Edit path instructions for macOS (`~/Library/Application Support/Claude/claude_desktop_config.json`) and Windows (`%APPDATA%\Claude\claude_desktop_config.json`). Add proxy URL under `mcpServers` key. Copy/paste code block.
- **Cursor:** Cursor Settings → MCP → Add Server → paste proxy URL + Authorization header.
- **Cline:** MCP Servers panel → Add Server → HTTP transport → paste proxy URL + bearer token.
- **Custom:** Generic JSON showing `{ "url": "<proxy_url>", "headers": { "Authorization": "Bearer <token>" } }`.

**Timeout / debug checklist:**
- A `useEffect` starts a 3-minute timer when the component mounts.
- If no successful `tool_call` webhook is received within 3 minutes (poll `/api/proxy/connection-status` every 10 seconds), set `connectionState = "timeout"`.
- When `connectionState === "timeout"`, render the debug checklist below the instructions.

---

### Onboarding Step 3 — What Now? (Req 8)

**Changes to `app/(app)/onboarding/confirmed/page.tsx`:**

Convert to a Server Component that fetches the most recent scan ID for the org.

```typescript
const { data: latestScan } = await svc
  .from("scans")
  .select("id")
  .eq("organization_id", orgId)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

const scanTarget = latestScan ? `/reports/${latestScan.id}` : "/servers";
```

Add a `SuccessAnimation` Client Component (`components/onboarding/success-animation.tsx`) that renders only when `proxy === "connected"`. Uses CSS keyframe animation completing within 2 seconds.

The "What now?" section renders three `<Link>` cards:
1. "View scan report" → `scanTarget`
2. "Add another server" → `/servers/new`
3. "Invite a teammate" → `/settings/team`

---

### Dashboard — Quick Actions, NSA Teaser, Threat Count Link (Req 9)

**Changes to `app/(app)/dashboard/page.tsx`:**

**Quick Actions Bar** — insert above the two-column KPI layout:
```tsx
<QuickActionsBar
  mostRecentServerId={servers?.[0]?.id ?? null}
/>
```

New `components/dashboard/quick-actions-bar.tsx` (Client Component):
- "Scan Now": if `mostRecentServerId` is non-null, push `/servers/{id}`; else push `/servers/new`.
- "Add Server": push `/servers/new`.
- "View Alerts": push `/alerts`.

**NSA Compliance Teaser** — add alongside or below the paid-plan NSA panel:
```tsx
{!isPaidPlan && (
  <NSAComplianceTeaser />
)}
```

New `components/dashboard/nsa-compliance-teaser.tsx`:
- Displays: "NSA MCP Security CSI — 8 controls"
- CTA button: "Upgrade to unlock full compliance reporting" → `<Link href="/upgrade">`

**Threat count link** — in the status strip, replace:
```tsx
<span className="text-amber-400">{threatCount} active threat{...}</span>
```
with:
```tsx
{threatCount > 0 ? (
  <Link href="/alerts?severity=critical" className="text-amber-400 hover:underline">
    {threatCount} active threat{threatCount !== 1 ? "s" : ""}
  </Link>
) : (
  <span className="text-amber-400">0 active threats</span>
)}
```

---

### Servers Page — Inline Rescan and Add-Server Modal (Req 10)

**Add-Server Route: `app/(app)/servers/new/page.tsx`** (new)
- Server Component that renders a `<AddServerForm>` Client Component.
- The form collects: server name, transport type (HTTP/STDIO toggle), endpoint URL or STDIO command.
- On submit, calls `POST /api/servers` with `{ name, transportType, endpointUrl | stdioCommand }`.
- The API route registers the server under the user's org, enqueues an initial scan, then the client redirects to `/servers`.
- No org creation step — the user is already authenticated with an org.

**Inline Rescan on `app/(app)/servers/page.tsx`:**
- Page must be refactored to use Client Components for the server rows, or individual rows must use a `RescanButton` Client Component.
- New `components/servers/rescan-button.tsx` (`"use client"`):
  - Props: `serverId: string`
  - State: `scanning: boolean`, `error: string | null`
  - On click: `POST /api/servers/{serverId}/rescan`, sets `scanning = true`, disables button.
  - On success: calls a callback to update `last_scan_at` and `risk_score` in the parent list state (passed as prop, or handled via SWR/React Query refresh, or a simple `router.refresh()`).
  - On error: re-enables button, sets error message.

**New API route: `app/api/servers/[serverId]/rescan/route.ts`**
```
POST /api/servers/{serverId}/rescan
  → validates org membership
  → inserts a new scan job or calls the scanner pipeline
  → returns { scanId, status }
```

The `Add Server` button in the header of `servers/page.tsx` changes from `<Link href="/onboarding">` to `<Link href="/servers/new">`.

---

### Activity / Threat Log (Req 11)

**Changes to `app/(app)/activity/page.tsx`:**

Convert to a Client Component (or use a Server Component + Client wrapper) to support "Load more" state and CSV export.

**Data model changes:**
- The merged `allEvents` array must retain `session_id` and `mcp_server_id` from each source:
  - `tool_invocation_logs`: `session_id`, `mcp_server_id`
  - `alerts`: add `session_id` and `server_id` to the select query

**Page heading and browser title:** Add `<title>Threat Log — MCPGuardian</title>` via the `export const metadata` export or a `<Head>` equivalent. The heading already reads "Threat Log".

**Sidebar:** Already correct — `dashboard-sidebar.tsx` already has `label: "Threat Log"` for `/activity`.

**Load more:** Initial load is 50 events. A `loadMore()` function fetches the next 50 with offset and appends to the `events` state. The "Load more" button is shown only when the last fetch returned exactly 50 results (i.e., there may be more).

**Event row linking:**
```typescript
function EventRow({ event }: { event: MergedEvent }) {
  const href = event.session_id
    ? `/sessions/${event.session_id}`
    : event.server_id
    ? `/servers/${event.server_id}`
    : null;

  const content = <div className="...">{/* event content */}</div>;
  return href ? <Link href={href}>{content}</Link> : content;
}
```

**CSV Export:**
```typescript
function exportCsv(events: MergedEvent[]) {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const filename = `threat-log-${date}.csv`;
  const headers = ["id", "type", "title", "description", "severity", "session_id", "server_id", "created_at"];
  const rows = events.map((e) => [
    e.id, e.type, e.title, e.description, e.severity,
    e.session_id ?? "", e.server_id ?? "",
    new Date(e.createdAt).toISOString(), // ISO 8601 UTC
  ]);
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
```

---

### Compliance Page (Req 12)

**Changes to `app/(app)/compliance/page.tsx`:**

**Score calculation fix:**
```typescript
const nonRoadmapControls = NSA_CONTROLS.filter((c) => c.defaultStatus !== "roadmap");
const passedNonRoadmap = nonRoadmapControls.filter(
  (c) => resolvedStatus(c, assessment) === true
).length;
const score = Math.round((passedNonRoadmap / nonRoadmapControls.length) * 100);
```

**Roadmap section:** Roadmap controls are moved out of the main controls list into a visually distinct "Coming Soon" section using a different card styling and a `<Badge>` showing "Q3 2026" (or the relevant date).

**Framework tabs:** Add a `FrameworkTabs` Client Component using shadcn/ui `Tabs`:
- Tab 1: "NSA MCP CSI" — current controls list
- Tab 2: "OWASP MCP Top 10" — OWASP MCP risk categories MCP01–MCP10

**OWASP data:** Add OWASP MCP Top 10 control definitions to `lib/compliance-mappings.ts` (the file already exists). Each has: `id`, `label`, `description`, and a computed `passed` status derived from `nsa_compliance_assessments` where mappable, or a static default.

**Request PDF button:**
```typescript
// In compliance page, new Server Action in lib/actions/compliance.ts:
export async function requestPdfReport(prevState, formData): Promise<ActionState>
// Inserts a record in pdf_generation_requests table or enqueues via background job
```
Button state uses `useActionState`. Pending state shows "Generating…" and disables the button.

---

### Telemetry Page (Req 13)

**Changes to `app/(app)/telemetry/page.tsx`:**

**Sparkline component:** New `components/telemetry/sparkline.tsx` — a lightweight SVG sparkline:
```typescript
interface SparklineProps {
  data: number[];      // latency_ms values, oldest first
  width?: number;
  height?: number;
  color?: string;
}
```
Uses a simple SVG polyline. No chart library needed (avoids bundle size).

**Data fetching change:** Fetch per-server the 24 most recent `server_health_metrics` records ordered by `recorded_at` ascending:
```sql
SELECT mcp_server_id, latency_ms, is_reachable, recorded_at
FROM server_health_metrics
WHERE organization_id = $1
  AND recorded_at >= NOW() - INTERVAL '30 days'
ORDER BY mcp_server_id, recorded_at ASC
```
Group client-side by `mcp_server_id` and take the last 24 per server.

**Uptime calculation:**
```typescript
function computeUptime(metrics: HealthMetric[]): string {
  const last30 = metrics.filter(
    (m) => new Date(m.recorded_at) >= subDays(new Date(), 30)
  );
  if (last30.length === 0) return "—";
  const reachable = last30.filter((m) => m.is_reachable).length;
  return (Math.round((reachable / last30.length) * 1000) / 10).toFixed(1) + "%";
}
```

**Insufficient data guard:** If the total record count for a server is < 5, render "Insufficient data" in the sparkline cell and the uptime cell.

**"View full log →" link:** Add to the page header:
```tsx
<Link href="/activity" className="text-xs text-blue-400">View full log →</Link>
```

---

### Sessions Page (Req 14)

**Changes to `app/(app)/sessions/page.tsx`:**

**Date range filter:** Add URL search params `from` and `to`. The page already reads `searchParams`; extend the query:
```typescript
if (from) query = query.gte("started_at", `${from}T00:00:00.000Z`);
if (to)   query = query.lte("started_at", `${to}T23:59:59.999Z`);
```
Render two `<input type="date">` fields in a `<form>` that submits via GET (preserves status filter). Labels: "From" and "To".

**Rug pull tooltip:** Use a `<TooltipProvider>` + `<Tooltip>` from shadcn/ui (need to add `components/ui/tooltip.tsx` if not present). Wrap every instance of "rug pull" text (filter pill + session row badge) with the tooltip. Tooltip content:
> "Rug pull: the MCP server attempted to exfiltrate data or execute unauthorized actions, causing the session to be terminated."

**Tool call count header:**
```typescript
const totalToolCalls = (sessions ?? []).reduce(
  (sum, s) => sum + (s.tool_call_count ?? 0), 0
);
```
Add to the header: `<span className="text-slate-400">{totalToolCalls.toLocaleString()} tool calls total</span>`.

---

### Settings > General — Logo, Timezone, Delete Org (Req 15)

**Changes to `app/(app)/settings/general/page.tsx`:**

**Logo upload:**
```typescript
// components/settings/org-logo-upload.tsx ("use client")
// <input type="file" accept="image/png,image/jpeg,image/svg+xml" />
// Client-side validation: file.size <= 2 * 1024 * 1024 && MIME_WHITELIST.includes(file.type)
// On valid selection: upload to Supabase Storage "org-logos" bucket
// Persist public URL to organizations.logo_url
```

**Timezone selector:**
```typescript
// components/settings/timezone-selector.tsx ("use client")
// Uses Intl.supportedValuesOf("timeZone") to get IANA list
// Renders a <Select> from shadcn/ui
// Pre-selects org.timezone
// On save: calls updateOrgTimezone server action
```

**Danger Zone — Delete Organization:**
```typescript
// components/settings/delete-org-section.tsx ("use client")
// Renders a red-bordered Card with "Delete Organization" Button
// Click → opens <AlertDialog> (already in components/ui/)
// Dialog body: "Type your organization name to confirm deletion"
// <Input> tracks typed value; "Confirm Delete" Button disabled until typed === orgName
// On confirm: calls deleteOrganization server action → redirect to /signup
```

The `deleteOrganization` server action in `lib/actions/settings.ts`:
1. Verifies user is owner of the org.
2. Deletes all associated records (servers, sessions, scans, alerts, members).
3. Deletes the organization record itself.
4. Returns `{ success: true }` → client redirects to `/signup`.

---

### Settings > Billing — Annual Switch and Invoice History (Req 16)

**Changes to `app/(app)/settings/billing/page.tsx`:**

**Annual switch:** Change the "Switch to Annual" button from a no-op to a functional handler:
```typescript
// components/billing/annual-switch-button.tsx ("use client")
async function switchToAnnual() {
  const res = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planId: currentPlanId, billingCycle: "annual" }),
  });
  const data = await res.json();
  if (data.checkoutUrl) window.location.href = data.checkoutUrl;
}
```

**Invoice history:** Add to the billing page after the add-ons card:
```typescript
// Server Component section in billing/page.tsx
const { data: invoices } = await svc
  .from("invoices")
  .select("id, created_at, amount_paid, currency, status, hosted_invoice_url")
  .eq("organization_id", membership.organization_id)
  .order("created_at", { ascending: false });
```

If the `invoices` table doesn't yet exist in the schema, it is populated via a Stripe/Polar webhook handler that inserts invoice records on `invoice.payment_succeeded` events.

Each invoice row:
```tsx
<div>
  <span>{format(new Date(invoice.created_at), "MMM d, yyyy")}</span>
  <span>{formatCurrency(invoice.amount_paid, invoice.currency)}</span>
  <Badge>{invoice.status}</Badge>
  {invoice.hosted_invoice_url && (
    <a href={invoice.hosted_invoice_url} target="_blank" rel="noopener noreferrer">
      Download
    </a>
  )}
</div>
```

---

### Upgrade / Pricing Page (Req 17)

**Changes to `app/(app)/upgrade/page.tsx`:**

**Feature Comparison Table:** New `components/upgrade/feature-comparison-table.tsx`:
- Column headers: Free, Developer, Team, Startup, Enterprise
- Rows: scans/month, tool calls/month, seats, MCP servers, runtime proxy protection, sandbox execution, NSA compliance reports, support tier, scan retention.
- Cells: `<Check className="text-emerald-400" />` for included, `<Minus className="text-slate-600" />` for not included.

**Enterprise contact:** Change the Enterprise CTA button from `mailto:sales@mcpguardian.dev` to `router.push("/contact")`.

**New route: `app/(app)/contact/page.tsx`** (or `app/contact/page.tsx` if available outside auth):
- Renders an inquiry form: name, email, company, message — submits to `POST /api/contact`.
- Alternatively, renders an embedded Calendly widget via `<iframe>`.

**Social Proof:** New `components/upgrade/social-proof-section.tsx`:
- Renders a live or static metric fetched from the dashboard (e.g., total `tool_invocation_logs` count, or a static hardcoded figure).
- Or renders customer testimonial quotes with attribution.
- Positioned above the pricing card grid.

---

## Data Models

### New/Changed Database Tables

**`invoices`** (new — or populated by existing billing webhook)
```sql
CREATE TABLE invoices (
  id                  TEXT PRIMARY KEY,
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  amount_paid         INTEGER NOT NULL,   -- in cents
  currency            TEXT NOT NULL DEFAULT 'usd',
  status              TEXT NOT NULL,      -- 'paid' | 'open' | 'void'
  hosted_invoice_url  TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**`organizations`** (new columns)
```sql
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS timezone  TEXT DEFAULT 'UTC';
```

**`pdf_generation_requests`** (new — for compliance PDF queue)
```sql
CREATE TABLE pdf_generation_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status          TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'processing' | 'done' | 'failed'
  pdf_url         TEXT,
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);
```

**`alerts`** (confirm columns exist)
```sql
-- These columns must be present (add if missing):
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES proxy_sessions(id) ON DELETE SET NULL;
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS server_id  UUID REFERENCES mcp_servers(id) ON DELETE SET NULL;
```

**`tool_invocation_logs`** (confirm column)
```sql
-- session_id and mcp_server_id already present per existing code
-- No migration needed
```

### TypeScript Interfaces

```typescript
// lib/types/settings.ts
export interface ActionState {
  success?: boolean;
  error?: string;
}

// lib/types/invoice.ts
export interface Invoice {
  id: string;
  organization_id: string;
  amount_paid: number;
  currency: string;
  status: "paid" | "open" | "void";
  hosted_invoice_url: string | null;
  created_at: string;
}

// lib/types/activity.ts
export interface MergedEvent {
  id: string;
  type: "threat" | "alert";
  title: string;
  description: string;
  severity: "critical" | "high" | "medium";
  session_id: string | null;
  server_id: string | null;
  createdAt: string;
}

// components/auth/password-strength-meter.tsx
export type StrengthLevel = "weak" | "fair" | "strong";
export function computeStrength(password: string): StrengthLevel;
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

---

### Property 1: Forgot-password form shows success for any valid email

*For any* string that is a syntactically valid email address, submitting it to the forgot-password form should result in a success confirmation message being displayed on the same page, regardless of whether the email is registered.

**Validates: Requirements 1.3, 1.4**

---

### Property 2: Password strength classification covers all inputs

*For any* password string, the `computeStrength` function must return exactly one of three levels according to these rules:
- Returns `"weak"` if and only if `password.length < 8`
- Returns `"strong"` if and only if `password.length >= 8` AND the password contains at least one uppercase letter, at least one lowercase letter, and at least one digit or non-alphanumeric printable ASCII character
- Returns `"fair"` for all other inputs (length ≥ 8 but missing at least one required character class)

**Validates: Requirements 5.5, 5.6, 5.7**

---

### Property 3: Mismatched passwords always block form submission

*For any* two distinct password strings `p1` and `p2` where `p1 ≠ p2`, submitting them as the new-password and confirm-password fields on the reset-password form should display an inline validation error beneath the confirm-password field and must not call `supabase.auth.updateUser`.

**Validates: Requirements 1.7**

---

### Property 4: Weak password blocks signup submission

*For any* password string that `computeStrength` classifies as `"weak"`, attempting to submit the signup form should display an inline error message beneath the password field and must not invoke the signup server action.

**Validates: Requirements 5.9**

---

### Property 5: Org name persistence round trip

*For any* non-empty string `s` of length 1–100 characters, submitting `s` as the organization name via the General Settings form should result in the `organizations.name` column being equal to `s` when read back from the database for that organization.

**Validates: Requirements 2.2**

---

### Property 6: Server detail shows at most 5 recent scans

*For any* server with `n > 5` total scan records in the `scans` table, the Server_Detail_Page should display exactly 5 entries, and those 5 entries must be the ones with the most recent `created_at` timestamps.

**Validates: Requirements 4.4**

---

### Property 7: Onboarding Stepper renders correct state for any step index

*For any* step index `i` in `{0, 1, 2, 3}`, the `OnboardingSteps` component must render:
- Exactly one step (index `i`) as the active step (filled/highlighted indicator)
- All steps with index `< i` with a checkmark icon using the `--secure` design token
- All steps with index `> i` with an unfilled indicator

**Validates: Requirements 6.4, 6.5, 6.6**

---

### Property 8: Onboarding Step 2 tab content is mutually exclusive

*For any* client tab value in `{"Claude Desktop", "Cursor", "Cline", "Custom"}`, after selecting that tab:
- The content panel for the selected tab must be visible
- The content panels for all other three tabs must not be visible
- The instructions displayed must reference that client's specific configuration file path or UI location

**Validates: Requirements 7.1, 7.3, 7.4, 7.5, 7.6**

---

### Property 9: "Scan Now" navigates to the most recently created server

*For any* non-empty list of servers for the organization, each with a distinct `created_at` timestamp, clicking the "Scan Now" button on the Dashboard Quick Actions Bar should navigate to `/servers/{id}` where `id` is the `id` of the server with the maximum `created_at` value in the list.

**Validates: Requirements 9.2**

---

### Property 10: Threat count renders as a link for any positive count

*For any* integer `threatCount > 0` in the Dashboard status strip, the threat count element must be rendered as an anchor or Next.js `<Link>` element with `href="/alerts?severity=critical"` rather than as non-interactive plain text.

**Validates: Requirements 9.8**

---

### Property 11: Every server row has a Rescan button

*For any* non-empty list of servers rendered on the Servers_Page, every server row in both list view and grid view must contain a "Rescan" button element that is enabled by default (not disabled) before a rescan is initiated.

**Validates: Requirements 10.1**

---

### Property 12: "Load more" visibility is determined by event count threshold

*For any* total event count `n` returned by the organization's event query:
- If `n > 50`, the Activity_Page must display a "Load more" button
- If `n ≤ 50`, the Activity_Page must NOT display a "Load more" button

**Validates: Requirements 11.3, 11.4**

---

### Property 13: Activity event row link target follows session_id / server_id priority

*For any* event in the Activity_Page event list:
- If `event.session_id` is non-null, the row must render as a link to `/sessions/{event.session_id}` regardless of `event.server_id`
- If `event.session_id` is null and `event.server_id` is non-null, the row must render as a link to `/servers/{event.server_id}`
- If both are null, the row must render as non-interactive (no wrapping link element)

**Validates: Requirements 11.6, 11.7, 11.8**

---

### Property 14: CSV export contains required columns and correct formatting

*For any* list of `n` loaded events on the Activity_Page, invoking the CSV export should produce a file where:
- The filename matches the pattern `threat-log-YYYY-MM-DD.csv` using today's UTC date
- The first row is a header row containing exactly: `id, type, title, description, severity, session_id, server_id, created_at`
- Every event's `created_at` value is formatted as an ISO 8601 UTC string (ending in `Z` or `+00:00`)
- The file contains exactly `n + 1` rows (1 header + n data rows)

**Validates: Requirements 11.10**

---

### Property 15: Compliance score excludes roadmap controls

*For any* list of NSA controls containing a mix of `defaultStatus: "roadmap"` items and non-roadmap items, the computed compliance score must equal:

`Math.round((passedNonRoadmapCount / totalNonRoadmapCount) * 100)`

where `passedNonRoadmapCount` counts only non-roadmap controls with `passed = true`, and `totalNonRoadmapCount` counts only non-roadmap controls. Roadmap controls must contribute `0` to both the numerator and denominator.

**Validates: Requirements 12.1**

---

### Property 16: Sparkline data is ordered oldest-to-newest

*For any* list of `server_health_metrics` records for a server, the sparkline component must render its data points in ascending order of `recorded_at` — the leftmost point corresponds to the oldest record, and the rightmost point corresponds to the newest record.

**Validates: Requirements 13.1**

---

### Property 17: Uptime percentage formula correctness

*For any* server with at least 5 `server_health_metrics` records in the last 30 days, where `r` records have `is_reachable = true` and the total count is `t`, the displayed uptime must equal `(Math.round(r / t * 1000) / 10).toFixed(1) + "%"`. For a server with `t = 0`, the uptime must display `"—"`.

**Validates: Requirements 13.2, 13.3**

---

### Property 18: Insufficient data threshold applies to both sparkline and uptime

*For any* server with fewer than 5 total `server_health_metrics` records (regardless of date range), both the sparkline chart element and the uptime percentage display for that server must show `"Insufficient data"` rather than any computed value.

**Validates: Requirements 13.4**

---

### Property 19: Session date range filter is inclusive of boundary values

*For any* date range inputs `(from, to)` applied on the Sessions_Page:
- When both are provided: only sessions with `started_at ∈ [from + 00:00:00 UTC, to + 23:59:59 UTC]` are returned; sessions outside this range must not appear
- When only `from` is provided: only sessions with `started_at ≥ from + 00:00:00 UTC` are returned, with no upper bound
- When only `to` is provided: only sessions with `started_at ≤ to + 23:59:59 UTC` are returned, with no lower bound

**Validates: Requirements 14.2, 14.3, 14.4**

---

### Property 20: Rug pull tooltip appears on every rug pull label

*For any* session with `status = "terminated_rug_pull"`, every rendered label for that session (including the status filter pill and any row badge) must have an accessible tooltip with the exact text: "Rug pull: the MCP server attempted to exfiltrate data or execute unauthorized actions, causing the session to be terminated."

**Validates: Requirements 14.5**

---

### Property 21: Header tool call count equals the sum of displayed sessions

*For any* set of sessions currently displayed on the Sessions_Page, the tool call count shown in the page header must equal the sum of `tool_call_count` values across all displayed session records. If any session has a null `tool_call_count`, it must be treated as `0` in the sum.

**Validates: Requirements 14.6**

---

### Property 22: File validation rejects any oversized or wrong-MIME upload

*For any* file `f` selected in the organization logo upload control:
- If `f.size > 2 * 1024 * 1024` (2 MB) OR `f.type ∉ {"image/png", "image/jpeg", "image/svg+xml"}`, an inline validation error must be displayed beneath the upload control, and `f` must NOT be uploaded to Supabase Storage
- If both conditions are met (wrong MIME and oversized), the error must still be shown and upload blocked

**Validates: Requirements 15.3**

---

### Property 23: Delete confirmation requires exact org name match

*For any* string `s` typed into the delete confirmation dialog, the "Confirm Delete" button must remain disabled (not clickable) if and only if `s !== organizationName` (exact, case-sensitive string equality). The button must be enabled if and only if `s === organizationName`.

**Validates: Requirements 15.9**

---

### Property 24: Every invoice row contains all required fields

*For any* invoice record in the Invoice_History list, its rendered row must include all four of: the invoice date formatted as a human-readable string, the amount formatted with the currency symbol (e.g., `$29.00`), a status badge with value `"paid"`, `"open"`, or `"void"`, and a download link (or the text "No invoices yet" if the list is empty).

**Validates: Requirements 16.2, 16.3**

---

### Property 25: Invoice download links have correct security attributes

*For any* invoice record with a non-null `hosted_invoice_url`, the download link rendered for that invoice must be an `<a>` element with both `target="_blank"` and `rel="noopener noreferrer"` attributes set.

**Validates: Requirements 16.4**

---

### Property 26: Feature comparison table uses correct notation per plan

*For any* feature row and plan column in the Feature_Comparison_Table, the cell must display a checkmark icon (`✓` or a `<Check>` component) if the feature is included in that plan, and a dash (`–` or a `<Minus>` component) if it is not included — with no other notation used.

**Validates: Requirements 17.2**

---

## Error Handling

### Auth Flows
- **Forgot password — Supabase rate limit:** If `resetPasswordForEmail` returns a rate-limit error, display "Too many requests. Please try again in a few minutes." and keep the form enabled.
- **Reset password — expired token:** Supabase returns an error when the OTP token is expired or invalid. The `ResetPasswordForm` catches this and renders the error state with a link back to `/forgot-password`.
- **OAuth errors:** If `signInWithOAuth` fails, `toast.error(error.message)` is displayed (matches existing pattern in `login-form.tsx`).

### Mutations
- **Org name save:** DB errors are caught in the server action and returned as `{ error: string }`. The page displays an error toast and preserves the input value.
- **Rescan:** API errors render an inline error message on the specific server row. Other rows are unaffected.
- **Logo upload:** Client-side MIME/size validation prevents the upload call entirely. If the Supabase Storage upload fails, a toast error is shown.
- **Delete org:** If the server action fails mid-way (partial delete), the error is surfaced as a toast and the user remains on the settings page.

### Data Fetching
- All server-component pages use `.maybeSingle()` or `.limit(1).maybeSingle()` to avoid throwing on empty results.
- Any page that requires org membership redirects to `/onboarding` when `membership` is null.
- Report pages (Req 4) use a `notFound()` call pattern rather than throwing.

### CSV Export
- If the events list is empty, the CSV export still produces a header-only file (1 row) rather than an error.
- `URL.createObjectURL` is called inside a `try/finally` to ensure `revokeObjectURL` is always called.

---

## Testing Strategy

### Unit Tests (example-based)

Unit tests cover specific behaviors and concrete examples. These complement the property tests by covering deterministic cases, UI structure, and error paths. Use Vitest + React Testing Library.

Key example-based tests:
- `ForgotPasswordForm` renders "Check your email" state after submission
- `ResetPasswordForm` renders mismatch error when passwords differ
- `LoginForm` renders "Forgot password?" link below the password input
- `OnboardingSteps` renders correct labels: "Create Org", "Scan Server", "Connect Proxy", "Done"
- `ClientInstructions` defaults to "Claude Desktop" tab on first render
- `DashboardPage` does not render `NSAComplianceTeaser` when plan is not free
- `AddServerForm` does not render an org name field
- `BillingSettingsPage` shows "No invoices yet" when invoice list is empty
- Alert row navigation: session_id present → navigates to `/sessions/{id}`; server_id present → navigates to `/servers/{id}`

### Property-Based Tests

Property tests verify universal invariants across generated inputs. Use **fast-check** (TypeScript-native PBT library).

Each property test must run a minimum of **100 iterations** and be tagged with a comment in the following format:
```typescript
// Feature: mcpguardian-ux-improvements, Property {N}: {property_text}
```

**P2 — Password strength classification:**
```typescript
// Feature: mcpguardian-ux-improvements, Property 2: Password strength classification covers all inputs
fc.assert(fc.property(fc.string(), (password) => {
  const result = computeStrength(password);
  if (password.length < 8) return result === "weak";
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasDigitOrSpecial = /[0-9!-/:-@[-`{-~]/.test(password);
  if (hasUpper && hasLower && hasDigitOrSpecial) return result === "strong";
  return result === "fair";
}));
```

**P5 — Org name persistence round trip:**
```typescript
// Feature: mcpguardian-ux-improvements, Property 5: Org name persistence round trip
fc.assert(fc.property(fc.string({ minLength: 1, maxLength: 100 }), async (name) => {
  // Call updateOrgName server action with name
  // Read back from test DB
  // Assert organizations.name === name
}));
```

**P6 — Server detail shows at most 5 recent scans:**
```typescript
// Feature: mcpguardian-ux-improvements, Property 6: Server detail shows at most 5 recent scans
fc.assert(fc.property(fc.array(fc.record({ id: fc.uuid(), created_at: fc.date() }), { minLength: 6, maxLength: 50 }), (scans) => {
  const displayed = getRecentScans(scans); // function under test
  return displayed.length === 5 &&
    displayed.every((s) => scans.slice().sort((a, b) => b.created_at - a.created_at).slice(0, 5).some((r) => r.id === s.id));
}));
```

**P12 — Load more visibility threshold:**
```typescript
// Feature: mcpguardian-ux-improvements, Property 12: Load more button visibility follows n>50 threshold
fc.assert(fc.property(fc.integer({ min: 0, max: 500 }), (n) => {
  const showButton = shouldShowLoadMore(n); // pure function: n => n > 50
  return n > 50 ? showButton === true : showButton === false;
}));
```

**P15 — Compliance score excludes roadmap controls:**
```typescript
// Feature: mcpguardian-ux-improvements, Property 15: Compliance score excludes roadmap controls
fc.assert(fc.property(
  fc.array(fc.record({
    defaultStatus: fc.oneof(fc.constant("passed"), fc.constant("roadmap")),
    passed: fc.boolean(),
  }), { minLength: 1, maxLength: 20 }),
  (controls) => {
    const nonRoadmap = controls.filter((c) => c.defaultStatus !== "roadmap");
    if (nonRoadmap.length === 0) return true; // guard
    const expected = Math.round(nonRoadmap.filter((c) => c.passed).length / nonRoadmap.length * 100);
    return computeComplianceScore(controls) === expected;
  }
));
```

**P19 — Session date range filter:**
```typescript
// Feature: mcpguardian-ux-improvements, Property 19: Session date range filter is inclusive of boundary values
fc.assert(fc.property(
  fc.date(), fc.date(), fc.array(fc.record({ started_at: fc.date(), id: fc.uuid() })),
  (fromDate, toDate, sessions) => {
    const from = fromDate < toDate ? fromDate : toDate;
    const to   = fromDate < toDate ? toDate : fromDate;
    const filtered = applyDateFilter(sessions, from, to);
    return filtered.every((s) =>
      new Date(s.started_at) >= startOfDay(from) &&
      new Date(s.started_at) <= endOfDay(to)
    );
  }
));
```

**P23 — Delete org confirmation requires exact match:**
```typescript
// Feature: mcpguardian-ux-improvements, Property 23: Delete confirmation requires exact org name match
fc.assert(fc.property(fc.string(), fc.string({ minLength: 1 }), (typed, orgName) => {
  const enabled = isDeleteConfirmEnabled(typed, orgName);
  return (typed === orgName) === enabled;
}));
```

**P2 (computeStrength) and P7 (Stepper rendering), P13 (event row link logic), P21 (tool call sum), P22 (file validation), P24 (invoice row fields), P25 (anchor attributes), P26 (comparison table notation)** are all pure functions that can be extracted and tested with fast-check without any browser/DOM environment.

### Integration Tests
- Supabase row-level security: verify that org name update is rejected when user is not an admin/owner (use a test user with member role).
- Forgot password email: verify that `supabase.auth.resetPasswordForEmail` is called with the correct redirect URL (mock Supabase in integration test).
- Rescan API: verify that `POST /api/servers/{serverId}/rescan` returns 403 for cross-org access attempts.
- Invoice webhook: verify that a Stripe `invoice.payment_succeeded` event correctly inserts an `invoices` row.

### Smoke Tests
- `/reports/[scanId]` route exists and renders without crashing for a valid scan ID.
- `/forgot-password` and `/reset-password` routes exist and render the expected form elements.
- `/servers/new` route renders without the org name field.
- `/contact` route renders either a form or Calendly widget.
- Sidebar navigation label for `/activity` reads "Threat Log".
