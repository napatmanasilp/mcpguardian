-- Migration 019: Fix scans table schema
-- The old 001_initial.sql creates a scans table with the wrong schema.
-- This migration drops it and recreates with the correct columns.

-- Drop the old table (cascade removes FKs referencing it)
DROP TABLE IF EXISTS scans CASCADE;

-- Recreate with the correct schema (from 006_scans.sql)
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
CREATE INDEX IF NOT EXISTS idx_scans_billed ON scans(organization_id, billed, created_at DESC);

-- Re-add FK from mcp_servers.last_scan_id if the column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'mcp_servers' AND column_name = 'last_scan_id'
  ) THEN
    BEGIN
      ALTER TABLE mcp_servers
        ADD CONSTRAINT fk_last_scan FOREIGN KEY (last_scan_id) REFERENCES scans(id);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END;
$$;
