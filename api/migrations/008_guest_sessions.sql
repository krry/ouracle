CREATE TABLE IF NOT EXISTS guest_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turns_used INTEGER NOT NULL DEFAULT 0,
  max_turns  INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);

CREATE INDEX IF NOT EXISTS idx_guest_sessions_expires ON guest_sessions (expires_at);
