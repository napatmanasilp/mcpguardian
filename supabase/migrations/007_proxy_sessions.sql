-- Migration 007: Proxy Sessions Table
-- Tracks active MCP proxy sessions with watchdog state, threat/block counts,
-- and permission snapshots for runtime enforcement.

CREATE TABLE IF NOT EXISTS proxy_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  mcp_server_id UUID NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
  agent_identifier TEXT,
  session_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status TEXT NOT NULL DEFAULT 'active',
    -- 'active' | 'terminated_clean' | 'terminated_threat' | 'terminated_rug_pull' | 'expired'
  block_mode_active BOOLEAN NOT NULL DEFAULT false,
  watchdog_enabled BOOLEAN NOT NULL DEFAULT false,
  watchdog_last_verified_at TIMESTAMPTZ,
  watchdog_next_verify_at TIMESTAMPTZ,
  tool_call_count INTEGER NOT NULL DEFAULT 0,
  threat_count INTEGER NOT NULL DEFAULT 0,
  blocked_count INTEGER NOT NULL DEFAULT 0,
  permission_set JSONB NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  termination_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE proxy_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_proxy_sessions_org ON proxy_sessions(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_proxy_sessions_server ON proxy_sessions(mcp_server_id);
