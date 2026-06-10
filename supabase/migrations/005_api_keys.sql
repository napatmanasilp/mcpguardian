CREATE TABLE api_keys (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_hash          TEXT        NOT NULL UNIQUE,
  key_prefix        TEXT        NOT NULL,
  name              TEXT        NOT NULL DEFAULT 'Default',
  plan              TEXT        NOT NULL DEFAULT 'free',
  calls_this_month  INTEGER     NOT NULL DEFAULT 0,
  calls_limit       INTEGER     NOT NULL DEFAULT 100,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at      TIMESTAMPTZ,
  revoked           BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_api_keys_hash   ON api_keys(key_hash) WHERE revoked = FALSE;
CREATE INDEX idx_api_keys_user   ON api_keys(user_id)  WHERE revoked = FALSE;

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own keys"
  ON api_keys FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users insert own keys"
  ON api_keys FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own keys"
  ON api_keys FOR UPDATE USING (user_id = auth.uid());

-- Service role for cron jobs (no RLS restriction)
CREATE POLICY "Service role full access"
  ON api_keys FOR ALL USING (auth.role() = 'service_role');
