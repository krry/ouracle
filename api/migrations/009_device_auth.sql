-- Device-based auth for native iOS clients.
-- Each device has two Curve25519 keypairs (ECDH agreement + Ed25519 signing).
-- The signing key is used to verify challenge responses.
-- First verify auto-creates a seeker; subsequent verifies find the existing one.

CREATE TABLE IF NOT EXISTS device_identities (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seeker_id       UUID NOT NULL REFERENCES seekers(id) ON DELETE CASCADE,
  signing_key     TEXT NOT NULL UNIQUE,  -- Ed25519 public key, base64
  agreement_key   TEXT NOT NULL,         -- Curve25519 ECDH public key, base64
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS device_identities_seeker_id_idx ON device_identities(seeker_id);
