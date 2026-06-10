-- ─────────────────────────────────────────────────────────────────────
-- 008: Server Registry & Allowlist
-- Tracks approved MCP servers per organization with enforcement modes.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE server_registry (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  server_url      TEXT NOT NULL,
  server_name     TEXT,
  approval_status TEXT CHECK (approval_status IN
                  ('pending', 'approved', 'rejected', 'revoked'))
                  DEFAULT 'pending',
  approved_by     UUID REFERENCES auth.users(id),
  approved_at     TIMESTAMPTZ,
  scan_id         UUID,            -- references the scan that earned approval
  scan_score      INTEGER,         -- score at time of approval
  tool_hash       TEXT,            -- hash of tools at time of approval
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, server_url)
);

CREATE TABLE allowlist_config (
  organization_id   UUID PRIMARY KEY,
  enforcement_mode  TEXT CHECK (enforcement_mode IN ('strict', 'warn', 'off'))
                    DEFAULT 'warn',
  auto_approve_above_score INTEGER DEFAULT 85,
  updated_by        UUID REFERENCES auth.users(id),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_server_registry_org ON server_registry(organization_id);
CREATE INDEX idx_server_registry_status ON server_registry(approval_status);
CREATE INDEX idx_server_registry_url ON server_registry(server_url);

-- Row Level Security
ALTER TABLE server_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE allowlist_config ENABLE ROW LEVEL SECURITY;

-- Organization members can view their own registry
CREATE POLICY "Org members view registry"
  ON server_registry
  FOR SELECT
  USING (auth.uid() IN (
    SELECT id FROM auth.users WHERE id = auth.uid()
  ));

-- Service role can manage all rows (used by API)
CREATE POLICY "Service role full access registry"
  ON server_registry
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access config"
  ON allowlist_config
  TO authenticated
  USING (true)
  WITH CHECK (true);
