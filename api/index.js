import express from 'express';
import { fetchAudio, hasFishKey } from './fish-tts.js';
import { split as splitSentences } from 'sentence-splitter';

function isSentenceBoundary(token, nextToken) {
  if (!token) return false;
  const lastChar = token[token.length - 1];
  if (lastChar === '.' || lastChar === '!' || lastChar === '?') {
    // Avoid splitting on common abbreviations
    const abbrevs = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.', 'St.', 'etc.', 'e.g.', 'i.e.'];
    const isAbbrev = abbrevs.some(abbr => token.endsWith(abbr));
    if (isAbbrev) return false;
    // If followed by capitalization or end, it's likely a sentence boundary
    if (!nextToken) return true;
    const firstChar = nextToken[0];
    if (firstChar === firstChar.toUpperCase()) return true;
  }
  return false;
}

// ── SSE Event helpers ───────────────────────────────────────────────
function sendSSE(res, obj) {
  res.write(`data: ${JSON.stringify(obj)}\n\n`);
}

// ── Audio encoder cache ─────────────────────────────────────────────
const audioCache = new Map(); // text -> { base64, timestamp }
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
import { makeLlmClient } from './llm-client.js';
import { CLEA_SYSTEM_PROMPT } from './clea-prompt.js';
import { randomUUID } from 'crypto';
import { readFileSync, existsSync, mkdirSync, unlink } from 'fs';
import { execSync } from 'child_process';
const pkgPath = new URL('package.json', import.meta.url);
const { version } = JSON.parse(readFileSync(pkgPath));
import {
  authenticate,
  issueTokenPair,
  rotateRefreshToken,
  hashApiKey,
  hashPassword,
  verifyPassword,
  verifyAccessToken,
} from './auth.js';
import {
  infer,
  buildPrescription,
  chooseOpeningQuestion,
  getClosingDedication,
  drawDivinationSource,
  RITES,
  BELIEFS,
  OCTAVE,
} from './engine.js';
import {
  createSeeker,
  getSeeker,
  recordCovenant,
  getSeekerHistory,
  getSeekerSessionCount,
  getSeekerLatestSession,
  getSeekerThread,
  createSession,
  getSession,
  updateSession,
  logEnactment,
  getSeekerEnactments,
  hasEnacted,
  writeToCorpus,
  deleteSeeker,
  redactSession,
  createApiKey,
  updateApiKey,
  updateSeekerPassword,
  generateHandle,
  getSeekerByHandle,
  getTotem,
  upsertTotem,
  getDevices,
  addDevice,
  createGuestSession,
  getGuestSession,
  incrementGuestTurn,
  findBetterAuthSession,
  getOrCreateSeekerByAuthId,
  listOctaveSteps,
  getOctaveStep,
} from './db.js';
import { auth } from './auth-config.js';
import { toNodeHandler } from 'better-auth/node';
import { draw, listDecks, drawContextual, loadDecks, cardImagePath } from './decks.js';
import { buildSunoPackage } from './suno.js';

const app = express();

const ALLOWED_ORIGINS = [
  'https://ouracle.kerry.ink',
  'https://poiesis.kerry.ink',
  'http://localhost:3000',
  'http://localhost:2532',
  'https://localhost:2532',
  'http://localhost:5173',
  'http://souvenir.local:2532',
  'https://souvenir.local:2532',
];

// Any *.kerry.ink subdomain + Vercel preview deployments
const ALLOWED_ORIGIN_RE = /^https:\/\/([a-z0-9-]+\.)*kerry\.ink$|^https:\/\/ouracle(-[a-z0-9]+)*-kerry\.vercel\.app$/;
const DEV_ALLOWED_ORIGIN_RE = /^https?:\/\/(?:192\.168|10\.|127\.0\.0\.1|localhost)(?::\d+)?$|^https?:\/\/(?:[a-z0-9-]+\.)*local(?::\d+)?$/;

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (
    origin &&
    (
      ALLOWED_ORIGINS.includes(origin) ||
      ALLOWED_ORIGIN_RE.test(origin) ||
      (process.env.NODE_ENV !== 'production' && DEV_ALLOWED_ORIGIN_RE.test(origin))
    )
  ) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());

// ── Rate Limiting (global) ─────────────────────────────────────────────────────
const rateLimitStore = new Map(); // ip -> [timestamps]
function rateLimitMiddleware(req, res, next) {
  const ip = req.ip || (req.connection && req.connection.remoteAddress) || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 100;

  let timestamps = rateLimitStore.get(ip) || [];
  timestamps = timestamps.filter(t => now - t < windowMs);
  timestamps.push(now);
  rateLimitStore.set(ip, timestamps);

  // occasional cleanup to prevent unbounded growth
  if (rateLimitStore.size > 10000) {
    for (const [key, times] of rateLimitStore) {
      const recent = times.filter(t => now - t < windowMs);
      if (recent.length === 0) rateLimitStore.delete(key);
      else rateLimitStore.set(key, recent);
    }
  }

  if (timestamps.length > maxRequests) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }
  next();
}
app.use(rateLimitMiddleware);

// Serve ambient audio files — no auth required, public CDN-style
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RITES_DIR = join(__dirname, 'data', 'rites');

app.use('/ambient', express.static(join(__dirname, 'data/ambient'), {
  maxAge: '7d',
  setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'),
}));

app.use('/tarot', express.static(join(__dirname, '../assets/tarot'), {
  maxAge: '30d',
  setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'),
}));

// Root + error fallback → redirect to the web app
app.get('/', (req, res) => {
  const dest = new URL('https://ouracle.kerry.ink');
  if (req.query.error) dest.searchParams.set('error', req.query.error);
  res.redirect(302, dest.toString());
});

// Apple domain verification — Apple fetches this exact path
app.get('/.well-known/apple-developer-domain-association.txt', async (req, res) => {
  req.url = '/api/auth/.well-known/apple-developer-domain-association.txt';
  await toNodeHandler(auth)(req, res);
});

// Mount BetterAuth — handles /api/auth/* routes (Express 4 wildcard)
app.all('/api/auth/*', async (req, res, next) => {
  try {
    await toNodeHandler(auth)(req, res);
  } catch (err) {
    console.error('[BetterAuth error]', err);
    next(err);
  }
});

// POST /auth/social-exchange — trade a BetterAuth session token for our JWT
// Called after OAuth redirect; creates a seeker row if first social login.
app.post('/auth/social-exchange', async (req, res) => {
  const { session_token } = req.body || {};
  if (!session_token) return res.status(400).json({ error: 'session_token required.' });
  try {
    // auth.api.getSession requires a signed cookie — query the tables directly instead.
    const row = await findBetterAuthSession(session_token);
    if (!row || new Date(row.expiresAt) < new Date()) {
      return res.status(401).json({ error: 'Invalid session.' });
    }
    const { authUserId, name } = row;
    const seeker = await getOrCreateSeekerByAuthId(authUserId, name ?? null);
    const tokens = await issueTokenPair(seeker.id);
    res.json({ seeker_id: seeker.id, handle: seeker.handle, stage: deriveStage(seeker), ...tokens });
  } catch (err) {
    console.error('[social-exchange]', err);
    res.status(500).json({ error: err.message });
  }
});

const ADMIN_KEY = process.env.OURACLE_ADMIN_KEY;

// ─────────────────────────────────────────────
// GUEST AUTH MIDDLEWARE
// Accepts seeker JWT (sets req.seeker_id) or guest UUID (sets req.guest_session_id).
// ─────────────────────────────────────────────

async function authenticateOrGuest(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'No token.' });

  // Try seeker JWT first.
  try {
    const payload = verifyAccessToken(token);
    req.seeker_id = payload.seeker_id;
    req.is_guest = false;
    return next();
  } catch {}

  // Try guest session UUID (must be UUID format — non-UUID tokens cause a DB cast error).
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_RE.test(token)) return res.status(401).json({ error: 'Invalid or expired session.' });

  try {
    const guest = await getGuestSession(token);
    if (!guest) return res.status(401).json({ error: 'Invalid or expired session.' });
    if (guest.turns_used >= guest.max_turns) {
      return res.status(403).json({ error: 'Guest turn limit reached.', guest_limit: true });
    }
    req.guest_session_id = guest.id;
    req.is_guest = true;
    next();
  } catch (e) {
    console.error('[authenticateOrGuest]', e);
    res.status(500).json({ error: e.message });
  }
}

// Request logging (minimal, no body)
const ANSI = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  brightRed: '\x1b[91m',
};

function colorStatus(status) {
  if (status >= 500) return ANSI.brightRed;
  if (status >= 400) return ANSI.red;
  if (status >= 300) return ANSI.yellow;
  if (status >= 200) return ANSI.green;
  return ANSI.dim;
}

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const statusColor = colorStatus(res.statusCode);
    console.log(
      `${ANSI.dim}${req.method}${ANSI.reset} ${req.originalUrl} -> ${statusColor}${res.statusCode}${ANSI.reset} ${ms}ms`
    );
  });
  next();
});

app.use('/totem/devices', (req, res, next) => {
  const requestId = randomUUID().slice(0, 8);
  const authHeader = req.headers.authorization;
  const bodyKeys = req.body && typeof req.body === 'object' ? Object.keys(req.body) : [];
  const originalJson = res.json.bind(res);

  console.log(
    `[totem/devices:${requestId}] in method=${req.method} url=${req.originalUrl} origin=${req.headers.origin ?? '-'} auth=${authHeader ? 'yes' : 'no'} contentType=${req.headers['content-type'] ?? '-'} bodyKeys=${bodyKeys.join(',') || '-'}`
  );

  res.json = (payload) => {
    console.log(
      `[totem/devices:${requestId}] out status=${res.statusCode} payloadKeys=${payload && typeof payload === 'object' ? Object.keys(payload).join(',') : '-'}`
    );
    return originalJson(payload);
  };

  res.on('finish', () => {
    console.log(
      `[totem/devices:${requestId}] finish status=${res.statusCode} seeker=${req.seeker_id ?? '-'} bodyPublicKey=${req.body?.public_key ? 'yes' : 'no'} wrapped=${req.body?.wrapped_key ? 'yes' : 'no'}`
    );
  });

  next();
});

// ─────────────────────────────────────────────
// GUEST SESSIONS
// POST /aspire — issue a short-lived guest session token (no auth required)
// ─────────────────────────────────────────────

app.post('/aspire', async (req, res) => {
  try {
    const session = await createGuestSession();
    res.json({ guest_token: session.id, max_turns: session.max_turns });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// COVENANT
// Public: Priestess apps fetch the current covenant text.
// ─────────────────────────────────────────────

const COVENANT = {
  version: '1.0',
  effective_date: '2026-03-11',
  text: [
    'I accept 100% responsibility for my choices and actions;',
    'be they legal, lawful, moral, ethical,',
    'spiritual, financial, physical, and/or metaphysical,',
    'only I can truly know whether my intent serves love or fear.',
    'Ouracle listens. The priestess speaks. I act as I will.',
  ],
};

const COVENANT_REMINDER = 'But, before we enter the temple, I must ask that we enter a covenant. Are you ready?';
const READY_MESSAGE_RE = /\b(yes|yeah|yep|yup|ready|i(?:'| a)?m ready|i want it|i do|let'?s|go ahead|please|okay|ok|sure|absolutely|definitely|i(?:'| a)?m open|open to it|i accept)\b/i;
const REPORT_MESSAGE_RE = /\b(i did it|i tried it|i did the rite|i did the practice|i tried the practice|after doing it|when i did it|i felt|it felt|i noticed|it helped|it didn't help|nothing happened|i resisted|i avoided it|i couldn't do it|i didn't do it|here's what happened|my experience was|afterward|afterwards)\b/i;
const RITE_FEEDBACK_PROMPT = "Take this rite with you. When you've met it, come back and tell me what happened.";
const RITE_FEEDBACK_FOLLOWUP = 'What else presented, came up, or arose?';

function deriveStage(seeker) {
  return seeker?.covenant_at ? 'covenanted' : 'known';
}

app.get('/covenant/current', (_req, res) => res.json(COVENANT));

// ── Divination ───────────────────────────────────────────────────────────────

app.get('/decks', authenticateOrGuest, async (req, res) => {
  try {
    res.json(await listDecks());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Octave of Evolution ───────────────────────────────────────────────────────

app.get('/octave/steps', authenticate, async (_req, res) => {
  try {
    res.json(await listOctaveSteps());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/octave/step/:number', authenticate, async (req, res) => {
  try {
    const step = await getOctaveStep(parseInt(req.params.number));
    if (!step) return res.status(404).json({ error: 'Step not found' });
    res.json(step);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /octave/step/:number/:field — fetch single field (use dot notation for nested, e.g., audio_profile.frequencyHertz)
app.get('/octave/step/:number/:field', authenticate, async (req, res) => {
  try {
    const number = parseInt(req.params.number);
    const field = req.params.field;

    if (number < 1 || number > 10) return res.status(404).json({ error: 'Step not found' });
    // Allow alphanumeric, underscore, and dot for nested access
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/.test(field)) {
      return res.status(400).json({ error: 'Invalid field name' });
    }

    const row = await sql`
      SELECT ${sql(field)} AS value
      FROM octave_steps
      WHERE number = ${number}
    `;
    if (!row.length) return res.status(404).json({ error: 'Step not found' });

    res.json({ [field]: row[0].value });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /draw?n=3&decks=tarot,iching&context=...
// context = seeker's full text for semantic card selection (keyword match)
app.get('/draw', async (req, res) => {
  try {
    const n = Math.min(Math.max(parseInt(req.query.n) || 1, 1), 10);
    const deckIds = req.query.decks ? req.query.decks.split(',').map(s => s.trim()).filter(Boolean) : null;
    const context = req.query.context ? String(req.query.context).trim() : null;
    const cards = context
      ? await drawContextual(context, n, deckIds)
      : await draw(n, deckIds);
    if (cards.length === 0) return res.status(404).json({ error: 'No cards found.' });
    res.json({ cards: cards.map(c => ({ ...c, imageUrl: cardImagePath(c) })) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─────────────────────────────────────────────
// PREREQUISITE MAP
// "Stand before you speak. Release before you weep."
// ─────────────────────────────────────────────
const PREREQUISITES = {
  root:   [],
  sacral: ['root'],
  solar:  ['root'],
  heart:  ['root', 'sacral'],
  throat: ['root', 'solar'],
  brow:   ['heart', 'throat'],
  crown:  ['brow'],
};

async function checkPrerequisites(seeker_id, domain) {
  const required = PREREQUISITES[domain] || [];
  const missing = [];
  for (const d of required) {
    if (!(await hasEnacted(seeker_id, d))) missing.push(d);
  }
  return { ok: missing.length === 0, missing };
}

// ─────────────────────────────────────────────
// DIRECT DOMAIN ENDPOINTS
// POST /:domain/:verb
// ─────────────────────────────────────────────

const DOMAIN_VERBS = {
  root:   ['stand', 'hold', 'eat', 'exist', 'release', 'ground'],
  sacral: ['dance', 'taste', 'receive', 'make', 'attract', 'flow'],
  solar:  ['lift', 'move', 'decide', 'lead', 'exert'],
  heart:  ['weep', 'comfort', 'breathe', 'forgive', 'reach'],
  throat: ['speak', 'sing', 'declare', 'name', 'say'],
  brow:   ['watch', 'notice', 'witness', 'see'],
  crown:  ['dissolve', 'belong', 'open', 'receive-all'],
};

const ALL_DOMAINS = Object.keys(DOMAIN_VERBS);

function directRite(domain, verb) {
  const beliefEntry = Object.entries(BELIEFS).find(([, v]) => v.chakra === domain);
  if (beliefEntry) {
    const [pattern] = beliefEntry;
    const rite = RITES[pattern];
    if (rite) return { rite, pattern, domain };
  }
  return {
    rite: {
      rite_name: `The ${verb.charAt(0).toUpperCase() + verb.slice(1)}`,
      act: `Perform the act of ${verb} with full attention. Note what arises.`,
      invocation: `I am present to this impulse.`,
      textures: ['Resistance before', 'Sensation during', 'Integration after'],
      orientation: 'love',
    },
    pattern: null,
    domain,
  };
}

// ─────────────────────────────────────────────
// SESSION LIFECYCLE
// ─────────────────────────────────────────────

app.post('/session/new', authenticate, async (req, res) => {
  const { covenant, context } = req.body || {};
  const seeker_id = req.seeker_id; // from JWT

  const seeker = await getSeeker(seeker_id);
  if (!seeker) return res.status(404).json({ error: 'Seeker not found.' });
  if (!covenant?.accepted) {
    return res.status(400).json({
      error: 'Covenant not accepted.',
      hint: 'Fetch GET /covenant/current, then POST /session/new with { covenant: { version, accepted: true, timestamp } }.',
    });
  }
  if (String(covenant.version) !== String(COVENANT.version)) {
    return res.status(400).json({
      error: 'Covenant version mismatch.',
      current: COVENANT.version,
      hint: 'Fetch GET /covenant/current for the latest covenant.',
    });
  }

  if (!seeker.covenant_at || String(seeker.covenant_version) !== String(covenant.version)) {
    await recordCovenant(seeker_id, covenant.version);
  }

  const sessionCount = await getSeekerSessionCount(seeker_id);
  const lastSession = await getSeekerLatestSession(seeker_id);
  const lastQuestion = Array.isArray(lastSession?.conversation)
    ? lastSession.conversation.find((entry) => entry?.role === 'priestess')?.text
    : null;
  const lastAt = lastSession?.completed_at || lastSession?.created_at;
  const daysSinceLast = lastAt
    ? Math.floor((Date.now() - new Date(lastAt).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const session = await createSession(seeker_id, covenant);
  const question = chooseOpeningQuestion({
    ...(context || {}),
    session_count: sessionCount,
    last_question: lastQuestion,
    last_quality: lastSession?.quality ?? null,
    last_rite_name: lastSession?.rite_name ?? null,
    days_since_last: daysSinceLast,
  });
  const lastAct = lastSession?.rite_json?.act;
  const returningGreeting = lastAct
    ? `Welcome back. You were going to ${lastAct.replace(/\.$/, '')}.`
    : lastSession?.rite_name
      ? `Welcome back. You were working with ${lastSession.rite_name}.`
      : null;
  const greeting = daysSinceLast !== null && daysSinceLast >= 90
    ? "Three months. What's been happening?"
    : returningGreeting;
  const nowIso = new Date().toISOString();
  const conversation = [
    ...(greeting ? [{ role: 'priestess', text: greeting, at: nowIso }] : []),
    { role: 'priestess', text: question, at: nowIso },
  ];

  await updateSession(session.id, { stage: 'inquiry', turn: 0, conversation });

  return res.json({ session_id: session.id, stage: 'inquiry', turn: 0, greeting, question, awaiting: 'response' });
});

app.get('/session/:id', authenticate, async (req, res) => {
  const session = await getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found.' });
  return res.json(session);
});

// ─────────────────────────────────────────────
// STAGE 1: INQUIRY
// POST /inquire
// ─────────────────────────────────────────────
app.post('/inquire', authenticate, async (req, res) => {
  const { session_id, response, octave_override } = req.body;

  if (!session_id) {
    return res.status(400).json({
      error: 'session_id required.',
      hint: 'Start with POST /session/new to open a session.',
    });
  }

  // Continuing session
  const session = await getSession(session_id);
  if (!session) return res.status(404).json({ error: 'Session not found.' });

  const newText = `${session.full_text || ''} ${response || ''}`.trim();
  const newTurn = (session.turn || 0) + 1;
  const conversation = Array.isArray(session.conversation) ? [...session.conversation] : [];
  if (response) {
    conversation.push({ role: 'seeker', text: response, at: new Date().toISOString() });
  }

  const { vagal, belief, quality, affect } = await infer(newText);
  // Attach affect to the last seeker entry if present
  if (response) {
    const lastSeekerIdx = conversation.findLastIndex(e => e.role === 'seeker');
    if (lastSeekerIdx !== -1) {
      conversation[lastSeekerIdx] = { ...conversation[lastSeekerIdx], affect };
    }
  }
  const qualities = Object.values(OCTAVE).map((node) => node.quality).filter(Boolean);
  const overrideValid = octave_override && qualities.includes(octave_override);
  const octaveNode = Object.values(OCTAVE).find((node) => node.quality === (overrideValid ? octave_override : quality.quality));
  if (overrideValid) {
    quality.quality = octave_override;
    quality.confidence = 'high';
    quality.is_shock = octaveNode?.shock || false;
  }

  const threshold = vagal.confidence === 'high' || (vagal.confidence === 'medium' && belief.confidence !== 'low');

  if (threshold || newTurn >= 3) {
    await updateSession(session_id, {
      stage: 'inquiry_complete',
      turn: newTurn,
      full_text: newText,
      conversation,
      vagal_probable: vagal.probable,
      vagal_confidence: vagal.confidence,
      belief_pattern: belief.pattern,
      belief_confidence: belief.confidence,
      quality: quality.quality,
      quality_confidence: quality.confidence,
      quality_is_shock: quality.is_shock,
      affect,
    });

    return res.json({
      session_id,
      stage: 'inquiry_complete',
      turn: newTurn,
      ready_for_prescription: true,
      quality_sense: quality.seeker_language || null,
      octave_prompt: octaveNode?.note
        ? `It sounds like you may be at ${octaveNode.note} — ${octaveNode.theme || octaveNode.quality}. Does that land?`
        : null,
      _meta: {
        vagal_probable: vagal.probable,
        vagal_confidence: vagal.confidence,
        limiting_belief: belief.pattern,
        belief_confidence: belief.confidence,
        quality: quality.quality,
        quality_is_shock: quality.is_shock,
        affect,
      },
    });
  }

  const clarifiers = [
    'Where do you feel that in your body right now?',
    'How long have you been carrying this?',
    "What would happen if you didn't do anything about it?",
    'Who else is in this with you, even invisibly?',
  ];
  const suggestion = clarifiers[newTurn - 1] || 'What else wants to be said?';

  const systemWithSuggestion = `${CLEA_SYSTEM_PROMPT}

--- Suggested direction (strong suggestion — take it, transform it, or release it entirely if the seeker's words demand something else):
"${suggestion}"`;

  const llmMessages = conversation
    .filter((e) => e.role === 'seeker' || e.role === 'priestess')
    .map((e) => ({
      role: e.role === 'seeker' ? 'user' : 'assistant',
      content: e.text,
    }));

  let nextQ = suggestion;
  try {
    const llm = makeLlmClient();
    nextQ = await llm.chat({ system: systemWithSuggestion, messages: llmMessages, temperature: 0.85, maxTokens: 256 });
    nextQ = nextQ.trim();
  } catch (e) {
    console.error('[clea] LLM error, falling back to clarifier:', e.message);
  }

  conversation.push({ role: 'priestess', text: nextQ, at: new Date().toISOString() });
  await updateSession(session_id, { turn: newTurn, full_text: newText, conversation });

  return res.json({
    session_id,
    stage: 'inquiry',
    turn: newTurn,
    question: nextQ,
    awaiting: 'response',
    _meta: { vagal_hint: vagal.probable, belief_hint: belief.pattern, quality_hint: quality.quality },
  });
});

// ─────────────────────────────────────────────
// STAGE 2: PRESCRIPTION
// POST /prescribe
// ─────────────────────────────────────────────
app.post('/prescribe', authenticate, async (req, res) => {
  const { session_id, divination_source } = req.body;

  const session = await getSession(session_id);
  if (!session) return res.status(404).json({ error: 'Session not found. Run /inquire first.' });
  if (session.stage !== 'inquiry_complete') {
    return res.status(400).json({ error: 'Inquiry not complete. Continue /inquire until ready_for_prescription is true.' });
  }

  const belief  = { pattern: session.belief_pattern, confidence: session.belief_confidence, meta: BELIEFS[session.belief_pattern] };
  const quality = { quality: session.quality, confidence: session.quality_confidence, is_shock: session.quality_is_shock };
  const prescription = buildPrescription(session.vagal_probable, belief, quality);
  const divination = drawDivinationSource(divination_source, quality.quality);
  const history = await getSeekerHistory(session.seeker_id, 1);
  const lastRite = history?.[0]?.rite_name || null;
  const needsVariant = lastRite && prescription.rite?.rite_name === lastRite;

  if (needsVariant) {
    const vagalOrder = ['dorsal', 'sympathetic', 'ventral', 'uncertain'];
    const altVagal = vagalOrder.find(v => v !== prescription.vagal_state && RITES[v]?.[quality.quality]);
    if (altVagal) prescription.rite = RITES[altVagal][quality.quality];
  }
  const ritePayload = divination ? { ...prescription.rite, divination } : prescription.rite;

  await updateSession(session_id, {
    stage: 'prescribed',
    rite_name: prescription.rite?.rite_name,
    rite_json: ritePayload,
    love_fear_audit: prescription.love_fear_audit,
    prescribed_at: new Date().toISOString(),
  });

  const resp = {
    session_id,
    stage: 'prescription',
    rite: ritePayload,
    divination,
    reintegration_window: '24–72h',
    _meta: {
      vagal_state: prescription.vagal_state,
      quality: prescription.quality,
      quality_is_shock: prescription.quality_is_shock,
      limiting_belief: prescription.limiting_belief,
      love_fear_audit: prescription.love_fear_audit,
    },
  };

  if (prescription.flagged) resp._warning = prescription.note;

  return res.json(resp);
});

// ─────────────────────────────────────────────
// STAGE 3: REINTEGRATION
// POST /reintegrate
// ─────────────────────────────────────────────
app.post('/reintegrate', authenticate, async (req, res) => {
  const { session_id, report } = req.body;

  const session = await getSession(session_id);
  if (!session) return res.status(404).json({ error: 'Session not found.' });

  await updateSession(session_id, {
    stage: 'complete',
    enacted: report?.enacted ?? null,
    resistance_level: report?.resistance_level ?? null,
    report,
    completed_at: new Date().toISOString(),
  });

  // Write anonymized record to corpus — no seeker_id
  await writeToCorpus({
    belief_pattern: session.belief_pattern,
    vagal_state: session.vagal_probable,
    quality: session.quality,
    quality_is_shock: session.quality_is_shock,
    rite_name: session.rite_name,
    enacted: report?.enacted,
    resistance_level: report?.resistance_level,
    belief_strength_before: report?.before?.belief_strength,
    belief_strength_after: report?.after?.belief_strength,
    unexpected: report?.unexpected,
  });

  const shifted = report?.before?.belief_strength != null && report?.after?.belief_strength != null
    ? report.before.belief_strength - report.after.belief_strength
    : null;

  const witness = report?.enacted
    ? 'You enacted the rite. Whatever arose — that was the rite working.'
    : 'You held the rite without enacting it. That resistance is itself information. What stopped you?';

  return res.json({
    session_id,
    stage: 'reintegration_complete',
    witness,
    what_shifted: shifted !== null
      ? `Belief strength: ${report.before.belief_strength} → ${report.after.belief_strength} (delta: ${shifted})`
      : 'No numeric shift reported — qualitative data captured.',
    unexpected_noted: report?.unexpected || null,
    next: 'The octave continues. What do you almost do next?',
  });
});

// ─────────────────────────────────────────────
// AUTH ROUTES
// ─────────────────────────────────────────────

app.post('/seeker/new', async (req, res) => {
  const { name, password, device_id, timezone } = req.body || {};

  if (!name || String(name).trim().length === 0) {
    return res.status(400).json({ error: 'name required.' });
  }
  if (!password || String(password).trim().length === 0) {
    return res.status(400).json({ error: 'password required.' });
  }

  // Retry loop guards against the race between generateHandle's SELECT
  // and the INSERT — the UNIQUE constraint catches concurrent collisions.
  const password_hash = await hashPassword(String(password));
  let seeker;
  for (let attempt = 0; attempt < 5; attempt++) {
    const handleResult = await generateHandle(String(name).trim());
    if (!handleResult) {
      return res.status(409).json({
        error: 'handle_exhausted',
        message: 'No unique handle available for this name. Try a different name.',
      });
    }
    try {
      seeker = await createSeeker({
        device_id: device_id ?? null,
        email_hash: null,
        timezone: timezone ?? null,
        consent_version: COVENANT.version,
        name: String(name).trim(),
        password_hash,
        handle: handleResult.handle,
        handle_base: handleResult.handle_base,
      });
      break; // success
    } catch (err) {
      if (err?.code === '23505' && attempt < 4) continue; // unique violation, retry
      throw err;
    }
  }

  const tokens = await issueTokenPair(seeker.id);
  return res.status(201).json({
    seeker_id: seeker.id,
    handle: seeker.handle,
    stage: deriveStage(seeker),
    ...tokens,
  });
});

// POST /seeker/:id/password — set password once
app.post('/seeker/:id/password', authenticate, async (req, res) => {
  if (req.seeker_id !== req.params.id) {
    return res.status(403).json({ error: 'Forbidden.' });
  }
  const { password } = req.body;
  if (!password || String(password).trim().length === 0) {
    return res.status(400).json({ error: 'password required.' });
  }
  const seeker = await getSeeker(req.params.id);
  if (!seeker) return res.status(404).json({ error: 'Seeker not found.' });
  if (seeker.password_hash) {
    return res.status(409).json({ error: 'Password already set.' });
  }
  const password_hash = await hashPassword(String(password));
  await updateSeekerPassword(req.params.id, password_hash);
  return res.json({ seeker_id: req.params.id, password_set: true });
});

// ─────────────────────────────────────────────
// ADMIN: API KEY MINTING
// ─────────────────────────────────────────────

app.post('/admin/api-keys', async (req, res) => {
  if (!ADMIN_KEY) return res.status(500).json({ error: 'OURACLE_ADMIN_KEY not configured.' });
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ') || header.slice(7) !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const { label, expires_at } = req.body || {};
  const plain = `ouracle_${randomUUID()}`;
  const key_hash = hashApiKey(plain);
  const record = await createApiKey({ key_hash, label, expires_at });

  return res.status(201).json({
    api_key: plain,
    ...record,
  });
});

app.patch('/admin/api-keys/:id', async (req, res) => {
  if (!ADMIN_KEY) return res.status(500).json({ error: 'OURACLE_ADMIN_KEY not configured.' });
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ') || header.slice(7) !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const { active, expires_at, label } = req.body || {};
  if (active === undefined && !expires_at && !label) {
    return res.status(400).json({ error: 'No updates provided.' });
  }

  const record = await updateApiKey(req.params.id, { active, expires_at, label });
  if (!record) return res.status(404).json({ error: 'API key not found.' });
  return res.json(record);
});

// POST /auth/token — issue tokens for an existing seeker (re-auth)
app.post('/auth/token', async (req, res) => {
  const { seeker_id, handle, password } = req.body;

  if (!password || String(password).trim().length === 0) {
    return res.status(400).json({ error: 'password required.' });
  }

  let seeker;
  if (handle) {
    seeker = await getSeekerByHandle(String(handle).trim());
    if (!seeker) return res.status(404).json({ error: 'Seeker not found.' });
  } else if (seeker_id) {
    seeker = await getSeeker(seeker_id);
    if (!seeker) return res.status(404).json({ error: 'Seeker not found.' });
  } else {
    return res.status(400).json({ error: 'handle or seeker_id required.' });
  }

  if (!seeker.password_hash) {
    return res.status(401).json({ error: 'No password set on this account.' });
  }
  const ok = await verifyPassword(String(password), seeker.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials.' });

  const tokens = await issueTokenPair(seeker.id);
  return res.json({
    seeker_id: seeker.id,
    stage: deriveStage(seeker),
    ...tokens,
  });
});

// POST /auth/refresh — rotate token pair
app.post('/auth/refresh', async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ error: 'refresh_token required.' });
  try {
    const result = await rotateRefreshToken(refresh_token);
    const seeker = await getSeeker(result.seeker_id);
    return res.json({
      seeker_id: result.seeker_id,
      stage: deriveStage(seeker),
      access_token: result.access_token,
      refresh_token: result.refresh_token,
      expires_in: result.expires_in,
    });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired refresh token.' });
  }
});

// POST /covenant — accept the current covenant. Auth required.
app.post('/covenant', authenticate, async (req, res) => {
  const seeker = await recordCovenant(req.seeker_id, String(COVENANT.version));
  if (!seeker) return res.status(404).json({ error: 'Seeker not found.' });
  return res.json({
    seeker_id: seeker.id,
    covenant_at: seeker.covenant_at,
    stage: deriveStage(seeker),
  });
});

app.post('/seeker/:id/covenant', authenticate, async (req, res) => {
  const { covenant_version = '1.0' } = req.body;
  const seeker = await recordCovenant(req.params.id, covenant_version);
  if (!seeker) return res.status(404).json({ error: 'Seeker not found.' });
  return res.json({ seeker_id: seeker.id, covenant_at: seeker.covenant_at });
});

app.get('/seeker/:id/history', authenticate, async (req, res) => {
  if (req.seeker_id !== req.params.id) {
    return res.status(403).json({ error: 'Forbidden.' });
  }
  const history = await getSeekerHistory(req.params.id);
  return res.json({ seeker_id: req.params.id, history });
});

app.get('/seeker/:id/thread', authenticate, async (req, res) => {
  if (req.seeker_id !== req.params.id) {
    return res.status(403).json({ error: 'Forbidden.' });
  }
  const thread = await getSeekerThread(req.params.id);
  return res.json({ seeker_id: req.params.id, thread });
});

app.delete('/seeker/:id', authenticate, async (req, res) => {
  if (req.seeker_id !== req.params.id) {
    return res.status(403).json({ error: 'Forbidden.' });
  }
  const deleted = await deleteSeeker(req.params.id);
  if (!deleted) return res.status(404).json({ error: 'Seeker not found.' });
  return res.json({ deleted: true, seeker_id: req.params.id });
});

app.patch('/seeker/:id/thread/:session_id/redact', authenticate, async (req, res) => {
  if (req.seeker_id !== req.params.id) {
    return res.status(403).json({ error: 'Forbidden.' });
  }
  const redacted = await redactSession(req.params.id, req.params.session_id);
  if (!redacted) return res.status(404).json({ error: 'Session not found.' });
  return res.json({ redacted: true, session_id: req.params.session_id });
});

// ─────────────────────────────────────────────
// HEALTH
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// DIRECT DOMAIN ENDPOINTS — wildcard, must be last
// POST /:domain/:verb
// ─────────────────────────────────────────────
app.post('/:domain/:verb', (req, res, next) => {
  if (req.params.domain === 'totem') return next('route');
  next();
}, authenticate, async (req, res) => {
  const { domain, verb } = req.params;
  const { seeker_id, instruction, duration } = req.body;

  if (!ALL_DOMAINS.includes(domain)) {
    return res.status(404).json({ error: `Unknown domain: ${domain}. Known: ${ALL_DOMAINS.join(', ')}` });
  }

  const knownVerbs = DOMAIN_VERBS[domain];
  if (!knownVerbs.includes(verb)) {
    return res.status(418).json({
      code: 418,
      error: `Wrong domain for ${verb}.`,
      hint: `Known ${domain} verbs: ${knownVerbs.join(', ')}`,
    });
  }

  if (!seeker_id) {
    return res.status(400).json({ error: 'seeker_id required.', hint: 'POST /seeker/new to create a seeker.' });
  }

  const seeker = await getSeeker(seeker_id);
  if (!seeker) return res.status(404).json({ error: 'Seeker not found.' });

  const prereqs = await checkPrerequisites(seeker_id, domain);
  if (!prereqs.ok) {
    return res.status(409).json({
      code: 409,
      error: 'Prerequisite embodiment not met.',
      missing: prereqs.missing,
      hint: `Try POST /${prereqs.missing[0]}/stand first.`,
    });
  }

  const { rite, pattern } = directRite(domain, verb);
  await logEnactment(seeker_id, null, domain, verb);

  return res.json({
    seeker_id,
    endpoint: `/${domain}/${verb}`,
    rite: { ...rite, context: instruction || 'When you are ready. Alone if possible.', duration: duration || '5–15 minutes' },
    _meta: { domain, verb, belief_pattern: pattern },
    reintegration_window: '24–72h',
  });
});

// ─────────────────────────────────────────────
// ENQUIRE — unified SSE streaming endpoint for RIPL
// POST /enquire
// ─────────────────────────────────────────────

// ── Sentence-aware TTS streaming with pre-fetch ─────────────────────────────
class SentenceAudioStreamer {
  constructor(res, options = {}) {
    this.res = res;
    this.muted = options.muted || false;
    this.voice = options.voice;
    this.sentenceIdx = 0; // sequence number for sentences
    this.audioPromises = new Map(); // seq -> Promise
    this.readyAudio = new Map(); // seq -> base64 | null (null = failed)
    this.nextAudioEmitIdx = 0; // next audio sequence to emit
    this.preFetchLimit = 2; // pre-fetch up to 2 sentences ahead
    this.buffer = ''; // accumulated tokens for current incomplete sentence
    // Stage-direction stripping: Clea prepends [emotional cue] to every response.
    // We strip it before emitting tokens to the client so it never appears in the UI.
    this.stageDone = false;  // true once we've resolved the leading bracket
    this.stageBuffer = '';   // accumulates tokens before we know if a bracket is present
  }

  emit(obj) {
    sendSSE(this.res, obj);
  }

  // Emit a complete sentence text event (immediate)
  emitSentenceText(text, isFinal = false) {
    const seq = this.sentenceIdx++;
    this.emit({ type: 'sentence_text', text, sequence: seq, isFinal });
    if (!this.muted) {
      this.startAudioFetch(seq, text);
    }
  }

  startAudioFetch(seq, sentence, delayMs = 0) {
    if (this.audioPromises.has(seq)) return;
    // Cache check
    const cached = audioCache.get(sentence);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
      this.readyAudio.set(seq, cached.base64);
      this.tryEmitAudio();
      return;
    }
    const RETRY_DELAYS = [800, 2000]; // ms between attempts (3 attempts total)
    const doFetch = async () => {
      if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
      let lastErr;
      for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
        try {
          return await fetchAudio(sentence, this.voice);
        } catch (err) {
          lastErr = err;
          if (attempt < RETRY_DELAYS.length) {
            console.warn(`[TTS] attempt ${attempt + 1} failed, retrying in ${RETRY_DELAYS[attempt]}ms:`, err.message);
            await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
          }
        }
      }
      throw lastErr;
    };
    const p = doFetch().then(buf => {
      const base64 = buf.toString('base64');
      audioCache.set(sentence, { base64, timestamp: Date.now() });
      this.readyAudio.set(seq, base64);
      this.tryEmitAudio();
    }).catch(err => {
      console.error('[TTS] sentence fetch failed after retries:', err.message);
      this.readyAudio.set(seq, null);
      this.tryEmitAudio();
    });
    this.audioPromises.set(seq, p);
  }

  tryEmitAudio() {
    while (this.readyAudio.has(this.nextAudioEmitIdx)) {
      const data = this.readyAudio.get(this.nextAudioEmitIdx);
      if (data !== null) {
        this.emit({ type: 'sentence_audio', sequence: this.nextAudioEmitIdx, audio: data });
      } else {
        this.emit({ type: 'sentence_audio_missing', sequence: this.nextAudioEmitIdx });
      }
      this.nextAudioEmitIdx++;
    }
  }

  async waitForRemainingAudio(timeout = 10000) {
    const deadline = Date.now() + timeout;
    while (this.nextAudioEmitIdx < this.sentenceIdx) {
      if (Date.now() > deadline) break;
      if (this.readyAudio.has(this.nextAudioEmitIdx)) {
        const data = this.readyAudio.get(this.nextAudioEmitIdx);
        if (data !== null) {
          this.emit({ type: 'sentence_audio', sequence: this.nextAudioEmitIdx, audio: data });
        } else {
          this.emit({ type: 'sentence_audio_missing', sequence: this.nextAudioEmitIdx });
        }
        this.nextAudioEmitIdx++;
      } else {
        await new Promise(r => setTimeout(r, 50));
      }
    }
  }

  // For static text (fully known upfront)
  async processFullText(fullText) {
    // Strip leading stage direction [emotional cue] if present
    const stripped = fullText.replace(/^\s*\[[^\]]*\]\s*/, '');
    const sentences = splitSentences(stripped).map(s => s.raw.trim()).filter(s => s.length > 0);
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      this.emitSentenceText(sentence, i === sentences.length - 1);
      // Pre-fetch next sentences ahead, staggered to avoid rate-limiting Fish.audio
      if (!this.muted) {
        for (let j = i + 1; j <= Math.min(i + this.preFetchLimit, sentences.length - 1); j++) {
          const futureIdx = j;
          const futureSentence = sentences[j];
          const staggerMs = (j - i) * 400; // 400ms per step ahead
          if (!this.audioPromises.has(futureIdx)) {
            this.startAudioFetch(futureIdx, futureSentence, staggerMs);
          }
        }
      }
    }
  }

  // For incremental LLM token stream
  feedToken(token) {
    if (!this.stageDone) {
      this.stageBuffer += token;
      const trimmed = this.stageBuffer.trimStart();
      if (!trimmed) return; // only whitespace so far — keep buffering
      if (trimmed[0] !== '[') {
        // No stage direction — flush buffer as-is and proceed
        this.stageDone = true;
        this._feedRaw(this.stageBuffer);
        this.stageBuffer = '';
        return;
      }
      const close = this.stageBuffer.indexOf(']');
      if (close === -1) return; // still inside bracket — keep buffering
      // Closing bracket found — discard tag, emit whatever follows
      this.stageDone = true;
      const rest = this.stageBuffer.slice(close + 1).replace(/^\s+/, '');
      this.stageBuffer = '';
      if (rest) this._feedRaw(rest);
      return;
    }
    this._feedRaw(token);
  }

  _feedRaw(token) {
    this.emit({ type: 'token', text: token }); // client renders tokens in real-time
    this.buffer += token;
    const sentences = splitSentences(this.buffer);
    if (sentences.length > 1) {
      const completed = sentences.slice(0, -1).map(s => s.raw.trim()).filter(s => s.length > 0);
      this.buffer = sentences[sentences.length - 1].raw;
      for (const sentence of completed) {
        this.emitSentenceText(sentence, false);
      }
    }
  }

  finish() {
    if (this.buffer.trim()) {
      const sentence = this.buffer.trim();
      this.buffer = '';
      this.emitSentenceText(sentence, true);
    }
  }
}

// ── Stream text word-by-word with ~25ms spacing (legacy, kept for reference) ─
async function streamText(emit, text) {
  const chunks = text.split(/(\\s+)/);
  for (const chunk of chunks) {
    if (chunk) {
      emit({ type: 'token', text: chunk });
      await new Promise((r) => setTimeout(r, 22));
    }
  }
}

app.post('/enquire', authenticateOrGuest, async (req, res) => {
  const { session_id, message, mode } = req.body || {};
  const seeker_id = req.seeker_id;
  console.log(`[enquire] seeker=${seeker_id ?? 'guest'} session=${session_id ?? 'new'} mode=${mode ?? 'default'} message=${message ? 'yes' : 'no'}`);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const emit = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  let streamer = null;
  const finish = async (stage, extra = {}) => {
    if (streamer) {
      try {
        await Promise.race([
          streamer.waitForRemainingAudio(),
          new Promise(resolve => setTimeout(resolve, 3000))
        ]);
      } catch (e) {
        // ignore
      }
    }
    emit({ type: 'complete', stage, ...extra });
    res.end();
  };
  const fail = (message) => {
    emit({ type: 'error', message });
    res.end();
  };

  // Initialize sentence streamer with mute/voice preferences
  streamer = new SentenceAudioStreamer(res, {
    muted: req.body.muted || false,
    voice: req.body.voice
  });

  // ── Guest path ──────────────────────────────────────────
  if (req.is_guest) {
    const GUEST_TURN_LIMIT = 3;
    const guest = await getGuestSession(req.guest_session_id);
    if (!guest) return fail('Guest session not found.');
    if (guest.turns_used >= GUEST_TURN_LIMIT) return fail('guest_limit');

    if (!message) {
      // First load: Clea's opening line for new visitors
      await streamer.processFullText('Speak. What brings you to the threshold?');
      return finish('guest');
    }

    const llm = makeLlmClient();
    const stream = await llm.chat({
      system: CLEA_SYSTEM_PROMPT,
      // Include the opening greeting so Clea knows the conversation has already started
      // and doesn't re-introduce herself on the seeker's first reply.
      messages: [
        { role: 'assistant', content: 'Speak. What brings you to the threshold?' },
        { role: 'user', content: message },
      ],
      temperature: 0.9,
      maxTokens: 512,
      stream: true,
    });

    try {
      for await (const chunk of stream) {
        const text = chunk.choices?.[0]?.delta?.content;
        if (text) streamer.feedToken(text);
      }
    } catch (streamErr) {
      console.error('/enquire guest stream error:', streamErr);
    } finally {
      streamer.finish();
      await incrementGuestTurn(req.guest_session_id).catch((e) =>
        console.error('[guest] incrementGuestTurn failed:', e.message)
      );
    }

    return finish('guest');
  }

  try {
    const seeker = await getSeeker(seeker_id);
    if (!seeker) return fail('Seeker not found.');

    const inferSessionState = async (session, incomingMessage, conversation, currentSessionId, contextLabel) => {
      // Weight the latest turn twice so current language can move the live seeker reading.
      const nextFullText = `${session.full_text || ''} ${incomingMessage} ${incomingMessage}`.trim();
      const { vagal, belief, quality, affect } = await infer(nextFullText);
      const lastSeekerIdx = conversation.findLastIndex(e => e.role === 'seeker');
      if (lastSeekerIdx !== -1) {
        conversation[lastSeekerIdx] = { ...conversation[lastSeekerIdx], affect };
      }
      emit({ type: 'vagal', probable: vagal.probable, confidence: vagal.confidence, reasoning: vagal.reasoning });
      emit({ type: 'belief', pattern: belief.pattern, confidence: belief.confidence, reasoning: belief.reasoning });
      emit({ type: 'quality', quality: quality.quality, confidence: quality.confidence, is_shock: quality.is_shock, reasoning: quality.reasoning });
      emit({ type: 'affect', valence: affect.valence, arousal: affect.arousal, gloss: affect.gloss, confidence: affect.confidence });
      console.log(`[enquire/${contextLabel}] session=${currentSessionId} vagal=${vagal.probable ?? 'null'}/${vagal.confidence ?? 'null'} belief=${belief.pattern ?? 'null'}/${belief.confidence ?? 'null'} quality=${quality.quality ?? 'null'}/${quality.confidence ?? 'null'} affect=${affect.gloss ?? 'null'}`);
      return { nextFullText, vagal, belief, quality, affect, conversation };
    };

    const handleInquiryTurn = async (session, incomingMessage, currentSessionId) => {
      if (!incomingMessage) return fail('message required during inquiry.');

      const newText = `${session.full_text || ''} ${incomingMessage}`.trim();
      const newTurn = (session.turn || 0) + 1;
      const conversation = Array.isArray(session.conversation) ? [...session.conversation] : [];
      conversation.push({ role: 'seeker', text: incomingMessage, at: new Date().toISOString() });

      const { vagal, belief, quality, affect } = await infer(newText);
      const lastSeekerIdx = conversation.findLastIndex(e => e.role === 'seeker');
      if (lastSeekerIdx !== -1) {
        conversation[lastSeekerIdx] = { ...conversation[lastSeekerIdx], affect };
      }
      emit({ type: 'vagal', probable: vagal.probable, confidence: vagal.confidence, reasoning: vagal.reasoning });
      emit({ type: 'belief', pattern: belief.pattern, confidence: belief.confidence, reasoning: belief.reasoning });
      emit({ type: 'quality', quality: quality.quality, confidence: quality.confidence, is_shock: quality.is_shock, reasoning: quality.reasoning });
      emit({ type: 'affect', valence: affect.valence, arousal: affect.arousal, gloss: affect.gloss, confidence: affect.confidence });

      const threshold = vagal.confidence === 'high' || (vagal.confidence === 'medium' && belief.confidence !== 'low');
      console.log(`[enquire/inquiry] session=${currentSessionId} turn=${newTurn} threshold=${threshold} vagal=${vagal.probable ?? 'null'}/${vagal.confidence ?? 'null'} belief=${belief.pattern ?? 'null'}/${belief.confidence ?? 'null'} quality=${quality.quality ?? 'null'}/${quality.confidence ?? 'null'} affect=${affect.gloss ?? 'null'}`);

      if (threshold || newTurn >= 3) {
        await updateSession(currentSessionId, {
          stage: 'offering',
          turn: newTurn,
          full_text: newText,
          conversation,
          vagal_probable: vagal.probable,
          vagal_confidence: vagal.confidence,
          belief_pattern: belief.pattern,
          belief_confidence: belief.confidence,
          quality: quality.quality,
          quality_confidence: quality.confidence,
          quality_is_shock: quality.is_shock,
          affect,
        });

        const offeringSystem = `${CLEA_SYSTEM_PROMPT}

--- Something has been heard. There is a practice — a rite — that wants to meet this moment.
Offer it. Not as prescription, not as diagnosis. As an invitation. Ask if the seeker is open to receiving it.
Brief — one or two sentences. Let it breathe. Do not describe the rite yet.`;

        const offeringMsgs = conversation
          .filter((e) => e.role === 'seeker' || e.role === 'priestess')
          .map((e) => ({ role: e.role === 'seeker' ? 'user' : 'assistant', content: e.text }));

        let offeringQ = 'Something is taking shape here. Are you open to a practice that might meet it?';
        try {
          const llm = makeLlmClient();
          offeringQ = await llm.chat({ system: offeringSystem, messages: offeringMsgs, temperature: 0.9, maxTokens: 150 });
          offeringQ = offeringQ.trim();
        } catch (e) {
          console.error('[clea] offering generation error:', e.message);
        }

        conversation.push({ role: 'priestess', text: offeringQ, at: new Date().toISOString() });
        await updateSession(currentSessionId, { conversation });
        await streamer.processFullText(offeringQ);
        return finish('offering', { session_id: currentSessionId });
      }

      const clarifiers = [
        'Where do you feel that in your body right now?',
        'How long have you been carrying this?',
        "What would happen if you didn't do anything about it?",
        'Who else is in this with you, even invisibly?',
      ];
      const suggestion = clarifiers[newTurn - 1] || 'What else wants to be said?';

      const systemWithSuggestion = `${CLEA_SYSTEM_PROMPT}

--- Suggested direction (strong suggestion — take it, transform it, or release it entirely if the seeker's words demand something else):
"${suggestion}"

--- Divination draw signal
If this moment calls for a card — a fork the seeker can't reason through, a symbol that needs to surface, a question only the oracle can ask — append [DRAW] as the very last thing you write. If a specific deck feels right (tarot, iching, osho_zen, runes, etc.), use [DRAW:deck_id] instead. Use this sparingly. Most responses will not include it.`;

      const llmMessages = conversation
        .filter((e) => e.role === 'seeker' || e.role === 'priestess')
        .map((e) => ({ role: e.role === 'seeker' ? 'user' : 'assistant', content: e.text }));

      let nextQ = suggestion;
      let drawSignal = false;
      let drawDeck = null;
      try {
        const llm = makeLlmClient();
        nextQ = await llm.chat({ system: systemWithSuggestion, messages: llmMessages, temperature: 0.85, maxTokens: 300 });
        nextQ = nextQ.trim();
        const drawMatch = nextQ.match(/\s*\[DRAW(?::([^\]]+))?\]\s*$/i);
        if (drawMatch) {
          drawSignal = true;
          drawDeck = drawMatch[1]?.trim().toLowerCase() || null;
          nextQ = nextQ.replace(/\s*\[DRAW(?::[^\]]+)?\]\s*$/i, '').trim();
        }
      } catch (e) {
        console.error('[clea] LLM error, falling back to clarifier:', e.message);
      }

      conversation.push({ role: 'priestess', text: nextQ, at: new Date().toISOString() });
      await updateSession(currentSessionId, { turn: newTurn, full_text: newText, conversation });

      await streamer.processFullText(nextQ);

      if (drawSignal) {
        try {
          const allDecks = await loadDecks();
          const validDeckId = drawDeck && allDecks.some(d => d.id === drawDeck) ? drawDeck : null;
          const cards = await drawContextual(newText, 1, validDeckId ? [validDeckId] : null);
          if (cards.length > 0) {
            const card = cards[0];
            const deckMeta = allDecks.find(d => d.id === card.deck);
            emit({ type: 'draw', card: {
              id: card.id,
              deck: card.deck,
              deckLabel: deckMeta?.meta?.name ?? card.deck,
              title: card.title,
              keywords: card.keywords ?? [],
              body: card.body ?? '',
              fields: card.fields ?? {},
              imageUrl: cardImagePath(card),
            }});
          }
        } catch (e) {
          console.error('[clea] draw signal card fetch failed:', e.message);
        }
      }

      return finish('inquiry', { session_id: currentSessionId, turn: newTurn });
    };

    // ── New session ──────────────────────────────
    if (!session_id) {
      // Covenant is NOT auto-recorded — seeker enters it via the modal
      // after Clea introduces it conversationally.

      const sessionCount = await getSeekerSessionCount(seeker_id);
      const lastSession = await getSeekerLatestSession(seeker_id);

      // ── Reintegration: seeker returning to report on an accepted rite ────────
      // If the most recent session was prescribed but never completed, resume it
      // instead of running a fresh inquiry that would re-prescribe the same rite.
      if (lastSession?.stage === 'prescribed' && !lastSession?.completed_at) {
        const resumedId = lastSession.id;
        console.log(`[enquire/new] resuming prescribed session=${resumedId} seeker=${seeker_id}`);
        emit({ type: 'session', session_id: resumedId, stage: 'prescribed', needs_covenant: !seeker.covenant_at });
        const riteAct = lastSession.rite_json?.act;
        const riteName = lastSession.rite_name;
        const opening = riteAct
          ? `You were going to ${riteAct.replace(/\.$/, '')}. How did it go?`
          : riteName
            ? `You were working with "${riteName}". How did it go?`
            : `You've returned. How did the rite go?`;
        const nowIso = new Date().toISOString();
        const conversation = Array.isArray(lastSession.conversation) ? [...lastSession.conversation] : [];
        conversation.push({ role: 'priestess', text: opening, at: nowIso });
        await updateSession(resumedId, { conversation });
        await streamer.processFullText(opening);
        return finish('prescribed', { session_id: resumedId });
      }

      const lastQuestion = Array.isArray(lastSession?.conversation)
        ? lastSession.conversation.find((e) => e?.role === 'priestess')?.text
        : null;
      const lastAt = lastSession?.completed_at || lastSession?.created_at;
      const daysSinceLast = lastAt
        ? Math.floor((Date.now() - new Date(lastAt).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      const covenantPayload = {
        version: COVENANT.version,
        accepted: true,
        timestamp: new Date().toISOString(),
      };
      const session = await createSession(seeker_id, covenantPayload);
      console.log(`[enquire/new] session=${session.id} seeker=${seeker_id} covenanted=${seeker.covenant_at ? 'yes' : 'no'} carriedMessage=${message ? 'yes' : 'no'}`);
      emit({ type: 'session', session_id: session.id, stage: 'inquiry', needs_covenant: !seeker.covenant_at });

      if (message) {
        await updateSession(session.id, { stage: 'inquiry', turn: 0, conversation: [] });
        if (!seeker.covenant_at) {
          await streamer.processFullText(COVENANT_REMINDER);
          return finish('inquiry', { session_id: session.id });
        }
        return handleInquiryTurn({ ...session, stage: 'inquiry', turn: 0, conversation: [], full_text: '' }, message, session.id);
      }

      const question = chooseOpeningQuestion({
        session_count: sessionCount,
        last_question: lastQuestion,
        last_quality: lastSession?.quality ?? null,
        last_rite_name: lastSession?.rite_name ?? null,
        days_since_last: daysSinceLast,
      });
      const nowIso = new Date().toISOString();
      const lastAct = lastSession?.rite_json?.act;
      const returningGreeting = lastAct
        ? `Welcome back. You were going to ${lastAct.replace(/\.$/, '')}.`
        : lastSession?.rite_name
          ? `Welcome back. You were working with ${lastSession.rite_name}.`
          : null;
      const greeting = daysSinceLast !== null && daysSinceLast >= 90
        ? "Three months. What's been happening?"
        : returningGreeting;

      const conversation = [
        ...(greeting ? [{ role: 'priestess', text: greeting, at: nowIso }] : []),
        { role: 'priestess', text: question, at: nowIso },
      ];
      await updateSession(session.id, { stage: 'inquiry', turn: 0, conversation });

      if (greeting) {
        await streamer.processFullText(greeting);
        emit({ type: 'break' });
      }
      await streamer.processFullText(question);
      if (!seeker.covenant_at) {
        emit({ type: 'break' });
        await streamer.processFullText(COVENANT_REMINDER);
      }
      return finish('inquiry', { session_id: session.id });
    }

    // ── Continue existing session ─────────────────
    const session = await getSession(session_id);
    if (!session) return fail('Session not found.');
    console.log(`[enquire/continue] session=${session_id} stage=${session.stage} turn=${session.turn ?? 0}`);

    // ── Card interpretation — bypass OCTAVE, respond as Clea directly ────────
    if (mode === 'interpret' && message) {
      const conversation = Array.isArray(session.conversation) ? [...session.conversation] : [];
      const llmMessages = conversation
        .filter((e) => e.role === 'seeker' || e.role === 'priestess')
        .map((e) => ({ role: e.role === 'seeker' ? 'user' : 'assistant', content: e.text }));
      llmMessages.push({ role: 'user', content: message });
      const llm = makeLlmClient();
      const stream = await llm.chat({
        system: `${CLEA_SYSTEM_PROMPT}\n\n--- The seeker has drawn a divination card and is asking for your interpretation. Respond as Clea — do not prescribe a rite, do not run an assessment. Simply receive the card and the seeker together, and speak.`,
        messages: llmMessages,
        temperature: 0.9,
        maxTokens: 512,
        stream: true,
      });
      try {
        for await (const chunk of stream) {
          const token = chunk.choices?.[0]?.delta?.content;
          if (token) streamer.feedToken(token);
        }
      } finally {
        streamer.finish();
      }
      return finish(session.stage, { session_id });
    }

    const stage = session.stage;

    if (stage === 'inquiry') {
      return handleInquiryTurn(session, message, session_id);
    }

    if (stage === 'offering') {
      if (!message) return fail('message required during offering.');

      const conversation = Array.isArray(session.conversation) ? [...session.conversation] : [];
      conversation.push({ role: 'seeker', text: message, at: new Date().toISOString() });
      const offeringState = await inferSessionState(session, message, conversation, session_id, 'offering-state');
      await updateSession(session_id, {
        full_text: offeringState.nextFullText,
        conversation,
        vagal_probable: offeringState.vagal.probable,
        vagal_confidence: offeringState.vagal.confidence,
        belief_pattern: offeringState.belief.pattern,
        belief_confidence: offeringState.belief.confidence,
        quality: offeringState.quality.quality,
        quality_confidence: offeringState.quality.confidence,
        quality_is_shock: offeringState.quality.is_shock,
      });

      const offeringSystem = `${CLEA_SYSTEM_PROMPT}

--- You have offered the seeker a rite. Now you are in conversation about whether they are ready to receive it.
If the seeker is clearly ready and willing — consenting, open, present — end your response with [READY] on its own at the very end.
If they are uncertain, resistant, or still processing, meet them there. Do not push. Do not rush.
Most responses will NOT include [READY].`;

      const llmMessages = conversation
        .filter((e) => e.role === 'seeker' || e.role === 'priestess')
        .map((e) => ({ role: e.role === 'seeker' ? 'user' : 'assistant', content: e.text }));

      const llm = makeLlmClient();
      const chunks = [];
      try {
        const stream = await llm.chat({ system: offeringSystem, messages: llmMessages, temperature: 0.9, maxTokens: 400, stream: true });
        for await (const chunk of stream) {
          const text = chunk.choices?.[0]?.delta?.content;
          if (text) {
            chunks.push(text);
            streamer.feedToken(text);
          }
        }
      } catch (e) {
        console.error('[clea] offering LLM error:', e.message);
      }
      streamer.finish();

      let response = chunks.join('').trim().replace(/^\[[^\]]*\]\s*/, '');
      const readySignal = /\s*\[READY\]\s*$/i.test(response) || READY_MESSAGE_RE.test(message);
      if (readySignal) response = response.replace(/\s*\[READY\]\s*$/i, '').trim();

      conversation.push({ role: 'priestess', text: response, at: new Date().toISOString() });

      if (readySignal) {
        const belief = {
          pattern: offeringState.belief.pattern,
          confidence: offeringState.belief.confidence,
          meta: BELIEFS[offeringState.belief.pattern]
        };
        const quality = {
          quality: offeringState.quality.quality,
          confidence: offeringState.quality.confidence,
          is_shock: offeringState.quality.is_shock,
          seeker_language: offeringState.quality.seeker_language
        };
        const prescription = buildPrescription(offeringState.vagal.probable, belief, quality);
        console.log(`[enquire/offering] session=${session_id} ready=yes rite=${prescription.rite?.rite_name ?? 'none'}`);
        const divination = drawDivinationSource(null, quality.quality);
        const history = await getSeekerHistory(seeker_id, 1);
        const lastRite = history?.[0]?.rite_name || null;
        if (lastRite && prescription.rite?.rite_name === lastRite) {
          const altVagal = ['dorsal', 'sympathetic', 'ventral', 'uncertain'].find(v => v !== prescription.vagal_state && RITES[v]?.[quality.quality]);
          if (altVagal) prescription.rite = RITES[altVagal][quality.quality];
        }
        // TODO: rite-deck-pairing — see docs/rite-deck-pairing.md
        const ritePayload = divination ? { ...prescription.rite, divination } : prescription.rite;
        await updateSession(session_id, {
          stage: 'prescribed',
          full_text: offeringState.nextFullText,
          conversation,
          vagal_probable: offeringState.vagal.probable,
          vagal_confidence: offeringState.vagal.confidence,
          belief_pattern: offeringState.belief.pattern,
          belief_confidence: offeringState.belief.confidence,
          quality: offeringState.quality.quality,
          quality_confidence: offeringState.quality.confidence,
          quality_is_shock: offeringState.quality.is_shock,
          rite_name: prescription.rite?.rite_name,
          rite_json: ritePayload,
          love_fear_audit: prescription.love_fear_audit,
          prescribed_at: new Date().toISOString(),
        });
        emit({ type: 'break' });
        // Emit structured rite event — frontend renders in OraclePanel, not chat stream
        emit({ type: 'rite', rite: ritePayload });
        emit({ type: 'break' });
        await streamer.processFullText(RITE_FEEDBACK_PROMPT);
        conversation.push({ role: 'priestess', text: RITE_FEEDBACK_PROMPT, at: new Date().toISOString() });
        await updateSession(session_id, { conversation });
        return finish('prescribed', { session_id, rite_name: prescription.rite?.rite_name });
      }

      await updateSession(session_id, { full_text: offeringState.nextFullText, conversation });
      console.log(`[enquire/offering] session=${session_id} ready=no`);
      return finish('offering', { session_id });
    }

    if (stage === 'prescribed') {
      if (!message) return fail('message required.');

      const conversation = Array.isArray(session.conversation) ? [...session.conversation] : [];
      conversation.push({ role: 'seeker', text: message, at: new Date().toISOString() });
      const prescribedState = await inferSessionState(session, message, conversation, session_id, 'prescribed-state');
      await updateSession(session_id, {
        full_text: prescribedState.nextFullText,
        conversation,
        vagal_probable: prescribedState.vagal.probable,
        vagal_confidence: prescribedState.vagal.confidence,
        belief_pattern: prescribedState.belief.pattern,
        belief_confidence: prescribedState.belief.confidence,
        quality: prescribedState.quality.quality,
        quality_confidence: prescribedState.quality.confidence,
        quality_is_shock: prescribedState.quality.is_shock,
      });

      const riteContext = session.rite_json
        ? `The rite prescribed: "${session.rite_json.rite_name}" — ${session.rite_json.act}`
        : '';
      const prescribedSystem = `${CLEA_SYSTEM_PROMPT}

--- ${riteContext}
The seeker has been given a rite. They may be asking about it, sitting with it, or reporting back on what happened.
If the seeker is clearly reporting — describing the experience of doing (or not doing) the rite — end your response with [REPORT] on its own at the very end.
If they are still processing, questioning, or not yet reporting, simply respond as Clea.
Most responses will NOT include [REPORT].`;

      const llmMessages = conversation
        .filter((e) => e.role === 'seeker' || e.role === 'priestess')
        .map((e) => ({ role: e.role === 'seeker' ? 'user' : 'assistant', content: e.text }));

      const llm = makeLlmClient();
      const chunks = [];
      try {
        const stream = await llm.chat({ system: prescribedSystem, messages: llmMessages, temperature: 0.9, maxTokens: 400, stream: true });
        for await (const chunk of stream) {
          const text = chunk.choices?.[0]?.delta?.content;
          if (text) {
            chunks.push(text);
            streamer.feedToken(text);
          }
        }
      } catch (e) {
        console.error('[clea] prescribed LLM error:', e.message);
      }
      streamer.finish();

      let response = chunks.join('').trim().replace(/^\[[^\]]*\]\s*/, '');
      const reportSignal = /\s*\[REPORT\]\s*$/i.test(response) || REPORT_MESSAGE_RE.test(message);
      if (reportSignal) response = response.replace(/\s*\[REPORT\]\s*$/i, '').trim();

      conversation.push({ role: 'priestess', text: response, at: new Date().toISOString() });

      if (reportSignal) {
        const enacted = !!message;
        const confirmation = session.rite_name
          ? `I hear that in your meeting with ${session.rite_name}: ${message}`
          : `I hear this record of your experience: ${message}`;
        const openingQuestion = Array.isArray(session.conversation)
          ? session.conversation.find((e) => e?.role === 'priestess')?.text
          : null;
        const closing = openingQuestion ? getClosingDedication(openingQuestion) : null;
        const completedConversation = [
          ...conversation,
          { role: 'priestess', text: confirmation, at: new Date().toISOString() },
          ...(closing ? [{ role: 'priestess', text: closing, at: new Date().toISOString() }] : []),
          { role: 'priestess', text: RITE_FEEDBACK_FOLLOWUP, at: new Date().toISOString() },
        ];
        await updateSession(session_id, {
          stage: 'complete',
          full_text: prescribedState.nextFullText,
          conversation: completedConversation,
          vagal_probable: prescribedState.vagal.probable,
          vagal_confidence: prescribedState.vagal.confidence,
          belief_pattern: prescribedState.belief.pattern,
          belief_confidence: prescribedState.belief.confidence,
          quality: prescribedState.quality.quality,
          quality_confidence: prescribedState.quality.confidence,
          quality_is_shock: prescribedState.quality.is_shock,
          enacted,
          report: { enacted, notes: message },
          completed_at: new Date().toISOString(),
        });
        await writeToCorpus({
          belief_pattern: session.belief_pattern,
          vagal_state: session.vagal_probable,
          quality: session.quality,
          quality_is_shock: session.quality_is_shock,
          rite_name: session.rite_name,
          enacted,
        });
        emit({ type: 'break' });
        await streamer.processFullText(confirmation);
        emit({ type: 'break' });
        if (closing) {
          await streamer.processFullText(closing);
          emit({ type: 'break' });
        }
        await streamer.processFullText(RITE_FEEDBACK_FOLLOWUP);
        return finish('reintegration_complete', { session_id });
      }

      await updateSession(session_id, { full_text: prescribedState.nextFullText, conversation });
      return finish('prescribed', { session_id });
    }

    if (stage === 'complete' || stage === 'inquiry_complete') {
      return fail(`Session is ${stage === 'complete' ? 'complete' : 'in an unresumable state'}. Start a new session.`);
    }

    return fail(`Unexpected session stage: ${stage}.`);

  } catch (err) {
    console.error('/enquire error:', err);
    fail(err?.message || 'Internal error.');
  } finally {
    if (req.is_guest && req.guest_session_id) {
      await incrementGuestTurn(req.guest_session_id).catch((e) =>
        console.error('[guest] incrementGuestTurn failed:', e.message)
      );
    }
  }
});

// ── POST /tts — proxy Fish Audio TTS; returns MP3 audio ──────────────────────
app.post('/tts', authenticateOrGuest, async (req, res) => {
  const { text, voice } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text required.' });
  if (!hasFishKey()) return res.status(503).json({ error: 'TTS not configured.' });
  try {
    const buffer = await fetchAudio(text, voice);
    res.set('Content-Type', 'audio/mpeg');
    res.send(buffer);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// ── POST /stt — Groq Whisper STT; accepts raw audio bytes ────────────────────
app.post('/stt', authenticateOrGuest, async (req, res) => {
  if (!process.env.GROQ_API_KEY) return res.status(503).json({ error: 'STT not configured.' });
  try {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    await new Promise((resolve) => req.on('end', resolve));
    const audioBuffer = Buffer.concat(chunks);
    if (audioBuffer.length === 0) return res.status(400).json({ error: 'Empty audio.' });

    const contentType = req.headers['content-type'] || 'audio/webm';
    const baseType = contentType.split(';')[0].trim(); // strip codecs params e.g. audio/webm;codecs=opus
    const ext = baseType.includes('mp4') ? 'mp4' : baseType.includes('ogg') ? 'ogg' : baseType.includes('wav') ? 'wav' : 'webm';
    console.log(`[stt] bytes=${audioBuffer.length} type=${baseType} ext=${ext}`);
    const file = new File([audioBuffer], `recording.${ext}`, { type: baseType });

    const { default: OpenAI } = await import('openai');
    const groq = new OpenAI({
      baseURL: 'https://api.groq.com/openai/v1',
      apiKey: process.env.GROQ_API_KEY,
    });
    const result = await groq.audio.transcriptions.create({
      file,
      model: 'whisper-large-v3-turbo',
    });
    res.json({ text: result.text ?? '' });
  } catch (err) {
    console.error('[stt]', err);
    res.status(500).json({ error: err.message });
  }
});



// ─────────────────────────────────────────────────────────────────────────────
// ── RITES Corpus ───────────────────────────────────────────────────────
// Serve indexed practices from data/rites/ (synced at build time by scripts/sync-rites.js).

// GET /api/v1/rites/stepstates — polyvagal step definitions
app.get('/api/v1/rites/stepstates', async (req, res) => {
  try {
    const data = JSON.parse(readFileSync(join(RITES_DIR, 'stepstates.json'), 'utf8'));
    res.json(data);
  } catch (e) {
    console.error('[rites/stepstates]', e);
    res.status(500).json({ error: 'Failed to load step states', details: String(e) });
  }
});

// GET /api/v1/rites/recommended/:stepstateId — practice slugs for a given stepstate
app.get('/api/v1/rites/recommended/:stepstateId', async (req, res) => {
  try {
    const mapping = JSON.parse(readFileSync(join(RITES_DIR, 'stepstate_engagement.json'), 'utf8'));
    const slugs = mapping[req.params.stepstateId] || [];
    res.json({ stepstateId: req.params.stepstateId, practices: slugs });
  } catch (e) {
    console.error('[rites/recommended]', e);
    res.status(500).json({ error: 'Failed to load recommended practices', details: String(e) });
  }
});

// GET /api/v1/rites — catalog of all practices
app.get('/api/v1/rites', async (req, res) => {
  try {
    const catalog = JSON.parse(readFileSync(join(RITES_DIR, 'catalog.json'), 'utf8'));
    res.json(catalog);
  } catch (e) {
    console.error('[rites]', e);
    res.status(500).json({ error: 'Failed to load rites catalog', details: String(e) });
  }
});

// GET /api/v1/rites/:slug — full practice data + markdown body
app.get('/api/v1/rites/:slug', async (req, res) => {
  try {
    const index = JSON.parse(readFileSync(join(RITES_DIR, 'index.json'), 'utf8'));
    const practices = index.practices || index;
    const practice = practices.find(p => p.slug === req.params.slug);
    if (!practice) return res.status(404).json({ error: 'Practice not found' });
    res.json(practice);
  } catch (e) {
    console.error('[rites/:slug]', e);
    res.status(500).json({ error: 'Failed to load practice', details: String(e) });
  }
});

app.get('/health', (req, res) => {
  const base = { status: 'alive', version };
  if (req.query.full === 'true') {
    base.endpoints = [
      { method: 'GET',  path: '/' },
      { method: 'GET',  path: '/.well-known/apple-developer-domain-association.txt' },
      { method: 'GET',  path: '/health' },
      { method: 'GET',  path: '/decks' },
      { method: 'GET',  path: '/draw' },
      { method: 'GET',  path: '/octave/steps' },
      { method: 'GET',  path: '/octave/step/:number' },
      { method: 'GET',  path: '/api/v1/rites/stepstates' },
      { method: 'GET',  path: '/api/v1/rites/recommended/:stepstateId' },
      { method: 'GET',  path: '/api/v1/rites/:slug' },
      { method: 'POST', path: '/auth/token' },
      { method: 'POST', path: '/auth/refresh' },
      { method: 'POST', path: '/auth/social-exchange' },
      { method: 'POST', path: '/seeker/new' },
      // Auth required endpoints omitted for brevity
    ];
  }
  res.json(base);
});

// ─────────────────────────────────────────────
// TOTEM — encrypted per-seeker blob + device keys
// ─────────────────────────────────────────────

// GET /totem
app.get('/totem', authenticate, async (req, res) => {
  try {
    const totem = await getTotem(req.seeker_id);
    res.json(totem ?? { ciphertext: null, public_key: null, updated_at: null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /totem
function toBase64(buf) {
  return Buffer.from(buf).toString('base64');
}

function fromBase64(s) {
  return Buffer.from(s, 'base64');
}

async function importRecoveryKey() {
  const secret = process.env.TOTEM_RECOVERY_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error('TOTEM_RECOVERY_SECRET or JWT_SECRET required for totem recovery.');
  const raw = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return globalThis.crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function encryptRecoveryKey(rawKeyB64) {
  const recoveryKey = await importRecoveryKey();
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    recoveryKey,
    fromBase64(rawKeyB64)
  );
  return JSON.stringify({ v: 1, iv: toBase64(iv), ct: toBase64(new Uint8Array(ciphertext)) });
}

async function decryptRecoveryKey(payload) {
  const parsed = typeof payload === 'string' ? JSON.parse(payload) : payload;
  if (!parsed?.iv || !parsed?.ct) throw new Error('Invalid recovery payload.');
  const recoveryKey = await importRecoveryKey();
  const plain = await globalThis.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(parsed.iv) },
    recoveryKey,
    fromBase64(parsed.ct)
  );
  return new Uint8Array(plain);
}

function parseTotemKeyInfo(raw) {
  if (!raw) return { device_public_key: null, recovery_wrapped_key: null };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return {
        device_public_key: parsed.device_public_key ?? null,
        recovery_wrapped_key: parsed.recovery_wrapped_key ?? null,
      };
    }
  } catch {
    // legacy plain string
  }
  return { device_public_key: raw, recovery_wrapped_key: null };
}

app.put('/totem', authenticate, async (req, res) => {
  const { ciphertext, public_key, recovery_key } = req.body || {};
  if (!ciphertext || !public_key) return res.status(400).json({ error: 'ciphertext and public_key required.' });
  try {
    const recovery_wrapped_key = recovery_key ? await encryptRecoveryKey(recovery_key) : null;
    await upsertTotem(
      req.seeker_id,
      ciphertext,
      JSON.stringify({
        device_public_key: public_key,
        recovery_wrapped_key,
      })
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /totem/devices
app.get('/totem/devices', authenticate, async (req, res) => {
  try {
    console.log(`[totem/devices] list seeker=${req.seeker_id}`);
    res.json(await getDevices(req.seeker_id));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /totem/devices
app.post('/totem/devices', authenticate, async (req, res) => {
  const { device_name, public_key, wrapped_key } = req.body || {};
  if (!public_key) return res.status(400).json({ error: 'public_key required.' });
  try {
    console.log(`[totem/devices] register seeker=${req.seeker_id} wrapped=${wrapped_key ? 'yes' : 'no'}`);
    await addDevice(req.seeker_id, device_name ?? null, public_key, wrapped_key ?? null);
    res.json({ ok: true });
  } catch (e) {
    console.error('[totem/devices] register error', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/totem/recover-key', authenticate, async (req, res) => {
  const { public_key } = req.body || {};
  if (!public_key) return res.status(400).json({ error: 'public_key required.' });

  try {
    const totem = await getTotem(req.seeker_id);
    if (!totem?.public_key) {
      console.log(`[totem/recover-key] seeker=${req.seeker_id} no-totem`);
      return res.status(404).json({ error: 'Totem not found.' });
    }

    const { recovery_wrapped_key } = parseTotemKeyInfo(totem.public_key);
    if (!recovery_wrapped_key) {
      console.log(`[totem/recover-key] seeker=${req.seeker_id} no-recovery-key`);
      return res.status(404).json({ error: 'No recoverable totem key found.' });
    }

    console.log(`[totem/recover-key] seeker=${req.seeker_id} recovering`);

    const rawKey = await decryptRecoveryKey(recovery_wrapped_key);
    const subtle = globalThis.crypto.subtle;
    const recipientPublicKey = await subtle.importKey(
      'jwk',
      JSON.parse(public_key),
      { name: 'ECDH', namedCurve: 'P-256' },
      false,
      []
    );

    const ephemeralKeyPair = await subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true,
      ['deriveKey']
    );
    const ephemeralPublicKeyJwk = await subtle.exportKey('jwk', ephemeralKeyPair.publicKey);
    const sharedKey = await subtle.deriveKey(
      { name: 'ECDH', public: recipientPublicKey },
      ephemeralKeyPair.privateKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await subtle.encrypt({ name: 'AES-GCM', iv }, sharedKey, rawKey);

    res.json({
      encrypted_key: JSON.stringify({
        iv: toBase64(iv),
        ct: toBase64(new Uint8Array(encrypted)),
      }),
      ephemeral_public_key: ephemeralPublicKeyJwk,
    });
  } catch (e) {
    console.error('recover-key error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ── POST /totem/distill — generate encrypted distillation for authenticated seeker ──
app.post('/totem/distill', authenticate, async (req, res) => {
  const { session_id } = req.body || {};
  if (!session_id) return res.status(400).json({ error: 'session_id required.' });

  try {
    // Fetch the session conversation.
    const session = await getSession(session_id);
    if (!session || session.seeker_id !== req.seeker_id) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    // Fetch seeker's device public key.
    const devices = await getDevices(req.seeker_id);
    if (!devices.length) return res.status(400).json({ error: 'No device registered.' });
    const devicePublicKeyJwk = JSON.parse(devices[0].public_key);

    // LLM: generate distillation JSON.
    const llm = makeLlmClient();
    const conversation = session.conversation
      .filter((e) => e.role === 'seeker' || e.role === 'priestess')
      .map((e) => `${e.role}: ${e.text}`)
      .join('\n');

const distillationPrompt = `Given this session, extract a brief distillation as JSON:
{
  "arc": "one sentence on the seeker's current arc",
  "qualities": { "dominant": "octave quality", "current": "vagal state" },
  "beliefs": ["belief patterns surfaced"],
  "rite": { "name": "rite name", "act": "core act" },
  "session_note": "1-2 sentence summary",
  "report": "the seeker's own report or feedback about the rite, if present",
  "context": "2-3 sentences Clea should remember at next session open"
}
Session:
${conversation}

Return only valid JSON.`;

    const raw = await llm.chat({
      system: 'You are a distillation engine. Return only valid JSON.',
      messages: [{ role: 'user', content: distillationPrompt }],
      temperature: 0.3,
    });

    let distillation;
    try {
      distillation = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: 'LLM returned invalid JSON.' });
    }

    const reportText =
      typeof session.report === 'string'
        ? session.report
        : session.report?.notes ?? session.report?.unexpected ?? null;
    if (reportText && !distillation.report) {
      distillation.report = reportText;
    }

    // Encrypt distillation to seeker's device public key via ephemeral ECDH.
    // Bun exposes globalThis.crypto (Web Crypto API) natively — no import needed.
    const subtle = globalThis.crypto.subtle;
    const getRandomValues = (arr) => globalThis.crypto.getRandomValues(arr);

    const ephemeralKeyPair = await subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']
    );
    const ephemeralPublicKeyJwk = await subtle.exportKey('jwk', ephemeralKeyPair.publicKey);

    const recipientPublicKey = await subtle.importKey(
      'jwk', devicePublicKeyJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, []
    );
    const sharedKey = await subtle.deriveKey(
      { name: 'ECDH', public: recipientPublicKey },
      ephemeralKeyPair.privateKey,
      { name: 'AES-GCM', length: 256 }, false, ['encrypt']
    );

    const plain = new TextEncoder().encode(JSON.stringify(distillation));
    const iv = getRandomValues(new Uint8Array(12));
    const ciphertext = await subtle.encrypt({ name: 'AES-GCM', iv }, sharedKey, plain);

    const toBase64 = (buf) => Buffer.from(buf).toString('base64');

    res.json({
      encrypted_distillation: JSON.stringify({
        iv: toBase64(iv),
        ct: toBase64(new Uint8Array(ciphertext)),
      }),
      ephemeral_public_key: ephemeralPublicKeyJwk,
    });
  } catch (e) {
    console.error('distill error:', e);
    res.status(500).json({ error: e.message });
  }
});

// Totem route fallthrough diagnostic — if anything under /totem reaches here,
// it missed the explicit handlers above.
app.use('/totem', (req, res, next) => {
  if (res.headersSent) return next();
  console.error(`[totem] unmatched method=${req.method} url=${req.originalUrl}`);
  res.status(404).json({ error: 'Totem route not found.' });
});

// ── Suno export ───────────────────────────────────────────────────────────────

app.post('/suno', authenticateOrGuest, async (req, res) => {
  try {
    const { card, poem } = req.body ?? {};
    if (!card || typeof card !== 'object') {
      return res.status(400).json({ error: 'card object required' });
    }
    const text = (typeof poem === 'string' && poem.trim())
      ? poem.trim()
      : (card.body ?? card.text ?? '').trim();
    if (!text) return res.status(400).json({ error: 'poem text required' });

    const llm = makeLlmClient();
    const result = await buildSunoPackage({ card, poem: text, llmClient: llm });
    res.json(result);
  } catch (e) {
    console.error('suno error:', e);
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3737;
const bootId = randomUUID().slice(0, 8);
const bootedAt = new Date().toISOString();

function logLifecycle(event, extra = '') {
  const suffix = extra ? ` ${extra}` : '';
  console.log(`[api:${bootId}] ${event} pid=${process.pid} at=${new Date().toISOString()}${suffix}`);
}

const server = app.listen(PORT, () => {
  console.log(`[api:${bootId}] boot pid=${process.pid} started=${bootedAt} port=${PORT} version=${version}`);
});

process.on('SIGINT', () => {
  logLifecycle('shutdown', 'signal=SIGINT');
  server.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  logLifecycle('shutdown', 'signal=SIGTERM');
  server.close(() => process.exit(0));
});

export default app;
