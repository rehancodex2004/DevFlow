-- Persist revoked JWTs so logout remains effective across server restarts and instances.
CREATE TABLE IF NOT EXISTS revoked_auth_tokens (
  token_hash CHAR(64) PRIMARY KEY,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS revoked_auth_tokens_expires_at_idx
  ON revoked_auth_tokens (expires_at);
