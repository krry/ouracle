import express from 'express';
import { randomUUID } from 'crypto';
import {
  authenticate,
  issueTokenPair,
  rotateRefreshToken,
  hashApiKey,
} from './auth.js';
import {
  infer,
  buildPrescription,
  variantRite,
  chooseOpeningQuestion,
  RITES,
  BELIEFS,
  OCTAVE,
} from './engine.js';
import {
  createSeeker,
  getSeeker,
  recordCovenant,
  getSeekerHistory,
  createSession,
  getSession,
  updateSession,
  logEnactment,
  getSeekerEnactments,
  hasEnacted,
  writeToCorpus,
  createApiKey,
  updateApiKey,
} from './db.js';

const app = express();
app.use(express.json());

const ADMIN_KEY = process.env.OURACLE_ADMIN_KEY;

// ─────────────────────────────────────────────
// COVENANT
// Public: Priestess apps fetch the current covenant text.
// ─────────────────────────────────────────────

const COVENANT = {
  version: 1,
  effective_date: '2026-03-11',
  text: [
    'I accept 100% responsibility for my actions — legal, lawful, moral, ethical, physical, and financial.',
    'Ouracle listens. Ouracle speaks. I act as I will.',
  ],
};

app.get('/covenant/current', (_req, res) => res.json(COVENANT));

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
  if (!seeker.consented_at) {
    return res.status(403).json({ error: 'Consent not recorded. Complete POST /seeker/new with { consented: true } first.' });
  }
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

  const session = await createSession(seeker_id, covenant);
  await updateSession(session.id, { stage: 'inquiry', turn: 0 });
  const question = chooseOpeningQuestion(context || {});

  return res.json({ session_id: session.id, stage: 'inquiry', turn: 0, question, awaiting: 'response' });
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

  const newText = (session.full_text || '') + ' ' + (response || '');
  const newTurn = (session.turn || 0) + 1;

  const { vagal, belief, quality } = await infer(newText);
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
      vagal_probable: vagal.probable,
      vagal_confidence: vagal.confidence,
      belief_pattern: belief.pattern,
      belief_confidence: belief.confidence,
      quality: quality.quality,
      quality_confidence: quality.confidence,
      quality_is_shock: quality.is_shock,
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
      },
    });
  }

  const clarifiers = [
    'Where do you feel that in your body right now?',
    'How long have you been carrying this?',
    "What would happen if you didn't do anything about it?",
    'Who else is in this with you, even invisibly?',
  ];
  const nextQ = clarifiers[newTurn - 1] || 'What else wants to be said?';

  await updateSession(session_id, { turn: newTurn, full_text: newText });

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
  const { session_id } = req.body;

  const session = await getSession(session_id);
  if (!session) return res.status(404).json({ error: 'Session not found. Run /inquire first.' });
  if (session.stage !== 'inquiry_complete') {
    return res.status(400).json({ error: 'Inquiry not complete. Continue /inquire until ready_for_prescription is true.' });
  }

  const belief  = { pattern: session.belief_pattern, confidence: session.belief_confidence, meta: BELIEFS[session.belief_pattern] };
  const quality = { quality: session.quality, confidence: session.quality_confidence, is_shock: session.quality_is_shock };
  const prescription = buildPrescription(session.vagal_probable, belief, quality);
  const history = await getSeekerHistory(session.seeker_id, 1);
  const lastRite = history?.[0]?.rite_name || null;
  const needsVariant = lastRite && prescription.rite?.rite_name === lastRite;

  if (needsVariant) {
    prescription.rite = variantRite(prescription.rite);
  }

  await updateSession(session_id, {
    stage: 'prescribed',
    rite_name: prescription.rite?.rite_name,
    rite_json: prescription.rite,
    love_fear_audit: prescription.love_fear_audit,
    prescribed_at: new Date().toISOString(),
  });

  const resp = {
    session_id,
    stage: 'prescription',
    rite: prescription.rite,
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

// Three disclosures shown before a seeker record is created.
const CONSENT_DISCLOSURES = [
  'Your words during inquiry are stored to deliver your rite. They are not sold, shared, or used to train external models.',
  'Anonymized rite outcomes (not your words) may be used to improve the Ouracle engine over time. You will always know this.',
  'You may delete your account and all associated data at any time.',
];

// Step 1: GET /consent — receive the disclosures before agreeing
app.get('/consent', (_req, res) => {
  res.json({ disclosures: CONSENT_DISCLOSURES, next: 'POST /seeker/new with { consented: true } to proceed.' });
});

// Step 2: POST /seeker/new — create seeker only after explicit consent
app.post('/seeker/new', async (req, res) => {
  const { device_id, email_hash, timezone, consented, consent_version = '1.0' } = req.body;

  if (!consented) {
    return res.status(400).json({
      error: 'Consent required.',
      hint: 'GET /consent to review disclosures, then POST with { consented: true }.',
      disclosures: CONSENT_DISCLOSURES,
    });
  }

  const seeker = await createSeeker({ device_id, email_hash, timezone, consent_version });
  const tokens = await issueTokenPair(seeker.id);
  return res.status(201).json({ seeker_id: seeker.id, ...tokens, created_at: seeker.created_at });
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
  const { seeker_id } = req.body;
  if (!seeker_id) return res.status(400).json({ error: 'seeker_id required.' });
  const seeker = await getSeeker(seeker_id);
  if (!seeker) return res.status(404).json({ error: 'Seeker not found.' });
  const tokens = await issueTokenPair(seeker_id);
  return res.json(tokens);
});

// POST /auth/refresh — rotate token pair
app.post('/auth/refresh', async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ error: 'refresh_token required.' });
  try {
    const tokens = await rotateRefreshToken(refresh_token);
    return res.json(tokens);
  } catch {
    return res.status(401).json({ error: 'Invalid or expired refresh token.' });
  }
});

app.post('/seeker/:id/covenant', authenticate, async (req, res) => {
  const { covenant_version = '1.0' } = req.body;
  const seeker = await recordCovenant(req.params.id, covenant_version);
  if (!seeker) return res.status(404).json({ error: 'Seeker not found.' });
  return res.json({ seeker_id: seeker.id, covenant_at: seeker.covenant_at });
});

app.get('/seeker/:id/history', authenticate, async (req, res) => {
  const history = await getSeekerHistory(req.params.id);
  return res.json({ seeker_id: req.params.id, history });
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

app.get('/health', (_req, res) => res.json({ status: 'alive', version: '0.2.0' }));

const PORT = process.env.PORT || 3737;
app.listen(PORT, () => console.log(`MEATAPI v0.2 on :${PORT}`));
