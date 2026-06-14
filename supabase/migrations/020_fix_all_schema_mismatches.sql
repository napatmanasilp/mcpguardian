-- Migration 020: Fix all schema mismatches between code and database
-- Resolves conflicts from duplicate numbered migrations (001/006/007/008)
-- that caused IF NOT EXISTS to skip creating the correct table versions.

-- ═══════════════════════════════════════════════════════════════════════
-- 1. Fix `alerts` table — needs organization_id, session_id, server_id
-- ═══════════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS alerts CASCADE;

CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  read BOOLEAN NOT NULL DEFAULT false,
  session_id UUID,
  server_id UUID REFERENCES mcp_servers(id) ON DELETE SET NULL,
  scan_id UUID REFERENCES scans(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_alerts_org ON alerts(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_unread ON alerts(organization_id, read) WHERE read = false;

-- ═══════════════════════════════════════════════════════════════════════
-- 2. Fix `tool_invocation_logs` table — needs organization_id, threat_type, etc.
-- ═══════════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS tool_invocation_logs CASCADE;

CREATE TABLE tool_invocation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id UUID,
  mcp_server_id UUID REFERENCES mcp_servers(id) ON DELETE SET NULL,
  tool_name TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'outbound',
  request_payload JSONB DEFAULT '{}',
  response_payload JSONB,
  was_blocked BOOLEAN NOT NULL DEFAULT false,
  block_reason TEXT,
  threat_type TEXT,
  threats_detected JSONB NOT NULL DEFAULT '[]',
  description TEXT,
  severity TEXT,
  permission_level TEXT,
  pii_redacted BOOLEAN NOT NULL DEFAULT false,
  obfuscation_detected BOOLEAN NOT NULL DEFAULT false,
  token_guard_triggered BOOLEAN NOT NULL DEFAULT false,
  latency_ms INTEGER,
  billed BOOLEAN NOT NULL DEFAULT false,
  invoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Default partition for all current data
CREATE TABLE tool_invocation_logs_default PARTITION OF tool_invocation_logs DEFAULT;

ALTER TABLE tool_invocation_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_til_org ON tool_invocation_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_til_server ON tool_invocation_logs(mcp_server_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_til_threats ON tool_invocation_logs(organization_id, threat_type)
  WHERE threat_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_til_blocked ON tool_invocation_logs(organization_id, was_blocked, created_at DESC)
  WHERE was_blocked = true;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. Ensure `scans` table exists correctly (may already be fixed by 019)
-- ═══════════════════════════════════════════════════════════════════════

-- Only recreate if it has the wrong schema (check for organization_id column)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'scans' AND column_name = 'organization_id'
  ) THEN
    DROP TABLE IF EXISTS scans CASCADE;

    CREATE TABLE scans (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      mcp_server_id UUID NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
      triggered_by UUID REFERENCES auth.users(id),
      trigger_reason TEXT NOT NULL DEFAULT 'on_connect',
      is_priority_rescan BOOLEAN NOT NULL DEFAULT false,
      status TEXT NOT NULL DEFAULT 'queued',
      pipeline_steps JSONB NOT NULL DEFAULT '[]',
      overall_result TEXT,
      risk_score INTEGER,
      findings JSONB NOT NULL DEFAULT '[]',
      owasp_violations JSONB NOT NULL DEFAULT '[]',
      mitre_atlas_mappings JSONB NOT NULL DEFAULT '[]',
      nsa_csi_findings JSONB NOT NULL DEFAULT '[]',
      sandbox_logs TEXT,
      raw_output JSONB,
      duration_ms INTEGER,
      billed BOOLEAN NOT NULL DEFAULT false,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
    CREATE INDEX IF NOT EXISTS idx_scans_org ON scans(organization_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_scans_server ON scans(mcp_server_id, created_at DESC);
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════
-- 4. Drop legacy tables from 001_initial.sql that conflict
-- ═══════════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS monitored_configs CASCADE;
-- NOTE: Do NOT drop profiles — it is still referenced by check-counter.ts
-- and api-key management. It will be deprecated in a future migration.

-- ═══════════════════════════════════════════════════════════════════════
-- 5. Ensure alert_channels table exists (used by alerts/channels page)
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS alert_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  channel_type TEXT NOT NULL, -- 'email' | 'slack' | 'webhook' | 'pagerduty'
  name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  severity_threshold TEXT, -- minimum severity to trigger
  notification_channels JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE alert_channels ENABLE ROW LEVEL SECURITY;
