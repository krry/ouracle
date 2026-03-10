// Ouracle — Auth
// JWT access tokens (1h) + refresh tokens (30d).
// Refresh tokens stored hashed; never plaintext in the DB.

import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'crypto';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET  || 'dev-access-secret-change-in-prod';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-prod';
const ACCESS_TTL     = '1h';
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

export function signAccessToken(seeker_id) {
  return jwt.sign({ seeker_id }, ACCESS_SECRET, { expiresIn: ACCESS_TTL });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET); // throws on invalid/expired
}

export async function issueTokenPair(seeker_id) {
  const access_token  = signAccessToken(seeker_id);
  const refresh_token = randomBytes(40).toString('hex');
  const expires_at    = new Date(Date.now() + REFRESH_TTL_MS).toISOString();

  await sql`
    INSERT INTO refresh_tokens (seeker_id, token_hash, expires_at)
    VALUES (${seeker_id}, ${hashToken(refresh_token)}, ${expires_at})
  `;

  return { access_token, refresh_token, expires_in: 3600 };
}

export async function rotateRefreshToken(refresh_token) {
  const hash = hashToken(refresh_token);
  const [stored] = await sql`
    SELECT * FROM refresh_tokens
    WHERE token_hash = ${hash} AND revoked = FALSE AND expires_at > now()
  `;

  if (!stored) throw new Error('Invalid or expired refresh token');

  // Revoke the old one
  await sql`UPDATE refresh_tokens SET revoked = TRUE WHERE id = ${stored.id}`;

  // Issue a new pair
  return issueTokenPair(stored.seeker_id);
}

// ─────────────────────────────────────────────
// MIDDLEWARE
// Validates Bearer token on protected routes.
// Attaches seeker_id to req.seeker_id on success.
// ─────────────────────────────────────────────
export function authenticate(req, res, next) {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized. Provide a Bearer token.' });
  }

  try {
    const payload = verifyAccessToken(header.slice(7));
    req.seeker_id = payload.seeker_id;
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalid or expired.' });
  }
}
