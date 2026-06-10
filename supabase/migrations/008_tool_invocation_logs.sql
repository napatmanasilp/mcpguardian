-- Migration 008: Tool Invocation Logs Table
-- Partitioned by month for scale. Tracks every proxy call with threat detection,
-- PII redaction, obfuscation flags, and token guard triggers.

CREATE TABLE IF NOT EXISTS tool_invocation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES proxy_sessions(id) ON DELETE CASCADE,
  mcp_server_id UUID NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  direction TEXT NOT NULL, -- 'inbound' | 'outbound'
  request_payload JSONB,
  response_payload JSONB,
  was_blocked BOOLEAN NOT NULL DEFAULT false,
  block_reason TEXT,
  threats_detected JSONB NOT NULL DEFAULT '[]',
  pii_redacted BOOLEAN NOT NULL DEFAULT false,
  pii_types_found JSONB NOT NULL DEFAULT '[]',
  obfuscation_detected BOOLEAN NOT NULL DEFAULT false,
  token_guard_triggered BOOLEAN NOT NULL DEFAULT false,
  latency_ms INTEGER,
  billed BOOLEAN NOT NULL DEFAULT false,
  invoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Composite PK: partition key (invoked_at) must be part of every unique constraint
  PRIMARY KEY (id, invoked_at)
) PARTITION BY RANGE (invoked_at);

-- Builder: generate monthly partitions for the next 12 months
-- CREATE TABLE tool_invocation_logs_YYYY_MM PARTITION OF tool_invocation_logs
--   FOR VALUES FROM ('YYYY-MM-01') TO ('YYYY-MM+1-01');

CREATE INDEX IF NOT EXISTS idx_til_org_invoked ON tool_invocation_logs (organization_id, invoked_at DESC);
CREATE INDEX IF NOT EXISTS idx_til_session ON tool_invocation_logs (session_id, invoked_at DESC);
CREATE INDEX IF NOT EXISTS idx_til_threats ON tool_invocation_logs (organization_id, was_blocked, invoked_at DESC)
  WHERE was_blocked = true OR jsonb_array_length(threats_detected) > 0;

ALTER TABLE tool_invocation_logs ENABLE ROW LEVEL SECURITY;
