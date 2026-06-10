-- Tracks which (api_key, server_url) combos were scanned
-- and when, so we only count 1 check per server per 24h

CREATE TABLE check_cache (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id  UUID        NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  server_key  TEXT        NOT NULL,
  -- server_key = stable identifier for the server:
  --   HTTP servers: the URL (normalized, no trailing slash)
  --   STDIO servers: sha256(command + args.join(' '))
  checked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_type  TEXT        NOT NULL DEFAULT 'session_start',
  -- check_type: 'first_discovery' | 'daily_rescan' | 'manual'
  UNIQUE(api_key_id, server_key)
  -- ON CONFLICT UPDATE checked_at (upsert pattern)
);

CREATE INDEX idx_check_cache_key    ON check_cache(api_key_id);
CREATE INDEX idx_check_cache_server ON check_cache(server_key);
CREATE INDEX idx_check_cache_time   ON check_cache(checked_at);

ALTER TABLE check_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own cache"
  ON check_cache FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Service role full access"
  ON check_cache FOR ALL USING (auth.role() = 'service_role');

-- Usage summary view (for dashboard usage meter)
CREATE VIEW usage_summary AS
SELECT
  ak.user_id,
  ak.id               AS api_key_id,
  ak.name             AS key_name,
  ak.plan,
  ak.calls_this_month AS checks_used,
  ak.calls_limit      AS checks_limit,
  ROUND(
    (ak.calls_this_month::NUMERIC / NULLIF(ak.calls_limit, 0)) * 100, 1
  )                   AS percent_used,
  -- Next reset = 1st of next month 00:01 UTC
  DATE_TRUNC('month', NOW()) + INTERVAL '1 month' + INTERVAL '1 minute'
                      AS reset_at
FROM api_keys ak
WHERE ak.revoked = FALSE;
