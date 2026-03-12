-- Ouracle: initial schema (Neon/Postgres)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS seekers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id        TEXT,
  email_hash       TEXT,
  timezone         TEXT,
  consent_version  TEXT NOT NULL,
  consented_at     TIMESTAMPTZ NOT NULL,
  covenant_version TEXT,
  covenant_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seeker_id         UUID NOT NULL REFERENCES seekers(id) ON DELETE CASCADE,
  stage             TEXT DEFAULT 'inquiry',
  turn              INT DEFAULT 0,
  full_text         TEXT,
  vagal_probable    TEXT,
  vagal_confidence  TEXT,
  belief_pattern    TEXT,
  belief_confidence TEXT,
  quality           TEXT,
  quality_confidence TEXT,
  quality_is_shock  BOOLEAN,
  rite_name         TEXT,
  rite_json         JSONB,
  love_fear_audit   JSONB,
  enacted           BOOLEAN,
  resistance_level  INT,
  report            JSONB,
  prescribed_at     TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  covenant_version  TEXT,
  covenant_accepted_at TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enactments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seeker_id  UUID NOT NULL REFERENCES seekers(id) ON DELETE CASCADE,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  domain     TEXT NOT NULL,
  verb       TEXT NOT NULL,
  enacted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reintegration_corpus (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  belief_pattern          TEXT,
  vagal_state             TEXT,
  quality                 TEXT,
  quality_is_shock        BOOLEAN,
  rite_name               TEXT,
  enacted                 BOOLEAN,
  resistance_level        INT,
  belief_strength_before  INT,
  belief_strength_after   INT,
  unexpected              TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seeker_id   UUID NOT NULL REFERENCES seekers(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash     TEXT NOT NULL UNIQUE,
  label        TEXT,
  active       BOOLEAN NOT NULL DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
