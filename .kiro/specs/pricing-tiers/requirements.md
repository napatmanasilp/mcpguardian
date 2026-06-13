# Requirements Document

## Introduction

This feature defines a tiered subscription model for MCPGuardian (the "mcpauth" product), a Next.js application backed by Supabase and billed through Polar.sh. The model establishes five tiers (Free, Developer, Team, Startup, Enterprise), each with a fixed monthly allowance of full scans and protected tool calls. The system tracks consumption of both metrics per organization across a monthly billing period, enforces the per-tier allowances, supports monthly and annual billing cycles, and provides self-serve upgrade and downgrade flows for the four published tiers plus a contact-sales path for the custom Enterprise tier.

The canonical tier definitions for this feature are:

| Tier | Monthly Price | Annual Price (per month, billed yearly) | Scans/month | Tool calls/month | Audience |
|------|---------------|------------------------------------------|-------------|------------------|----------|
| Free | $0 | $0 | 50 | 5,000 | Evaluation, single agent |
| Developer | $29 | $24 ($288/year) | 100 | 25,000 | Solo dev, one agent in prod |
| Team | $99 | $82 ($984/year) | 500 | 150,000 | Small team, several agents |
| Startup | $299 | $248 ($2,976/year) | 2,000 | 500,000 | Scaled agent fleets |
| Enterprise | Custom | Custom | Unlimited | Unlimited | Compliance/SLA needs |

This table is the source of truth for the tier catalog. Existing tier values in `supabase/migrations/001_plans.sql` and `lib/plan-limits.ts` are inconsistent with this table and will be reconciled during the design phase.

## Glossary

- **MCPGuardian**: The overall product/application being specified.
- **Tier**: A named subscription level (Free, Developer, Team, Startup, or Enterprise) with an associated price, scan allowance, and tool-call allowance.
- **Tier_Catalog**: The subsystem that stores and exposes the definition of each Tier, including price and allowances.
- **Organization**: The billing entity (tenant) that holds a single active Tier subscription and accumulates usage. Maps to the `organizations` table.
- **Scan**: A single full security scan of an MCP server, counted toward the Scan_Allowance.
- **Tool_Call**: A single protected MCP tool invocation routed through MCPGuardian, counted toward the Tool_Call_Allowance.
- **Scan_Allowance**: The maximum number of Scans an Organization may consume within one Billing_Period for its current Tier.
- **Tool_Call_Allowance**: The maximum number of Tool_Calls an Organization may consume within one Billing_Period for its current Tier.
- **Unlimited**: An allowance with no enforced upper bound, represented by the sentinel value of NULL in the database or -1 in application code.
- **Billing_Period**: A one-month interval, bounded by `current_period_start` and `current_period_end`, over which usage is accumulated.
- **Billing_Cycle**: The subscription's renewal cadence, either "monthly" or "annual".
- **Usage_Tracker**: The subsystem that increments and stores per-Organization Scan and Tool_Call counts for the current Billing_Period.
- **Quota_Enforcer**: The subsystem that compares accumulated usage against the current Tier's allowances and permits or blocks operations.
- **Subscription_Manager**: The subsystem that handles Tier selection, upgrades, downgrades, and Billing_Cycle changes via Polar.sh checkout and customer portal.
- **Pricing_Display**: The UI subsystem (upgrade and billing pages) that presents Tier prices and allowances.
- **Annual_Discounted_Rate**: The reduced per-month price applied when an Organization selects the annual Billing_Cycle, billed once per year as twelve times that rate.

## Requirements

### Requirement 1: Tier Catalog Definition

**User Story:** As a product owner, I want each tier's price and usage allowances defined in one authoritative place, so that pricing and limits are consistent across the application.

#### Acceptance Criteria

1. THE Tier_Catalog SHALL define exactly five Tiers named Free, Developer, Team, Startup, and Enterprise.
2. THE Tier_Catalog SHALL define the Free Tier with a monthly price of $0, a Scan_Allowance of 50, and a Tool_Call_Allowance of 5,000.
3. THE Tier_Catalog SHALL define the Developer Tier with a monthly price of $29, a Scan_Allowance of 100, and a Tool_Call_Allowance of 25,000.
4. THE Tier_Catalog SHALL define the Team Tier with a monthly price of $99, a Scan_Allowance of 500, and a Tool_Call_Allowance of 150,000.
5. THE Tier_Catalog SHALL define the Startup Tier with a monthly price of $299, a Scan_Allowance of 2,000, and a Tool_Call_Allowance of 500,000.
6. THE Tier_Catalog SHALL define the Enterprise Tier with a custom price, an Unlimited Scan_Allowance, and an Unlimited Tool_Call_Allowance.
7. WHEN the Tier_Catalog is queried for a Tier identifier that is not one of the five defined Tiers, THE Tier_Catalog SHALL return a not-found error.

### Requirement 2: Tier Pricing for Monthly and Annual Cycles

**User Story:** As a prospective customer, I want to see both monthly and annual prices for each tier, so that I can choose the billing cadence that fits my budget.

#### Acceptance Criteria

1. THE Tier_Catalog SHALL define an Annual_Discounted_Rate of $24 per month for the Developer Tier.
2. THE Tier_Catalog SHALL define an Annual_Discounted_Rate of $82 per month for the Team Tier.
3. THE Tier_Catalog SHALL define an Annual_Discounted_Rate of $248 per month for the Startup Tier.
4. WHERE a paid Tier is displayed with the annual Billing_Cycle selected, THE Pricing_Display SHALL present the annual total as twelve times the Annual_Discounted_Rate for that Tier.
5. WHERE the Free Tier is displayed, THE Pricing_Display SHALL present a price of $0 for both the monthly and annual Billing_Cycle.
6. WHERE the Enterprise Tier is displayed, THE Pricing_Display SHALL present the price label "Custom" for both the monthly and annual Billing_Cycle.

### Requirement 3: Billing Cycle Selection

**User Story:** As a customer, I want to choose monthly or annual billing when I subscribe, so that the subscription matches my chosen cadence.

#### Acceptance Criteria

1. WHEN an Organization subscribes to a paid Tier with a selected Billing_Cycle, THE Subscription_Manager SHALL record the Billing_Cycle as either "monthly" or "annual" on the Organization.
2. IF a Billing_Cycle value other than "monthly" or "annual" is submitted, THEN THE Subscription_Manager SHALL reject the request and return a validation error.
3. WHEN an Organization is created without an explicit Billing_Cycle, THE Subscription_Manager SHALL assign the Billing_Cycle "monthly".

### Requirement 4: Scan Usage Tracking

**User Story:** As an operator, I want each completed scan counted against the organization's monthly allowance, so that consumption is measured accurately.

#### Acceptance Criteria

1. WHEN a Scan completes for an Organization, THE Usage_Tracker SHALL increment that Organization's scan count for the current Billing_Period by one.
2. WHEN the Usage_Tracker is queried for an Organization, THE Usage_Tracker SHALL return the scan count consumed during the current Billing_Period.
3. WHILE an Organization's scan count has no recorded value for the current Billing_Period, THE Usage_Tracker SHALL treat the scan count as zero.

### Requirement 5: Tool Call Usage Tracking

**User Story:** As an operator, I want each protected tool call counted against the organization's monthly allowance, so that consumption is measured accurately.

#### Acceptance Criteria

1. WHEN a Tool_Call is processed for an Organization, THE Usage_Tracker SHALL increment that Organization's tool-call count for the current Billing_Period by one.
2. WHEN the Usage_Tracker is queried for an Organization, THE Usage_Tracker SHALL return the tool-call count consumed during the current Billing_Period.
3. WHILE an Organization's tool-call count has no recorded value for the current Billing_Period, THE Usage_Tracker SHALL treat the tool-call count as zero.

### Requirement 6: Billing Period Reset

**User Story:** As a customer, I want my usage counters to reset at the start of each billing period, so that my allowance renews each month.

#### Acceptance Criteria

1. WHEN an Organization's Billing_Period ends, THE Usage_Tracker SHALL reset that Organization's scan count and tool-call count to zero for the new Billing_Period.
2. WHEN an Organization's Billing_Period ends, THE Subscription_Manager SHALL set `current_period_start` to the new period start and `current_period_end` to the new period end.

### Requirement 7: Scan Quota Enforcement

**User Story:** As a product owner, I want scans blocked once an organization reaches its monthly scan allowance, so that tier limits are enforced.

#### Acceptance Criteria

1. WHEN a Scan is requested AND the Organization's current scan count is below the Scan_Allowance of the Organization's Tier, THE Quota_Enforcer SHALL permit the Scan.
2. IF a Scan is requested AND the Organization's current scan count is equal to or greater than the Scan_Allowance of the Organization's Tier, THEN THE Quota_Enforcer SHALL block the Scan and return a quota-exceeded response that identifies the scan allowance and the current Tier.
3. WHERE the Organization's Tier has an Unlimited Scan_Allowance, THE Quota_Enforcer SHALL permit every requested Scan.

### Requirement 8: Tool Call Quota Enforcement

**User Story:** As a product owner, I want tool calls blocked once an organization reaches its monthly tool-call allowance, so that tier limits are enforced.

#### Acceptance Criteria

1. WHEN a Tool_Call is requested AND the Organization's current tool-call count is below the Tool_Call_Allowance of the Organization's Tier, THE Quota_Enforcer SHALL permit the Tool_Call.
2. IF a Tool_Call is requested AND the Organization's current tool-call count is equal to or greater than the Tool_Call_Allowance of the Organization's Tier, THEN THE Quota_Enforcer SHALL block the Tool_Call and return a quota-exceeded response that identifies the tool-call allowance and the current Tier.
3. WHERE the Organization's Tier has an Unlimited Tool_Call_Allowance, THE Quota_Enforcer SHALL permit every requested Tool_Call.

### Requirement 9: Usage Visibility and Warning

**User Story:** As a customer, I want to see how much of my allowance I have used and be warned as I approach the limit, so that I can upgrade before being blocked.

#### Acceptance Criteria

1. WHEN the billing page is loaded for an Organization, THE Pricing_Display SHALL present the consumed scan count, the consumed tool-call count, and the corresponding allowances for the Organization's Tier.
2. WHERE the Organization's Tier has an Unlimited allowance for a metric, THE Pricing_Display SHALL present the label "Unlimited" for that metric instead of a numeric allowance.
3. WHEN an Organization's consumed scan count reaches 80 percent of the Scan_Allowance, THE MCPGuardian SHALL present an upgrade prompt on the billing page.
4. WHEN an Organization's consumed tool-call count reaches 80 percent of the Tool_Call_Allowance, THE MCPGuardian SHALL present an upgrade prompt on the billing page.

### Requirement 10: Upgrade Flow

**User Story:** As a customer, I want to upgrade to a higher tier, so that I can access higher allowances.

#### Acceptance Criteria

1. WHEN an Organization selects a paid Tier other than Enterprise, THE Subscription_Manager SHALL create a Polar.sh checkout session for the selected Tier and Billing_Cycle and return the checkout URL.
2. WHEN a Polar.sh checkout for a Tier change completes successfully, THE Subscription_Manager SHALL set the Organization's Tier to the purchased Tier.
3. WHEN an Organization's Tier changes to a higher Tier, THE Quota_Enforcer SHALL apply the new Tier's Scan_Allowance and Tool_Call_Allowance for subsequent operations within the current Billing_Period.
4. IF a checkout session cannot be created, THEN THE Subscription_Manager SHALL return an error that indicates checkout is unavailable and SHALL leave the Organization's current Tier unchanged.

### Requirement 11: Downgrade Flow

**User Story:** As a customer, I want to downgrade to a lower tier, so that I can reduce my spend when I need fewer resources.

#### Acceptance Criteria

1. WHEN an Organization selects a lower paid Tier or the Free Tier, THE Subscription_Manager SHALL record the selected Tier as the Organization's Tier effective at the start of the next Billing_Period.
2. WHILE a downgrade is pending and the current Billing_Period has not ended, THE Quota_Enforcer SHALL continue to apply the current Tier's allowances.
3. IF an Organization requests a downgrade to a Tier whose Scan_Allowance is below the Organization's already-consumed scan count for the current Billing_Period, THEN THE Subscription_Manager SHALL accept the downgrade as effective at the next Billing_Period and SHALL present a notice that the lower allowance applies after the current period.
4. WHEN a pending downgrade's effective Billing_Period begins, THE Subscription_Manager SHALL set the Organization's Tier to the selected lower Tier.

### Requirement 12: Enterprise Custom Tier

**User Story:** As an enterprise buyer, I want a custom tier with unlimited usage and a sales-assisted purchase, so that I can meet compliance and SLA needs.

#### Acceptance Criteria

1. WHEN an Organization selects the Enterprise Tier, THE Subscription_Manager SHALL route the request to the contact-sales path instead of a self-serve checkout.
2. WHERE an Organization is on the Enterprise Tier, THE Quota_Enforcer SHALL treat both the Scan_Allowance and the Tool_Call_Allowance as Unlimited.
3. WHILE an Organization is on the Enterprise Tier, THE Usage_Tracker SHALL continue to record consumed scan counts and tool-call counts for reporting purposes.
