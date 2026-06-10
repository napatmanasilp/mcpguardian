-- ─── Forensic Content Storage (Opt-In) ──────────────────────────────
-- Stores encrypted request/response content for post-breach forensic
-- analysis. Only active when GUARDIAN_FORENSIC_MODE is enabled.
-- Content is AES-256-GCM encrypted at rest.
-- Default retention: 30 days (shorter than main logs).

CREATE TABLE IF NOT EXISTS invocation_content_store (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invocation_id     UUID REFERENCES tool_invocation_logs(id) ON DELETE CASCADE,
  content_type      TEXT CHECK (content_type IN ('request_params', 'response_body')),
  content_encrypted TEXT NOT NULL,
  content_size      INTEGER,
  iv                TEXT NOT NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_store_invocation
  ON invocation_content_store(invocation_id);

-- Retention policy: delete records older than 30 days
CREATE INDEX IF NOT EXISTS idx_content_store_created
  ON invocation_content_store(created_at);
