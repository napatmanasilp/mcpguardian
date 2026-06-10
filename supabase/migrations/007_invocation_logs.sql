-- ─────────────────────────────────────────────────────────────────────
-- 007: Per-Invocation Telemetry Logs
 -- Records every MCP tool call and response through the proxy.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE tool_invocation_logs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id      TEXT NOT NULL,
  user_id         UUID REFERENCES auth.users(id),
  server_url      TEXT NOT NULL,
  tool_name       TEXT NOT NULL,
  parameters      JSONB,
  parameter_hash  TEXT,          -- SHA-256 of params for anomaly detection
  response_hash   TEXT,          -- SHA-256 of response content
  response_size   INTEGER,       -- bytes
  latency_ms      INTEGER,
  response_flags  JSONB,         -- from response-interceptor output
  proxy_mode      TEXT CHECK (proxy_mode IN ('monitor', 'block', 'off')),
  blocked         BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invocation_logs_session ON tool_invocation_logs(session_id);
CREATE INDEX idx_invocation_logs_server  ON tool_invocation_logs(server_url);
CREATE INDEX idx_invocation_logs_tool    ON tool_invocation_logs(server_url, tool_name);
CREATE INDEX idx_invocation_logs_time    ON tool_invocation_logs(created_at DESC);

-- Retention policy: auto-delete logs older than 90 days
CREATE OR REPLACE FUNCTION delete_old_invocation_logs()
RETURNS void AS $$
  DELETE FROM tool_invocation_logs WHERE created_at < NOW() - INTERVAL '90 days';
$$ LANGUAGE SQL;
