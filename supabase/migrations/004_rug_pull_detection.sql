CREATE TABLE IF NOT EXISTS tool_definition_snapshots (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  config_hash TEXT NOT NULL,
  server_url TEXT NOT NULL,
  tools_hash TEXT NOT NULL,
  tools_snapshot JSONB NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  change_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(config_hash, server_url)
);

ALTER TABLE tool_definition_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own snapshots"
  ON tool_definition_snapshots
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM scans
      WHERE scans.user_id = auth.uid()
      AND scans.config_hash = tool_definition_snapshots.config_hash
    )
  );

CREATE POLICY "Service role full access"
  ON tool_definition_snapshots
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_snapshots_lookup
  ON tool_definition_snapshots(config_hash, server_url);
