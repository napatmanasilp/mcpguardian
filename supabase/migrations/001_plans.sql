-- Migration 001: Plans Table
-- Feature-based plan definitions. Polar.sh billing IDs replace Stripe.
-- Each plan defines per-feature entitlements, support tier, and pricing.

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  monthly_price_cents INTEGER NOT NULL,
  annual_price_cents INTEGER,
  polar_product_id TEXT,
  polar_monthly_price_id TEXT,
  polar_annual_price_id TEXT,
  scan_limit INTEGER,
  tool_call_limit INTEGER,
  seat_limit INTEGER,
  mcp_server_limit INTEGER,
  log_retention_days INTEGER NOT NULL,
  block_mode_enabled BOOLEAN NOT NULL DEFAULT false,
  rug_pull_detection_enabled BOOLEAN NOT NULL DEFAULT false,
  session_watchdog_enabled BOOLEAN NOT NULL DEFAULT false,
  cross_server_analysis_enabled BOOLEAN NOT NULL DEFAULT false,
  mitre_atlas_enabled BOOLEAN NOT NULL DEFAULT false,
  forensic_timeline_enabled BOOLEAN NOT NULL DEFAULT false,
  webhook_forwarding_enabled BOOLEAN NOT NULL DEFAULT false,
  policy_engine_enabled BOOLEAN NOT NULL DEFAULT false,
  sso_saml_enabled BOOLEAN NOT NULL DEFAULT false,
  otel_export_enabled BOOLEAN NOT NULL DEFAULT false,
  support_tier TEXT NOT NULL DEFAULT 'community',
  uptime_sla TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO plans (id, display_name, monthly_price_cents, annual_price_cents,
  polar_product_id, polar_monthly_price_id, polar_annual_price_id,
  scan_limit, tool_call_limit, seat_limit, mcp_server_limit,
  log_retention_days,
  block_mode_enabled, rug_pull_detection_enabled, session_watchdog_enabled,
  cross_server_analysis_enabled, mitre_atlas_enabled, forensic_timeline_enabled,
  webhook_forwarding_enabled, policy_engine_enabled, sso_saml_enabled, otel_export_enabled,
  support_tier, uptime_sla, created_at)
VALUES
  ('free',       'Free',       0,      NULL,   NULL, NULL, NULL, 0,    5000,  1,   2,   7,   false, false, false, false, false, false, false, false, false, false, 'community',    NULL,    NOW()),
  ('developer',  'Developer',  2900,   23200,  NULL, NULL, NULL, 50,   25000, 1,   10,  30,  true,  true,  true,  false, false, false, false, false, false, false, 'email_48h',    NULL,    NOW()),
  ('team',       'Team',       14900,  119200, NULL, NULL, NULL, 200,  150000,5,   25,  90,  true,  true,  true,  true,  true,  true,  false, false, false, false, 'email_24h',    NULL,    NOW()),
  ('startup',    'Startup',    59900,  479200, NULL, NULL, NULL, 1000, 1000000,20, 100, 365, true,  true,  true,  true,  true,  true,  true,  true,  false, false, 'slack_8h',     NULL,    NOW()),
  ('enterprise', 'Enterprise', 250000, NULL,   NULL, NULL, NULL, NULL, NULL,  NULL,NULL,730,true,  true,  true,  true,  true,  true,  true,  true,  true,  true,  'dedicated_csm','99.9%', NOW())
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  log_retention_days = EXCLUDED.log_retention_days,
  monthly_price_cents = EXCLUDED.monthly_price_cents;

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'plans' AND policyname = 'Anyone can read plans'
  ) THEN
    CREATE POLICY "Anyone can read plans" ON plans FOR SELECT USING (true);
  END IF;
END;
$$;
