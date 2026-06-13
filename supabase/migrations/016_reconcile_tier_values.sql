-- Migration 016: Reconcile tier values to canonical pricing
-- Fixes inconsistencies between 001_plans.sql and the requirements spec.
-- Also adds pending downgrade columns and RPC functions for atomic counter increments.

-- ─── 1. Reconcile plan values to canonical tier definitions ───────────────

UPDATE plans SET
  monthly_price_cents = 0,
  annual_price_cents = 0,
  scan_limit = 50,
  tool_call_limit = 5000,
  seat_limit = 1,
  mcp_server_limit = 1
WHERE id = 'free';

UPDATE plans SET
  monthly_price_cents = 2900,
  annual_price_cents = 28800,  -- $24/mo × 12
  scan_limit = 100,
  tool_call_limit = 25000,
  seat_limit = 3,
  mcp_server_limit = 5
WHERE id = 'developer';

UPDATE plans SET
  monthly_price_cents = 9900,
  annual_price_cents = 98400,  -- $82/mo × 12
  scan_limit = 500,
  tool_call_limit = 150000,
  seat_limit = 10,
  mcp_server_limit = 25
WHERE id = 'team';

UPDATE plans SET
  monthly_price_cents = 29900,
  annual_price_cents = 297600, -- $248/mo × 12
  scan_limit = 2000,
  tool_call_limit = 500000,
  seat_limit = NULL,  -- unlimited
  mcp_server_limit = 100
WHERE id = 'startup';

UPDATE plans SET
  monthly_price_cents = -1,     -- custom
  annual_price_cents = NULL,
  scan_limit = NULL,            -- unlimited
  tool_call_limit = NULL,       -- unlimited
  seat_limit = NULL,
  mcp_server_limit = NULL
WHERE id = 'enterprise';

-- ─── 2. Add pending downgrade columns to organizations ────────────────────

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS pending_plan_id TEXT NULL;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS pending_plan_effective_at TIMESTAMPTZ NULL;

-- ─── 3. RPC functions for atomic counter increments ───────────────────────
-- These use the names expected by lib/usage-tracker.ts (increment_scans / increment_tool_calls).
-- The older increment_org_scans / increment_org_tool_calls from 014 remain for backward compat.

CREATE OR REPLACE FUNCTION increment_scans(org_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE organizations
  SET scans_used_this_period = COALESCE(scans_used_this_period, 0) + 1,
      updated_at = NOW()
  WHERE id = org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_tool_calls(org_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE organizations
  SET tool_calls_used_this_period = COALESCE(tool_calls_used_this_period, 0) + 1,
      updated_at = NOW()
  WHERE id = org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
