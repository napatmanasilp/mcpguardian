-- ─── Invocation Source Tracking ──────────────────────────────────────
-- Tracks whether a tool call was user-initiated, agent-planned, or
-- triggered by a response (injection-induced).
-- Enables forensic reconstruction of attack chains.

ALTER TABLE tool_invocation_logs
  ADD COLUMN IF NOT EXISTS invocation_source
  TEXT CHECK (invocation_source IN (
    'user_initiated',
    'agent_planned',
    'response_triggered',
    'unknown'
  ))
  DEFAULT 'unknown';

ALTER TABLE tool_invocation_logs
  ADD COLUMN IF NOT EXISTS parent_invocation_id
  UUID REFERENCES tool_invocation_logs(id);

CREATE INDEX IF NOT EXISTS idx_invocation_parent
  ON tool_invocation_logs(parent_invocation_id);
