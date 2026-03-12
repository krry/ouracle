-- Add covenant columns to sessions (if missing)

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS covenant_version TEXT,
  ADD COLUMN IF NOT EXISTS covenant_accepted_at TIMESTAMPTZ;
