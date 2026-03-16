// Ouracle — Repository Layer
// All database access goes through here.
// Routes never touch the DB client directly.
// Swap the implementation (SQLite → Postgres → anything) without touching index.js.

import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Add it to api/.env');
}

const sql = neon(process.env.DATABASE_URL);

// ─────────────────────────────────────────────
// HANDLE GENERATION
// ─────────────────────────────────────────────

const EMOJI_POOL = [
  '🌙','⭐','🌟','💫','✨','🌞','☄️','🪐','🌛','🌜',
  '🔥','💧','🌊','⚡','🌀','🌬️',
  '🌿','🍃','🌱','🌺','🌸','🌼','🌻','🌹','🍀','🌾',
  '🌴','🌵','🎋','🍄','🪸','🪨',
  '🦋','🦉','🐉','🦅','🦁','🐺','🦊','🦌','🦚','🦜',
  '🐝','🦈','🦩','🦬','🪶',
  '💎','🔮','💠','🗝️','🕯️','⚗️','🧿','🪬','🪄','🔭',
  '💡','🫧','🪩','🧲','🌂',
  '🌈','🏔️','🌌','🕊️','♾️','⚜️','🏵️','🎯','🎭','☯️',
  '🧊','❄️','🌪️','⛰️','🗺️','🧭','🎐','🌤️',
];

function slugify(name) {
  const normalized = String(name).normalize('NFC');
  return normalized.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'seeker';
}

function normalizeHandle(value) {
  return String(value).normalize('NFC');
}

export async function generateHandle(name) {
  const base = slugify(name);

  // Find which emoji are already taken for this base slug.
  const rows = await sql`
    SELECT handle FROM seekers WHERE handle_base = ${base}
  `;
  const taken = new Set(rows.map((r) => r.handle));

  // Shuffle and try each emoji.
  const shuffled = [...EMOJI_POOL].sort(() => Math.random() - 0.5);
  for (const emoji of shuffled) {
    const candidate = normalizeHandle(`${base}${emoji}`);
    if (!taken.has(candidate)) {
      return { handle: candidate, handle_base: base };
    }
  }

  return null; // All emoji exhausted for this slug.
}

export async function getSeekerByHandle(handle) {
  const normalized = normalizeHandle(handle);
  const [seeker] = await sql`
    SELECT * FROM seekers WHERE LOWER(handle) = LOWER(${normalized})
  `;
  return seeker ?? null;
}

// ─────────────────────────────────────────────
// SEEKERS
// ─────────────────────────────────────────────

export async function createSeeker({ device_id, email_hash, timezone, consent_version, name, password_hash, handle, handle_base }) {
  const normalized_handle = normalizeHandle(handle);
  const normalized_handle_base = slugify(handle_base);
  const [seeker] = await sql`
    INSERT INTO seekers (device_id, email_hash, timezone, consent_version, consented_at, name, password_hash, handle, handle_base)
    VALUES (
      ${device_id ?? null},
      ${email_hash ?? null},
      ${timezone ?? null},
      ${consent_version},
      now(),
      ${name ?? null},
      ${password_hash ?? null},
      ${normalized_handle},
      ${normalized_handle_base}
    )
    RETURNING *
  `;
  return seeker;
}

export async function getSeeker(id) {
  const [seeker] = await sql`SELECT * FROM seekers WHERE id = ${id}`;
  return seeker ?? null;
}

export async function recordCovenant(seeker_id, covenant_version) {
  const [seeker] = await sql`
    UPDATE seekers
    SET covenant_version = ${covenant_version}, covenant_at = now(), updated_at = now()
    WHERE id = ${seeker_id}
    RETURNING *
  `;
  return seeker ?? null;
}

export async function getSeekerHistory(seeker_id, limit = 10) {
  return sql`
    SELECT id, stage, rite_name, quality, enacted, prescribed_at, completed_at, created_at
    FROM sessions
    WHERE seeker_id = ${seeker_id} AND stage = 'complete'
    ORDER BY completed_at DESC
    LIMIT ${limit}
  `;
}

export async function getSeekerThread(seeker_id, limit = 50) {
  return sql`
    SELECT id, stage, quality, enacted,
           rite_name, rite_json, report,
           created_at, prescribed_at, completed_at
    FROM sessions
    WHERE seeker_id = ${seeker_id}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
}

export async function getSeekerSessionCount(seeker_id) {
  const [row] = await sql`
    SELECT COUNT(*)::int AS count
    FROM sessions
    WHERE seeker_id = ${seeker_id}
  `;
  return row?.count ?? 0;
}

export async function getSeekerLatestSession(seeker_id) {
  const [row] = await sql`
    SELECT id, conversation, quality, rite_name, rite_json, completed_at, created_at
    FROM sessions
    WHERE seeker_id = ${seeker_id}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return row ?? null;
}

export async function deleteSeeker(seeker_id) {
  const [row] = await sql`
    DELETE FROM seekers
    WHERE id = ${seeker_id}
    RETURNING id
  `;
  return row ?? null;
}

export async function updateSeekerPassword(seeker_id, password_hash) {
  const [row] = await sql`
    UPDATE seekers
    SET password_hash = ${password_hash}, updated_at = now()
    WHERE id = ${seeker_id}
    RETURNING id
  `;
  return row ?? null;
}

export async function redactSession(seeker_id, session_id) {
  const [row] = await sql`
    UPDATE sessions
    SET full_text = NULL,
        conversation = NULL,
        report = NULL,
        rite_json = NULL,
        updated_at = now()
    WHERE id = ${session_id} AND seeker_id = ${seeker_id}
    RETURNING id
  `;
  return row ?? null;
}

// ─────────────────────────────────────────────
// SESSIONS
// ─────────────────────────────────────────────

export async function createSession(seeker_id, covenant) {
  const covenant_version = covenant?.version ?? null;
  const covenant_accepted = covenant?.accepted === true;
  const covenant_timestamp = covenant?.timestamp ?? null;

  const [session] = await sql`
    INSERT INTO sessions (seeker_id, covenant_version, covenant_accepted_at)
    VALUES (
      ${seeker_id},
      ${covenant_version},
      ${covenant_accepted ? (covenant_timestamp ?? new Date().toISOString()) : null}
    )
    RETURNING *
  `;
  return session;
}

export async function getSession(id) {
  const [session] = await sql`SELECT * FROM sessions WHERE id = ${id}`;
  return session ?? null;
}

export async function updateSession(id, fields) {
  const {
    stage, turn, full_text,
    conversation,
    vagal_probable, vagal_confidence,
    belief_pattern, belief_confidence,
    quality, quality_confidence, quality_is_shock,
    rite_name, rite_json, love_fear_audit,
    enacted, resistance_level, report,
    prescribed_at, completed_at,
  } = fields;

  const [session] = await sql`
    UPDATE sessions SET
      stage              = COALESCE(${stage ?? null}, stage),
      turn               = COALESCE(${turn ?? null}, turn),
      full_text          = COALESCE(${full_text ?? null}, full_text),
      conversation       = COALESCE(${conversation ? JSON.stringify(conversation) : null}::jsonb, conversation),
      vagal_probable     = COALESCE(${vagal_probable ?? null}, vagal_probable),
      vagal_confidence   = COALESCE(${vagal_confidence ?? null}, vagal_confidence),
      belief_pattern     = COALESCE(${belief_pattern ?? null}, belief_pattern),
      belief_confidence  = COALESCE(${belief_confidence ?? null}, belief_confidence),
      quality            = COALESCE(${quality ?? null}, quality),
      quality_confidence = COALESCE(${quality_confidence ?? null}, quality_confidence),
      quality_is_shock   = COALESCE(${quality_is_shock ?? null}, quality_is_shock),
      rite_name          = COALESCE(${rite_name ?? null}, rite_name),
      rite_json          = COALESCE(${rite_json ? JSON.stringify(rite_json) : null}::jsonb, rite_json),
      love_fear_audit    = COALESCE(${love_fear_audit ? JSON.stringify(love_fear_audit) : null}::jsonb, love_fear_audit),
      enacted            = COALESCE(${enacted ?? null}, enacted),
      resistance_level   = COALESCE(${resistance_level ?? null}, resistance_level),
      report             = COALESCE(${report ? JSON.stringify(report) : null}::jsonb, report),
      prescribed_at      = COALESCE(${prescribed_at ?? null}, prescribed_at),
      completed_at       = COALESCE(${completed_at ?? null}, completed_at),
      updated_at         = now()
    WHERE id = ${id}
    RETURNING *
  `;
  return session ?? null;
}

// ─────────────────────────────────────────────
// ENACTMENTS
// ─────────────────────────────────────────────

export async function logEnactment(seeker_id, session_id, domain, verb) {
  const [enactment] = await sql`
    INSERT INTO enactments (seeker_id, session_id, domain, verb)
    VALUES (${seeker_id}, ${session_id ?? null}, ${domain}, ${verb})
    RETURNING *
  `;
  return enactment;
}

export async function getSeekerEnactments(seeker_id) {
  return sql`
    SELECT domain, verb, enacted_at
    FROM enactments
    WHERE seeker_id = ${seeker_id}
    ORDER BY enacted_at ASC
  `;
}

export async function hasEnacted(seeker_id, domain) {
  const [row] = await sql`
    SELECT 1 FROM enactments
    WHERE seeker_id = ${seeker_id} AND domain = ${domain}
    LIMIT 1
  `;
  return !!row;
}

// ─────────────────────────────────────────────
// REINTEGRATION CORPUS
// Written anonymously. No seeker_id. By design.
// ─────────────────────────────────────────────

export async function writeToCorpus({
  belief_pattern, vagal_state, quality, quality_is_shock,
  rite_name, enacted, resistance_level,
  belief_strength_before, belief_strength_after,
  unexpected,
}) {
  const [row] = await sql`
    INSERT INTO reintegration_corpus (
      belief_pattern, vagal_state, quality, quality_is_shock,
      rite_name, enacted, resistance_level,
      belief_strength_before, belief_strength_after,
      unexpected
    ) VALUES (
      ${belief_pattern ?? null}, ${vagal_state ?? null}, ${quality ?? null}, ${quality_is_shock ?? null},
      ${rite_name ?? null}, ${enacted ?? null}, ${resistance_level ?? null},
      ${belief_strength_before ?? null}, ${belief_strength_after ?? null},
      ${unexpected ?? null}
    )
    RETURNING id, created_at
  `;
  return row;
}

// ─────────────────────────────────────────────
// API KEYS
// ─────────────────────────────────────────────

export async function createApiKey({ key_hash, label, expires_at }) {
  const [row] = await sql`
    INSERT INTO api_keys (key_hash, label, expires_at)
    VALUES (${key_hash}, ${label ?? null}, ${expires_at ?? null})
    RETURNING id, label, active, expires_at, created_at
  `;
  return row;
}

export async function updateApiKey(id, { active, expires_at, label }) {
  const [row] = await sql`
    UPDATE api_keys SET
      active = COALESCE(${active ?? null}, active),
      expires_at = COALESCE(${expires_at ?? null}, expires_at),
      label = COALESCE(${label ?? null}, label),
      last_used_at = last_used_at
    WHERE id = ${id}
    RETURNING id, label, active, expires_at, last_used_at, created_at
  `;
  return row ?? null;
}

// ─────────────────────────────────────────────
// BETTERAUTH BRIDGE + TOTEM
// ─────────────────────────────────────────────

export async function findBetterAuthSession(token) {
  const [row] = await sql`
    SELECT s.token, s."expiresAt", u.id AS "authUserId", u.name
    FROM session s
    JOIN "user" u ON u.id = s."userId"
    WHERE s.token = ${token}
  `;
  return row ?? null;
}

export async function getOrCreateSeekerByAuthId(authUserId, name) {
  const [existing] = await sql`
    SELECT * FROM seekers WHERE auth_user_id = ${authUserId}
  `;
  if (existing) return existing;

  const handleResult = await generateHandle(name ?? 'seeker');
  if (!handleResult) throw new Error('Handle pool exhausted.');

  const [created] = await sql`
    INSERT INTO seekers (auth_user_id, name, consent_version, consented_at, handle, handle_base)
    VALUES (${authUserId}, ${name ?? null}, ${'1.0'}, now(), ${handleResult.handle}, ${handleResult.handle_base})
    RETURNING *
  `;
  return created;
}

export async function getTotem(seekerId) {
  const [row] = await sql`
    SELECT * FROM totems WHERE seeker_id = ${seekerId}
  `;
  return row ?? null;
}

export async function upsertTotem(seekerId, ciphertext, publicKey) {
  await sql`
    INSERT INTO totems (seeker_id, ciphertext, public_key, updated_at)
    VALUES (${seekerId}, ${ciphertext}, ${publicKey}, NOW())
    ON CONFLICT (seeker_id) DO UPDATE
    SET ciphertext = ${ciphertext}, public_key = ${publicKey}, updated_at = NOW()
  `;
}

export async function getDevices(seekerId) {
  return sql`
    SELECT * FROM totem_devices WHERE seeker_id = ${seekerId} ORDER BY created_at
  `;
}

export async function addDevice(seekerId, deviceName, publicKey, wrappedKey) {
  await sql`
    INSERT INTO totem_devices (seeker_id, device_name, public_key, wrapped_key)
    VALUES (${seekerId}, ${deviceName ?? null}, ${publicKey}, ${wrappedKey ?? null})
  `;
}

// ─────────────────────────────────────────────
// GUEST SESSIONS
// Short-lived, no-auth sessions for unauthenticated seekers.
// ─────────────────────────────────────────────

export async function createGuestSession() {
  const rows = await sql`INSERT INTO guest_sessions DEFAULT VALUES RETURNING *`;
  return rows[0];
}

export async function getGuestSession(id) {
  const rows = await sql`SELECT * FROM guest_sessions WHERE id = ${id}::uuid AND expires_at > NOW()`;
  return rows[0] ?? null;
}

export async function incrementGuestTurn(id) {
  await sql`UPDATE guest_sessions SET turns_used = turns_used + 1 WHERE id = ${id}::uuid`;
}
