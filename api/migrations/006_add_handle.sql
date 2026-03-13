-- Add handle (unique sign-in name + emoji) and handle_base (slug only, for collision queries).
ALTER TABLE seekers ADD COLUMN IF NOT EXISTS handle TEXT;
ALTER TABLE seekers ADD COLUMN IF NOT EXISTS handle_base TEXT;

-- Fill existing rows so we can add NOT NULL constraint.
UPDATE seekers
SET handle_base = LOWER(REGEXP_REPLACE(COALESCE(name, 'seeker'), '[^a-z0-9]', '', 'g')),
    handle = LOWER(REGEXP_REPLACE(COALESCE(name, 'seeker'), '[^a-z0-9]', '', 'g')) || '🌙'
WHERE handle IS NULL;

ALTER TABLE seekers ALTER COLUMN handle SET NOT NULL;
ALTER TABLE seekers ALTER COLUMN handle_base SET NOT NULL;
ALTER TABLE seekers ADD CONSTRAINT seekers_handle_unique UNIQUE (handle);
CREATE INDEX IF NOT EXISTS idx_seekers_handle_base ON seekers (handle_base);
CREATE INDEX IF NOT EXISTS idx_seekers_handle_lower ON seekers (LOWER(handle));
