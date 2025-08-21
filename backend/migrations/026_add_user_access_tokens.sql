-- Add user_access_tokens table for API key authentication
CREATE TABLE IF NOT EXISTS user_access_tokens (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL
               REFERENCES users(id) ON DELETE CASCADE,
  token_id     TEXT NOT NULL UNIQUE,        -- short, public ID embedded in token
  token_hash   TEXT NOT NULL,               -- Argon2id hash of full token
  name         TEXT,                        -- label shown to user ("Desktop App")
  last_four    TEXT NOT NULL,               -- last 4 of secret (display)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_uat_user_id
  ON user_access_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_uat_valid
  ON user_access_tokens(token_id)
  WHERE revoked_at IS NULL;