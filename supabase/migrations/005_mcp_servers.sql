-- Migration 005: MCP Servers Table
-- Per-organization server registry with allowlist status and risk scoring.

CREATE TABLE IF NOT EXISTS mcp_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  transport_type TEXT NOT NULL, -- 'http' | 'sse' | 'stdio'
  endpoint_url TEXT,
  stdio_command TEXT,
  stdio_args JSONB,
  allowlist_status TEXT NOT NULL DEFAULT 'pending',
    -- 'pending' | 'approved' | 'blocked' | 'monitoring'
  last_scan_id UUID,
  last_scan_at TIMESTAMPTZ,
  last_scan_result TEXT, -- 'clean' | 'suspicious' | 'malicious' | 'error'
  risk_score INTEGER, -- 0–100
  is_stdio BOOLEAN NOT NULL GENERATED ALWAYS AS (transport_type = 'stdio') STORED,
  stdio_runtime_protection_available BOOLEAN NOT NULL DEFAULT false,
  tool_call_count_total BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE mcp_servers ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_mcp_servers_org ON mcp_servers(organization_id);
