# Implementation Plan: Pricing Tiers

## Overview

Implement a 5-tier subscription model for MCPGuardian with a single source of truth tier catalog, database reconciliation migration, atomic usage tracking, pure-function quota enforcement, Polar.sh subscription management, and updated UI. All tier values are reconciled to the canonical pricing table defined in the requirements.

## Tasks

- [x] 1. Create tier catalog single source of truth
  - [x] 1.1 Create `lib/tier-catalog.ts` with `TierId`, `BillingCycle`, `TierDefinition` types and the `TIER_CATALOG` constant
    - Define `TierId = 'free' | 'developer' | 'team' | 'startup' | 'enterprise'`
    - Define `BillingCycle = 'monthly' | 'annual'`
    - Define `TierDefinition` interface with id, displayName, monthlyPriceCents, annualPricePerMonthCents, scanAllowance, toolCallAllowance, seatLimit, mcpServerLimit
    - Export `TIER_CATALOG` with canonical values: Free($0, 50 scans, 5K tool calls), Developer($29, 100 scans, 25K), Team($99, 500 scans, 150K), Startup($299, 2000 scans, 500K), Enterprise(custom, unlimited)
    - Export `VALID_TIER_IDS` array
    - Export `getTier(id)`, `getTierOrThrow(id)`, `isUnlimited(allowance)`, `getAnnualTotalCents(tier)`, `getDisplayPrice(tier, cycle)` functions
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 1.2 Write property tests for tier catalog (`tests/unit/tier-catalog.property.test.ts`)
    - **Property 1: Tier Catalog Completeness** — assert exactly 5 tier IDs defined
    - **Validates: Requirement 1.1**
    - **Property 2: Invalid Tier Lookup** — for any string not in valid IDs, `getTier` returns undefined
    - **Validates: Requirement 1.7**
    - **Property 3: Annual Total Computation** — for paid tiers, `getAnnualTotalCents` equals `annualPricePerMonthCents * 12`
    - **Validates: Requirement 2.4**

- [x] 2. Create quota enforcer module
  - [x] 2.1 Create `lib/quota-enforcer.ts` with pure `checkQuota` function and server-side helpers
    - Define `QuotaType = 'scan' | 'tool_call'`
    - Define `QuotaCheckResult` interface with allowed, reason, currentUsage, allowance, tierName
    - Implement pure `checkQuota(currentUsage, allowance, tierName, quotaType)` function: returns allowed=true if allowance is null (unlimited) or currentUsage < allowance; blocked otherwise with reason string
    - Implement `shouldShowWarning(currentUsage, allowance)` function: returns true if allowance is not null and currentUsage >= 0.8 * allowance
    - Implement `formatAllowanceDisplay(allowance)`: returns "Unlimited" if null, numeric string otherwise
    - Implement async `canPerformScan(supabase, orgId)` and `canPerformToolCall(supabase, orgId)` server helpers
    - _Requirements: 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 9.2, 9.3, 9.4, 12.2_

  - [x] 2.2 Write property tests for quota enforcer (`tests/unit/quota-enforcer.property.test.ts`)
    - **Property 7: Quota Decision Correctness** — for any non-negative usage and any allowance (null or positive int), allowed iff allowance is null OR usage < allowance
    - **Validates: Requirements 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 12.2**
    - **Property 8: Warning Threshold at 80%** — for any positive allowance and non-negative usage, warning flag true iff usage >= 0.8 * allowance; always false for unlimited
    - **Validates: Requirements 9.3, 9.4**
    - **Property 9: Upgrade Applies New Allowances** — for tier pairs where target > current, quota checks use the new tier's allowances
    - **Validates: Requirement 10.3**
    - **Property 10: Pending Downgrade Preserves Current Allowances** — with a pending downgrade, quota uses current (active) tier's allowances
    - **Validates: Requirement 11.2**

- [x] 3. Create usage tracker module
  - [x] 3.1 Create `lib/usage-tracker.ts` with usage snapshot, increment, and reset functions
    - Define `UsageSnapshot` interface with scansUsed, toolCallsUsed, currentPeriodStart, currentPeriodEnd
    - Implement `getUsageSnapshot(supabase, orgId)` — returns current usage from organizations table, defaulting to 0
    - Implement `incrementScans(supabase, orgId)` — calls `increment_scans` RPC for atomic +1
    - Implement `incrementToolCalls(supabase, orgId)` — calls `increment_tool_calls` RPC for atomic +1
    - Implement `resetUsageCounters(supabase, orgId, newPeriodStart, newPeriodEnd)` — sets both counters to 0 and updates period dates
    - _Requirements: 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 6.1, 6.2_

  - [x] 3.2 Write property tests for usage tracker (`tests/unit/usage-tracker.property.test.ts`)
    - **Property 5: Counter Increment** — for any non-negative starting count n, after one increment the result is n + 1
    - **Validates: Requirements 4.1, 5.1**
    - **Property 6: Period Reset Zeroes Counters** — for any scan count s >= 0 and tool-call count t >= 0, after reset both are 0
    - **Validates: Requirement 6.1**

- [x] 4. Create subscription manager module
  - [x] 4.1 Create `lib/subscription-manager.ts` with checkout, validation, and downgrade functions
    - Implement `validateBillingCycle(value)` — returns true only for "monthly" or "annual"
    - Implement `isUpgrade(currentTier, targetTier)` and `isDowngrade(currentTier, targetTier)` using VALID_TIER_IDS order
    - Implement `createCheckoutSession(request, supabase)` — enterprise routes to contact-sales, others create Polar checkout
    - Implement `schedulePendingDowngrade(supabase, orgId, targetTierId, effectiveAt)` — sets pending_plan_id and pending_plan_effective_at
    - Implement `applyPendingDowngrade(supabase, orgId)` — applies pending tier if effective date has passed
    - _Requirements: 3.1, 3.2, 10.1, 10.4, 11.1, 11.4, 12.1_

  - [x] 4.2 Write property tests for subscription manager (`tests/unit/subscription-manager.property.test.ts`)
    - **Property 4: Invalid Billing Cycle Rejection** — for any string not "monthly" or "annual", `validateBillingCycle` returns false
    - **Validates: Requirement 3.2**

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Database migration for tier reconciliation
  - [x] 6.1 Create `supabase/migrations/016_reconcile_tier_values.sql`
    - UPDATE plans SET canonical values for each tier (free: 50 scans/5K tool calls, developer: $29/100 scans/25K, team: $99/500 scans/150K, startup: $299/2000 scans/500K, enterprise: -1/NULL/NULL)
    - Add `pending_plan_id TEXT NULL` and `pending_plan_effective_at TIMESTAMPTZ NULL` columns to organizations table
    - Create `increment_scans(org_id UUID)` RPC function with SECURITY DEFINER
    - Create `increment_tool_calls(org_id UUID)` RPC function with SECURITY DEFINER
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6, 4.1, 5.1, 11.1_

- [x] 7. Update webhook handler for downgrades and period resets
  - [x] 7.1 Update `app/api/webhooks/polar/route.ts` to handle downgrade scheduling and period resets
    - Import tier catalog functions from `lib/tier-catalog.ts`
    - On `subscription.updated` with a new period start: reset usage counters via `resetUsageCounters`
    - On `subscription.updated` where new plan < current plan: set pending_plan_id instead of immediately changing plan_id
    - On `subscription.updated` with new period start AND pending downgrade: apply the pending downgrade via `applyPendingDowngrade`
    - _Requirements: 6.1, 6.2, 10.2, 10.3, 11.1, 11.4_

- [x] 8. Update cron job for period reset and pending downgrades
  - [x] 8.1 Update `app/api/cron/usage-reset/route.ts` to use tier catalog and apply pending downgrades
    - Replace `PLAN_GATES` import with `TIER_CATALOG` from `lib/tier-catalog.ts`
    - Use `tier.scanAllowance` and `tier.toolCallAllowance` for overage calculations
    - Call `applyPendingDowngrade` for orgs with a pending_plan_id when their period ends
    - _Requirements: 6.1, 6.2, 11.4_

- [x] 9. Update billing checkout API route
  - [x] 9.1 Refactor `app/api/billing/create-checkout/route.ts` to use subscription manager
    - Import `createCheckoutSession` and `validateBillingCycle` from `lib/subscription-manager.ts`
    - Replace inline logic with `createCheckoutSession` call
    - Add billing cycle validation using `validateBillingCycle`
    - _Requirements: 3.1, 3.2, 10.1, 10.4, 12.1_

- [x] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Update upgrade page UI
  - [x] 11.1 Refactor `app/(app)/upgrade/page.tsx` to use tier catalog
    - Remove hardcoded `PLANS` array
    - Import tier data from `lib/tier-catalog.ts` and derive plan cards from `TIER_CATALOG`
    - Use `getDisplayPrice(tier, cycle)` for pricing display
    - Show correct values: Team=150,000 tool calls, Free=50 scans, etc.
    - Display "Custom" for Enterprise on both monthly and annual
    - Show annual total as 12x the annual rate for paid tiers
    - _Requirements: 2.4, 2.5, 2.6, 9.1_

- [x] 12. Update billing settings page UI
  - [x] 12.1 Refactor `app/(app)/settings/billing/page.tsx` to use tier catalog and show warnings
    - Remove local `teamLimits` object
    - Import `TIER_CATALOG` and `getTier` from `lib/tier-catalog.ts`
    - Import `shouldShowWarning` from `lib/quota-enforcer.ts`
    - Derive scan/tool-call limits from `tier.scanAllowance` and `tier.toolCallAllowance`
    - Display "Unlimited" label for Enterprise allowances
    - Show amber upgrade-prompt banner when usage >= 80% of allowance for either metric
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 12.2 Create `components/billing/usage-meter.tsx` reusable component
    - Accept props: label, used, allowance (number | null), optional warningThreshold (default 0.8)
    - Render progress bar with color transitions: blue (<80%), amber (80-99%), red (100%)
    - Show "Unlimited" label when allowance is null
    - Show numeric fraction (e.g. "45 / 100") for finite allowances
    - _Requirements: 9.1, 9.2_

- [x] 13. Deprecate legacy plan-limits and feature-gates modules
  - [x] 13.1 Update `lib/plan-limits.ts` and `lib/feature-gates.ts` to re-export from tier-catalog
    - Add deprecation comments to both files
    - Re-export relevant constants from `lib/tier-catalog.ts` to maintain backward compatibility
    - Update `getScanLimit` and `getToolCallLimit` in `lib/feature-gates.ts` to read from `TIER_CATALOG`
    - _Requirements: 1.1_

- [x] 14. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (11 properties across 4 test files)
- Unit tests validate specific examples and edge cases
- The tier catalog (`lib/tier-catalog.ts`) is the foundation — all other modules depend on it
- Database migration adds RPC functions for atomic counter increments and pending downgrade columns
- Legacy modules (`lib/plan-limits.ts`, `lib/feature-gates.ts`) are kept for backward compatibility via re-exports

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "6.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "3.1", "4.1"] },
    { "id": 2, "tasks": ["2.2", "3.2", "4.2", "9.1", "13.1"] },
    { "id": 3, "tasks": ["7.1", "8.1", "11.1", "12.1", "12.2"] }
  ]
}
```
