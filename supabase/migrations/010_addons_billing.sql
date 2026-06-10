-- Migration 010: Add-Ons & Usage Billing Tables
-- Tracks one-time and recurring add-on purchases (scan packs, forensic storage, etc.)
-- and monthly usage billing records with Polar.sh invoice references.

CREATE TABLE IF NOT EXISTS addon_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  addon_type TEXT NOT NULL,
    -- 'extra_scan_pack_100' | 'forensic_storage_10gb' | 'compliance_report_bundle' |
    -- 'nsa_compliance_report' | 'priority_rescan' | 'llm_semantic_classifier' |
    -- 'stdio_sidecar'
  -- Polar.sh order/subscription references replace Stripe references
  polar_order_id TEXT,                 -- Polar order ID for one-time purchases
  polar_subscription_id TEXT,          -- Polar subscription ID for recurring add-ons
  polar_product_id TEXT,               -- Polar product ID for the add-on
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS usage_billing_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  billing_period_start TIMESTAMPTZ NOT NULL,
  billing_period_end TIMESTAMPTZ NOT NULL,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  base_scans_included INTEGER NOT NULL,
  base_tool_calls_included INTEGER NOT NULL,
  scans_used INTEGER NOT NULL DEFAULT 0,
  tool_calls_used INTEGER NOT NULL DEFAULT 0,
  scan_overages INTEGER NOT NULL DEFAULT 0,
  tool_call_overages BIGINT NOT NULL DEFAULT 0,
  scan_overage_charge_cents INTEGER NOT NULL DEFAULT 0,
  tool_call_overage_charge_cents INTEGER NOT NULL DEFAULT 0,
  total_charge_cents INTEGER NOT NULL DEFAULT 0,
  -- Polar.sh invoice reference replaces Stripe invoice ID
  polar_invoice_id TEXT,
  status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'finalized' | 'paid'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE addon_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_billing_records ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_addons_org ON addon_purchases(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_org ON usage_billing_records(organization_id, billing_period_start DESC);
