-- Active sessions table for the session watchdog & kill switch system.
-- Tracks every proxy session with its initial tool hash for drift detection.

CREATE TABLE active_sessions (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            UUID REFERENCES auth.users(id),
  server_url         TEXT NOT NULL,
  server_url_hash    TEXT NOT NULL,
  initial_scan_id    UUID,
  initial_tool_hash  TEXT NOT NULL,
  session_start      TIMESTAMPTZ DEFAULT NOW(),
  last_seen          TIMESTAMPTZ DEFAULT NOW(),
  status             TEXT CHECK (status IN
                     ('active','terminated','compromised','suspicious'))
                     DEFAULT 'active',
  termination_reason TEXT,
  rescan_interval_ms INTEGER DEFAULT 900000,  -- 15 min default
  next_rescan_at     TIMESTAMPTZ
);

-- Session anomalies table: stores detected issues for each session

CREATE TABLE session_anomalies (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id    UUID REFERENCES active_sessions(id) ON DELETE CASCADE,
  anomaly_type  TEXT NOT NULL,
  severity      TEXT NOT NULL,
  detail        TEXT,
  detected_at   TIMESTAMPTZ DEFAULT NOW(),
  auto_killed   BOOLEAN DEFAULT false
);

-- Indexes for fast lookup

CREATE INDEX idx_active_sessions_user ON active_sessions(user_id);
CREATE INDEX idx_active_sessions_status ON active_sessions(status);
CREATE INDEX idx_active_sessions_server_hash ON active_sessions(server_url_hash);
CREATE INDEX idx_active_sessions_next_rescan ON active_sessions(next_rescan_at)
  WHERE status = 'active';
CREATE INDEX idx_session_anomalies_session ON session_anomalies(session_id);
CREATE INDEX idx_session_anomalies_severity ON session_anomalies(severity);

-- Retention: auto-delete anomalies older than 30 days for terminated sessions

CREATE OR REPLACE FUNCTION delete_old_session_anomalies()
RETURNS void AS $$
  DELETE FROM session_anomalies
  WHERE detected_at < NOW() - INTERVAL '30 days'
    AND session_id IN (SELECT id FROM active_sessions WHERE status = 'terminated');
$$ LANGUAGE SQL;
