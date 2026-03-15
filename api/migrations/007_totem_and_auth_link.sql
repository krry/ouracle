-- Link BetterAuth user to existing seeker
ALTER TABLE seekers ADD COLUMN IF NOT EXISTS auth_user_id TEXT UNIQUE;

-- Totem table — stores encrypted blob per seeker
CREATE TABLE IF NOT EXISTS totems (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seeker_id   UUID NOT NULL REFERENCES seekers(id) ON DELETE CASCADE,
  ciphertext  TEXT NOT NULL,
  public_key  TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(seeker_id)
);

-- Device keys — one row per registered device
CREATE TABLE IF NOT EXISTS totem_devices (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seeker_id    UUID NOT NULL REFERENCES seekers(id) ON DELETE CASCADE,
  device_name  TEXT,
  public_key   TEXT NOT NULL,
  wrapped_key  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
