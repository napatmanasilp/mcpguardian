-- Migration 002: Overage Rates Table
-- Per-plan pricing for usage beyond included limits.
-- Polar.sh meter IDs for usage-based billing reporting.

CREATE TABLE IF NOT EXISTS overage_rates (
  plan_id TEXT PRIMARY KEY REFERENCES plans(id),
  tool_call_overage_cents NUMERIC(10,6), -- cost per additional tool call in cents
  scan_overage_cents NUMERIC(10,4),      -- cost per additional scan in cents
  seat_overage_cents INTEGER,            -- cost per additional seat/month in cents
  -- Polar.sh meter IDs for usage reporting
  polar_tool_call_meter_id TEXT,         -- Polar meter ID for tool call overages
  polar_scan_meter_id TEXT               -- Polar meter ID for scan overages
);

INSERT INTO overage_rates (plan_id, tool_call_overage_cents, scan_overage_cents, seat_overage_cents, polar_tool_call_meter_id, polar_scan_meter_id) VALUES
  ('developer', 1.2,   150.00, NULL, NULL, NULL),
  ('team',      0.8,   100.00, 1500, NULL, NULL),
  ('startup',   0.5,   80.00,  2000, NULL, NULL),
  ('enterprise', NULL, NULL,   NULL, NULL, NULL)
ON CONFLICT (plan_id) DO NOTHING;

ALTER TABLE overage_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read overage rates" ON overage_rates;
CREATE POLICY "Anyone can read overage rates"
  ON overage_rates FOR SELECT USING (true);
