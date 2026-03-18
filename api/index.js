import express from 'express';
import { fetchAudio, hasFishKey } from './fish-tts.js';
import { makeLlmClient } from './llm-client.js';
import { CLEA_SYSTEM_PROMPT } from './clea-prompt.js';
import { randomUUID } from 'crypto';
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
} from './db.js';
import { auth } from './auth-config.js';
import { toNodeHandler } from 'better-auth/node';
import { draw, listDecks, drawContextual, loadDecks } from './decks.js';

const app = express();

const ALLOWED_ORIGINS = [
  'https://ouracle.kerry.ink',
  'http://localhost:2532',
  'https://localhost:2532',
  'http://localhost:5173',
  'http://souvenir.local:2532',
  'https://souvenir.local:2532',
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());

// Serve ambient audio files — no auth required, public CDN-style
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
app.use('/ambient', express.static(join(__dirname, 'data/ambient'), {
  maxAge: '7d',
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
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`${req.method} ${req.originalUrl} -> ${res.statusCode} ${ms}ms`);
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
    'be they legal, lawful, moral, ethical, financial, physical, or metaphysical,',
    'only I can truly know whether my intent serves love or fear.',
    'Ouracle listens. The priestess speaks. I act as I will.',
  ],
};

const COVENANT_REMINDER = 'But, before we enter the temple, I must ask that we enter a covenant. Are you ready?';

function deriveStage(seeker) {
  return seeker?.covenant_at ? 'covenanted' : 'known';
}

app.get('/covenant/current', (_req, res) => res.json(COVENANT));

// ── Divination ───────────────────────────────────────────────────────────────

app.get('/decks', async (_req, res) => {
  try {
    res.json(await listDecks());
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
    res.json({ cards });
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
app.post('/:domain/:verb', authenticate, async (req, res) => {
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
// CHAT — unified SSE streaming endpoint for RIPL
// POST /chat
// ─────────────────────────────────────────────

// Stream text word-by-word with ~25ms spacing.
async function streamText(emit, text) {
  const chunks = text.split(/(\s+)/);
  for (const chunk of chunks) {
    if (chunk) {
      emit({ type: 'token', text: chunk });
      await new Promise((r) => setTimeout(r, 22));
    }
  }
}

app.post('/chat', authenticateOrGuest, async (req, res) => {
  const { session_id, message, mode } = req.body || {};
  const seeker_id = req.seeker_id;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const emit = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  const finish = (stage, extra = {}) => {
    emit({ type: 'complete', stage, ...extra });
    res.end();
  };
  const fail = (message) => {
    emit({ type: 'error', message });
    res.end();
  };

  // ── Guest path ──────────────────────────────────────────
  if (req.is_guest) {
    const GUEST_TURN_LIMIT = 5;
    const guest = await getGuestSession(req.guest_session_id);
    if (!guest) return fail('Guest session not found.');
    if (guest.turns_used >= GUEST_TURN_LIMIT) return fail('guest_limit');

    if (!message) {
      // First load: Clea's opening line for new visitors
      await streamText(emit, 'Speak. What brings you to the threshold?');
      return finish('guest');
    }

    const llm = makeLlmClient();
    const stream = await llm.chat({
      system: CLEA_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: message }],
      temperature: 0.9,
      maxTokens: 512,
      stream: true,
    });

    try {
      for await (const chunk of stream) {
        const text = chunk.choices?.[0]?.delta?.content;
        if (text) emit({ type: 'token', text });
      }
    } catch (streamErr) {
      console.error('/chat guest stream error:', streamErr);
    } finally {
      await incrementGuestTurn(req.guest_session_id).catch((e) =>
        console.error('[guest] incrementGuestTurn failed:', e.message)
      );
    }

    return finish('guest');
  }

  try {
    const seeker = await getSeeker(seeker_id);
    if (!seeker) return fail('Seeker not found.');

    // ── New session ──────────────────────────────
    if (!session_id) {
      // Covenant is NOT auto-recorded — seeker enters it via the modal
      // after Clea introduces it conversationally.

      const sessionCount = await getSeekerSessionCount(seeker_id);
      const lastSession = await getSeekerLatestSession(seeker_id);
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

      emit({ type: 'session', session_id: session.id, stage: 'inquiry', needs_covenant: !seeker.covenant_at });
      if (greeting) {
        await streamText(emit, greeting);
        emit({ type: 'break' });
      }
      await streamText(emit, question);
      // Covenant reminder for seekers who haven't entered the covenant
      if (!seeker.covenant_at) {
        emit({ type: 'break' });
        await streamText(emit, COVENANT_REMINDER);
      }
      return finish('inquiry', { session_id: session.id });
    }

    // ── Continue existing session ─────────────────
    const session = await getSession(session_id);
    if (!session) return fail('Session not found.');

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
      for await (const chunk of stream) {
        const token = chunk.choices?.[0]?.delta?.content;
        if (token) emit({ type: 'token', text: token });
      }
      return finish(session.stage, { session_id });
    }

    const stage = session.stage;

    if (stage === 'inquiry') {
      if (!message) return fail('message required during inquiry.');

      const newText = `${session.full_text || ''} ${message}`.trim();
      const newTurn = (session.turn || 0) + 1;
      const conversation = Array.isArray(session.conversation) ? [...session.conversation] : [];
      conversation.push({ role: 'seeker', text: message, at: new Date().toISOString() });

      const { vagal, belief, quality, affect } = await infer(newText);
      // Attach affect to the seeker entry
      const lastSeekerIdx = conversation.findLastIndex(e => e.role === 'seeker');
      if (lastSeekerIdx !== -1) {
        conversation[lastSeekerIdx] = { ...conversation[lastSeekerIdx], affect };
      }
      // Emit affect SSE event for real-time UI updates
      emit({ type: 'affect', valence: affect.valence, arousal: affect.arousal, gloss: affect.gloss, confidence: affect.confidence });

      const threshold = vagal.confidence === 'high' || (vagal.confidence === 'medium' && belief.confidence !== 'low');

      if (threshold || newTurn >= 3) {
        // Save inference; move to offering — Clea asks if seeker is ready.
        await updateSession(session_id, {
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
        await updateSession(session_id, { conversation });
        await streamText(emit, offeringQ);
        return finish('offering', { session_id });
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
        // Detect and strip draw signal
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
      await updateSession(session_id, { turn: newTurn, full_text: newText, conversation });

      await streamText(emit, nextQ);

      // Clea requested a draw — pick a contextually relevant card server-side
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
            }});
          }
        } catch (e) {
          console.error('[clea] draw signal card fetch failed:', e.message);
        }
      }

      return finish('inquiry', { session_id, turn: newTurn });
    }

    if (stage === 'offering') {
      if (!message) return fail('message required during offering.');

      const conversation = Array.isArray(session.conversation) ? [...session.conversation] : [];
      conversation.push({ role: 'seeker', text: message, at: new Date().toISOString() });

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
          if (text) { chunks.push(text); emit({ type: 'token', text }); }
        }
      } catch (e) {
        console.error('[clea] offering LLM error:', e.message);
      }

      let response = chunks.join('').trim();
      const readySignal = /\s*\[READY\]\s*$/i.test(response);
      if (readySignal) response = response.replace(/\s*\[READY\]\s*$/i, '').trim();

      conversation.push({ role: 'priestess', text: response, at: new Date().toISOString() });

      if (readySignal) {
        const belief = { pattern: session.belief_pattern, confidence: session.belief_confidence, meta: BELIEFS[session.belief_pattern] };
        const quality = { quality: session.quality, confidence: session.quality_confidence, is_shock: session.quality_is_shock };
        const prescription = buildPrescription(session.vagal_probable, belief, quality);
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
          conversation,
          rite_name: prescription.rite?.rite_name,
          rite_json: ritePayload,
          love_fear_audit: prescription.love_fear_audit,
          prescribed_at: new Date().toISOString(),
        });
        emit({ type: 'break' });
        if (quality.seeker_language) { await streamText(emit, quality.seeker_language); emit({ type: 'break' }); }
        // Emit structured rite event — frontend renders in OraclePanel, not chat stream
        emit({ type: 'rite', rite: ritePayload });
        return finish('prescribed', { session_id, rite_name: prescription.rite?.rite_name });
      }

      await updateSession(session_id, { conversation });
      return finish('offering', { session_id });
    }

    if (stage === 'prescribed') {
      if (!message) return fail('message required.');

      const conversation = Array.isArray(session.conversation) ? [...session.conversation] : [];
      conversation.push({ role: 'seeker', text: message, at: new Date().toISOString() });

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
          if (text) { chunks.push(text); emit({ type: 'token', text }); }
        }
      } catch (e) {
        console.error('[clea] prescribed LLM error:', e.message);
      }

      let response = chunks.join('').trim();
      const reportSignal = /\s*\[REPORT\]\s*$/i.test(response);
      if (reportSignal) response = response.replace(/\s*\[REPORT\]\s*$/i, '').trim();

      conversation.push({ role: 'priestess', text: response, at: new Date().toISOString() });

      if (reportSignal) {
        const enacted = !!message;
        await updateSession(session_id, {
          stage: 'complete',
          conversation,
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
        const openingQuestion = Array.isArray(session.conversation)
          ? session.conversation.find((e) => e?.role === 'priestess')?.text
          : null;
        const closing = openingQuestion ? getClosingDedication(openingQuestion) : null;
        if (closing) { await streamText(emit, closing); emit({ type: 'break' }); }
        return finish('complete', { session_id });
      }

      await updateSession(session_id, { conversation });
      return finish('prescribed', { session_id });
    }

    if (stage === 'complete' || stage === 'inquiry_complete') {
      return fail(`Session is ${stage === 'complete' ? 'complete' : 'in an unresumable state'}. Start a new session.`);
    }

    return fail(`Unexpected session stage: ${stage}.`);

  } catch (err) {
    console.error('/chat error:', err);
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

app.get('/health', (_req, res) => res.json({ status: 'alive', version: '0.2.0' }));

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
app.put('/totem', authenticate, async (req, res) => {
  const { ciphertext, public_key } = req.body || {};
  if (!ciphertext || !public_key) return res.status(400).json({ error: 'ciphertext and public_key required.' });
  try {
    await upsertTotem(req.seeker_id, ciphertext, public_key);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /totem/devices
app.get('/totem/devices', authenticate, async (req, res) => {
  try {
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
    await addDevice(req.seeker_id, device_name ?? null, public_key, wrapped_key ?? null);
    res.json({ ok: true });
  } catch (e) {
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

const PORT = process.env.PORT || 3737;
app.listen(PORT, () => console.log(`MEATAPI v0.2 on :${PORT}`));

export default app;
