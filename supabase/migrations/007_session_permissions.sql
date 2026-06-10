-- ─── Session Permission Snapshots ────────────────────────────────────
-- Stores the set of tools permitted at session registration time.
-- Tools added mid-session are automatically denied.
-- Tools removed mid-session have their permissions revoked.

CREATE TABLE IF NOT EXISTS session_permissions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id      UUID REFERENCES active_sessions(id) ON DELETE CASCADE,
  tool_name       TEXT NOT NULL,
  server_url      TEXT NOT NULL,
  permitted_at    TIMESTAMPTZ DEFAULT NOW(),
  revoked_at      TIMESTAMPTZ,
  revoke_reason   TEXT,
  UNIQUE(session_id, tool_name, server_url)
);

CREATE INDEX IF NOT EXISTS idx_session_permissions_session
  ON session_permissions(session_id);
