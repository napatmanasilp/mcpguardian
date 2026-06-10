-- Migration 006: Scans Table
-- Per-server scan results with full pipeline step tracking, compliance mappings,
-- and sandbox execution logs. Supports priority rescans and billing.

CREATE TABLE IF NOT EXISTS scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  mcp_server_id UUID NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
  triggered_by UUID REFERENCES auth.users(id),
  trigger_reason TEXT NOT NULL DEFAULT 'on_connect',
    -- 'on_connect' | 'manual' | 'scheduled' | 'priority_rescan'
  is_priority_rescan BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'queued',
    -- 'queued' | 'running' | 'completed' | 'failed' | 'timeout'
  pipeline_steps JSONB NOT NULL DEFAULT '[]',
  overall_result TEXT, -- 'clean' | 'suspicious' | 'malicious' | 'error'
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_last_scan' AND conrelid = 'mcp_servers'::regclass
  ) THEN
    ALTER TABLE mcp_servers
      ADD CONSTRAINT fk_last_scan FOREIGN KEY (last_scan_id) REFERENCES scans(id);
  END IF;
END;
$$;

ALTER TABLE scans ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_scans_org ON scans(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_server ON scans(mcp_server_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scans_billed ON scans(organization_id, billed, created_at DESC);
