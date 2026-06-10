-- Migration 012: Observability / Telemetry Tables
-- Per-session telemetry snapshots (call volume, latency percentiles, threat counts)
-- and per-server health metrics for real-time monitoring dashboards.

CREATE TABLE IF NOT EXISTS session_telemetry_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES proxy_sessions(id) ON DELETE CASCADE,
  mcp_server_id UUID NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tool_calls_in_window INTEGER NOT NULL DEFAULT 0,
  avg_latency_ms NUMERIC(10,2),
  p95_latency_ms NUMERIC(10,2),
  p99_latency_ms NUMERIC(10,2),
  error_count INTEGER NOT NULL DEFAULT 0,
  threat_count INTEGER NOT NULL DEFAULT 0,
  blocked_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS server_health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  mcp_server_id UUID NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_reachable BOOLEAN,
  latency_ms INTEGER,
  error_rate_pct NUMERIC(5,2),
  tool_call_rate_per_minute NUMERIC(10,2),
  threat_rate_per_minute NUMERIC(10,2)
);

ALTER TABLE session_telemetry_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_health_metrics ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_telemetry_session ON session_telemetry_snapshots(session_id, snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_server ON server_health_metrics(mcp_server_id, recorded_at DESC);
