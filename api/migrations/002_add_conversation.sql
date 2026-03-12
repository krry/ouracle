-- Add structured conversation buffer for multi-turn context

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS conversation JSONB;
