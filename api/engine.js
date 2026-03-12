// Ouracle Engine — v3.0 (Phase 0 Rebuild)
// The engine does not discuss its inner workings.
// All internal inference (vagal, belief, quality) is metadata — not Seeker language.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomInt } from 'crypto';

// ─────────────────────────────────────────────
// THE OCTAVE OF EVOLUTION
// Source: Notion — 🎼 The Octave of Evolution
// Quality vector is the only language we offer Seekers about where they stand.
// We do not name steps. We do not diagnose. We witness.
// ─────────────────────────────────────────────

export const OCTAVE = {
  do: {
    note: 'do', act: 'sit', intent: 'be', theme: 'ground',
    quality: 'entity',
    realm: 'point', shock: false,
    seeker_language: 'a moment of presence and becoming',
  },
  re: {
    note: 're', act: 'feel', intent: 'have', theme: 'affinity',
    quality: 'affinity',
    realm: 'ray', shock: false,
    seeker_language: 'a moment of feeling and relating',
  },
  mi: {
    note: 'mi', act: 'dance', intent: 'make', theme: 'willpower',
    quality: 'activity',
    realm: 'shape', shock: false,
    seeker_language: 'a moment of making and willing',
  },
  break_4_5: {
    note: 'shock (air)', act: 'shock', intent: 'improve', theme: 'shock',
    quality: 'pity',
    realm: 'para', shock: true,
    seeker_language: 'a threshold — what you thought you were building, isn\'t',
  },
  fa: {
    note: 'fa', act: 'listen', intent: 'live', theme: 'love',
    quality: 'capacity',
    realm: 'form', shock: false,
    seeker_language: 'a moment of receiving and opening to love',
  },
  so: {
    note: 'so', act: 'sing', intent: 'say', theme: 'song',
    quality: 'causality',
    realm: 'mind', shock: false,
    seeker_language: 'a moment of voice and expression',
  },
  la: {
    note: 'la', act: 'think', intent: 'envision', theme: 'intuition',
    quality: 'eternity',
    realm: 'soul', shock: false,
    seeker_language: 'a moment of vision and pattern-seeing',
  },
  si: {
    note: 'si', act: 'intend', intent: 'know', theme: 'universality',
    quality: 'unity',
    realm: 'spirit', shock: false,
    seeker_language: 'a moment of integration and wholeness',
  },
  crisis_7_8: {
    note: 'shock (impression)', act: 'fall', intent: 'surrender', theme: 'collapse',
    quality: 'calamity',
    realm: 'meta', shock: true,
    seeker_language: 'a dissolution — the collapse that makes return possible',
  },
  do_prime: {
    note: 'do (return)', act: 'return', intent: 'complete', theme: 'reunion',
    quality: 'cyclicity',
    realm: 'all', shock: false,
    seeker_language: 'a moment of return and beginning again',
  },
};

// ─────────────────────────────────────────────
// VAGAL STATE MAP
// Internal only. Never exposed to Seeker verbatim.
// ─────────────────────────────────────────────

export const VAGAL = {
  ventral:     { quality: 'safe & social', open: true  },
  sympathetic: { quality: 'mobilized',     open: false },
  dorsal:      { quality: 'shutdown',      open: false },
  mixed:       { quality: 'flux',          open: null  },
};

// ─────────────────────────────────────────────
// LIMITING BELIEFS
// Internal only. Maps to chakra centers as inference handles.
// ─────────────────────────────────────────────

export const BELIEFS = {
  scarcity:    { chakra: 'root',    imbalance: 'excess_contraction' },
  unworthiness:{ chakra: 'sacral',  imbalance: 'lack_receptivity'   },
  control:     { chakra: 'solar',   imbalance: 'excess_holding'     },
  isolation:   { chakra: 'heart',   imbalance: 'lack_connection'    },
  silence:     { chakra: 'throat',  imbalance: 'lack_expression'    },
  blindness:   { chakra: 'brow',    imbalance: 'avoidance_of_seeing'},
  separation:  { chakra: 'crown',   imbalance: 'excess_boundary'    },
};

// ─────────────────────────────────────────────
// RITES
// The engine's output is a rite. It prescribes — the experience is
// written before it happens. "May this mantra instruct you."
//
// A rite is whole. A right is one-eyed. We offer rites.
// ─────────────────────────────────────────────

export const RITES = {
  scarcity: {
    rite_name: 'The Release',
    act: 'Give away something you value before you feel ready.',
    invocation: 'There is enough. I am enough.',
    textures: ['Grip tightening before', 'Heat in the chest at the moment of giving', 'Spaciousness after'],
    orientation: 'love', // toward abundance
  },
  unworthiness: {
    rite_name: 'The Receiving',
    act: 'Accept a gift, compliment, or help without deflecting. Let it land fully.',
    invocation: 'I am worthy of what arrives.',
    textures: ['Urge to minimize', 'Discomfort as it lands', 'Warmth if you let it'],
    orientation: 'love',
  },
  control: {
    rite_name: 'The Surrender',
    act: 'Let someone else lead a decision you would normally own. Follow completely.',
    invocation: 'The world can hold this without me.',
    textures: ['Panic at handoff', 'Watching from outside yourself', 'Ease if trust holds'],
    orientation: 'love',
  },
  isolation: {
    rite_name: 'The Reaching',
    act: 'Make the contact you have been withholding. One sentence. Send it before editing twice.',
    invocation: 'My reaching is not weakness. It is the rite.',
    textures: ['Shaking before', 'Vertigo at send', 'Grief or relief — both are it working'],
    orientation: 'love',
  },
  silence: {
    rite_name: 'The Declaration',
    act: 'Say the unsaid thing out loud to a witness. No softening. No preamble.',
    invocation: 'My voice belongs in the room.',
    textures: ['Terror before', 'Body shaking during', 'Liberation or grief after'],
    orientation: 'love',
  },
  blindness: {
    rite_name: 'The Witnessing',
    act: 'Look directly at what you have been turning away from. Do not look away for 5 minutes.',
    invocation: 'I can see this and survive it.',
    textures: ['Resistance to starting', 'Nausea or grief during', 'Clarity breaking through'],
    orientation: 'love',
  },
  separation: {
    rite_name: 'The Belonging',
    act: 'Join something larger than yourself today. Participate without leading or performing.',
    invocation: 'I am not separate from this.',
    textures: ['Self-consciousness at entry', 'Softening as you settle', 'Something loosening in the crown'],
    orientation: 'love',
  },
  grounding: {
    rite_name: 'The Grounding',
    act: 'Place both feet on the floor. Feel your weight. Take 3 slow breaths into the belly. Name 5 things you can see.',
    invocation: 'I am here. This is enough.',
    textures: ['Heaviness', 'Slow warmth returning', 'Small presence reasserting itself'],
    orientation: 'love',
  },
};

// ─────────────────────────────────────────────
// CLUE KEYWORD MAPS
// ─────────────────────────────────────────────

export const VAGAL_CLUE_MAP = {
  sympathetic: ['urgent', 'urgency', "can't stop", 'racing', 'tight', 'tense', 'scared', 'fear', 'must', 'control', 'not enough', 'deadline', 'running out', 'anxious', 'anxiety', 'hoarding', 'gripping', 'panicking', 'restless', 'spinning'],
  dorsal:      ['numb', "what's the point", "can't feel", 'flat', 'hopeless', 'frozen', 'heavy', 'shutdown', 'disconnected', 'why bother', 'exhausted', 'collapsed', "don't care", 'giving up', 'pointless'],
  ventral:     ['curious', 'open', 'possible', 'connected', 'enough', 'present', 'playful', 'grateful', 'flowing', 'clear', 'easy', 'spacious', 'calm'],
};

export const BELIEF_CLUE_MAP = {
  scarcity:     ['not enough', 'running out', "can't afford", 'scarce', 'losing', 'hoarding', 'taking', 'mine', 'protect what i have'],
  unworthiness: ["don't deserve", 'not good enough', 'unworthy', 'who am i', 'imposter', 'fraud', "shouldn't", 'not ready', "when i'm better"],
  control:      ['must manage', "can't trust", "don't trust", 'need to control', 'if i let go', 'what if they', 'have to do it myself', 'do everything myself', 'no one else can', "can't let go", 'i have to manage', 'orchestrat'],
  isolation:    ['alone', 'no one understands', 'by myself', 'do it alone', "can't ask", "haven't talked", 'reaching out', "haven't reached", 'two years', 'distance', 'brother', 'sister', 'parent'],
  silence:      ["can't say", "won't be heard", 'stay quiet', "doesn't matter", 'unsaid', 'kept quiet', 'never told', 'bite my tongue'],
  blindness:    ["can't look", 'avoiding', 'not ready', "don't want to see", 'unclear', 'turning away', 'looking away', 'ignoring'],
  separation:   ['separate', 'not part of', "don't belong", 'outside', 'disconnected from everything', 'no place', 'not one of them'],
};

// TODO: QUALITY_CLUE_MAP — Chef, this is yours to fill in.
//
// These keyword arrays map what a Seeker says to which Quality vector
// they seem to be inhabiting. This is the Octave's fingerprint in language.
// You know this territory better than anyone.
//
// Each quality has an array of words/phrases that signal it.
// When a person says "I don't know what I want to do with my life" → entity
// When they say "everything I built just fell apart" → calamity
// ...and so on.
//
// The inferQuality() function uses these to sense where on the octave
// a Seeker is speaking from — without ever naming it to them.
//
// Structure: { quality_name: ['phrase', 'phrase', ...] }
// File: api/engine.js, below this comment block.

export const QUALITY_CLUE_MAP = {
  entity:    ['who am i', 'what am i', 'where do i start', 'beginning', "don't know where i am", 'lost myself', 'no ground', 'who is this', 'starting from zero'],
  affinity:  ['what do i want', 'what do i feel', 'drawn to', 'connection', 'attraction', 'resonance', 'this feels right', 'something is calling', 'longing'],
  activity:  ['need to make this happen', 'working hard', 'trying so hard', 'doing everything i can', "can't stop moving", 'grinding', 'willpower', 'effort', 'pushing'],
  pity:      ["thought i knew", "i was wrong", 'everything changed', 'not what i thought', 'separate now', 'left behind', 'gap', 'missing something', "can't go back"],
  capacity:  ['open up', 'receive', 'let it in', "can't take it in", 'too much love', 'how do i accept', 'letting go of armor', 'softening'],
  causality: ['finding my voice', 'need to speak', "can't express", 'how do i say this', 'my truth', 'what i need to say', 'communicate', 'the right words'],
  eternity:  ['i can see the pattern', 'something bigger', 'connected to something larger', 'the long view', 'zoom out', 'vision', 'it all makes sense now', 'i know where this goes'],
  unity:     ['i understand', 'it all comes together', 'wholeness', 'integration', 'i know what i need to do', 'clarity', 'complete picture', 'all in'],
  calamity:  ['falling apart', 'collapsed', 'surrender', 'i give up', 'everything is gone', 'the bottom', 'hit rock bottom', "don't know anything anymore", 'crisis'],
  cyclicity: ['starting over', 'full circle', 'back to the beginning', 'where do i go from here', 'what comes next', 'completed something', 'a new chapter', 'wandering'],
};

// ─────────────────────────────────────────────
// INFERENCE FUNCTIONS
// ─────────────────────────────────────────────

function scoreText(text, keywords) {
  const t = text.toLowerCase();
  return keywords.filter(k => t.includes(k)).length;
}

export function inferVagalState(text) {
  const scores = Object.entries(VAGAL_CLUE_MAP).map(([state, kws]) => ({
    state,
    score: scoreText(text, kws),
  }));
  scores.sort((a, b) => b.score - a.score);
  const top = scores[0];
  const confidence = top.score === 0 ? 'low' : top.score < 3 ? 'medium' : 'high';
  const mixed = scores[0].score > 0 && scores[1].score > 0 && scores[1].score >= scores[0].score - 1;
  return { probable: mixed ? 'mixed' : top.state, confidence, scores };
}

export function inferBelief(text) {
  const scores = Object.entries(BELIEF_CLUE_MAP).map(([pattern, kws]) => ({
    pattern,
    score: scoreText(text, kws),
  }));
  scores.sort((a, b) => b.score - a.score);
  const top = scores[0];
  if (top.score === 0) return { pattern: null, confidence: 'low' };
  return {
    pattern: top.pattern,
    confidence: top.score >= 2 ? 'high' : 'medium',
    meta: BELIEFS[top.pattern],
  };
}

export function inferQuality(text) {
  const scores = Object.entries(QUALITY_CLUE_MAP).map(([quality, kws]) => ({
    quality,
    score: scoreText(text, kws),
  }));
  scores.sort((a, b) => b.score - a.score);
  const top = scores[0];
  if (top.score === 0) return { quality: null, confidence: 'low' };
  const octaveNode = Object.values(OCTAVE).find(n => n.quality === top.quality);
  return {
    quality: top.quality,
    confidence: top.score >= 2 ? 'high' : 'medium',
    seeker_language: octaveNode?.seeker_language || null,
    is_shock: octaveNode?.shock || false,
  };
}

// ─────────────────────────────────────────────
// INFERENCE DISPATCHER
// Routes to semantic (LLM) or keyword inference based on feature flag.
// Both paths return the same shape — callers don't know which ran.
// ─────────────────────────────────────────────

export async function infer(text) {
  if (process.env.SEMANTIC_INFERENCE === 'true') {
    const mode = (process.env.SEMANTIC_INFERENCE_MODE || 'llm').toLowerCase();
    const result = mode === 'embeddings'
      ? await (await import('./semantic-embeddings.js')).inferSemanticsEmbeddings(text)
      : await (await import('./infer.js')).inferSemantics(text);
    // Attach seeker_language from OCTAVE for the quality node
    if (result.quality.quality) {
      const node = Object.values(OCTAVE).find(n => n.quality === result.quality.quality);
      result.quality.seeker_language = node?.seeker_language || null;
    }
    return result;
  }

  // Keyword fallback
  const vagal   = inferVagalState(text);
  const belief  = inferBelief(text);
  const quality = inferQuality(text);
  return {
    vagal:  { probable: vagal.probable, confidence: vagal.confidence },
    belief: { pattern: belief.pattern, confidence: belief.confidence, meta: belief.meta },
    quality: { quality: quality.quality, confidence: quality.confidence, is_shock: quality.is_shock, seeker_language: quality.seeker_language },
  };
}

// ─────────────────────────────────────────────
// LOVE / FEAR AUDIT
// Love = toward / propulsion. Fear = away / repulsion.
// Post-prescription gate: ensures the rite we offer opens, not closes.
// ─────────────────────────────────────────────

const LOVE_MARKERS = ['receive', 'open', 'reach', 'create', 'invite', 'welcome', 'toward', 'give', 'let in', 'embrace', 'worthy', 'enough', 'belong', 'connect', 'surrender', 'witness', 'declare', 'release'];
const FEAR_MARKERS = ['avoid', 'escape', 'protect', 'defend', 'stop', 'prevent', 'hide', 'safe from', 'keep away', 'block', 'guard', 'resist'];

export function auditLoveFear(rite) {
  if (!rite) return { orientation: 'unknown', love_score: 0, fear_score: 0 };
  const text = [rite.rite_name, rite.act, rite.invocation].join(' ').toLowerCase();
  const love_score = LOVE_MARKERS.filter(w => text.includes(w)).length;
  const fear_score = FEAR_MARKERS.filter(w => text.includes(w)).length;
  const orientation = fear_score > love_score ? 'fear' : love_score > 0 ? 'love' : 'neutral';
  return { orientation, love_score, fear_score };
}

// ─────────────────────────────────────────────
// OPENING QUESTIONS
// ─────────────────────────────────────────────

export const OPENING_QUESTIONS = [
  "What's the thing you keep almost doing, but not quite?",
  "Where in your body do you feel the most resistance right now?",
  "What story are you telling yourself about why this isn't moving?",
  "If you could be honest with yourself about one thing today, what would it be?",
  "What are you holding that you haven't said out loud yet?",
];

export function chooseOpeningQuestion(context = {}) {
  if (context.hint === 'body')   return OPENING_QUESTIONS[1];
  if (context.hint === 'story')  return OPENING_QUESTIONS[2];
  if (context.hint === 'honest') return OPENING_QUESTIONS[3];
  if (context.hint === 'unsaid') return OPENING_QUESTIONS[4];
  const pool = context.last_question
    ? OPENING_QUESTIONS.filter((q) => q !== context.last_question)
    : [...OPENING_QUESTIONS];
  if (Number.isInteger(context.session_count) && pool.length) {
    return pool[context.session_count % pool.length];
  }
  if (pool.length) return pool[0];
  return OPENING_QUESTIONS[0];
}

// ─────────────────────────────────────────────
// ORACLE FLAVOR DRAWS
// ─────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ORACLE_MAPS = {
  tarot: loadOracleMap(path.join(__dirname, 'data', 'tarot-octave-map.json')),
  iching: loadOracleMap(path.join(__dirname, 'data', 'iching-octave-map.json')),
};

function loadOracleMap(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

export function drawOracle(flavor, quality) {
  if (!flavor || !quality) return null;
  const key = String(flavor).toLowerCase();
  const map = ORACLE_MAPS[key];
  if (!Array.isArray(map)) return null;

  const matches = map.filter((entry) => entry.quality === quality);
  if (!matches.length) return null;
  const choice = matches[randomInt(matches.length)];

  if (key === 'tarot') {
    return {
      flavor: 'tarot',
      card: { name: choice.name, suit: choice.suit, rank: choice.rank },
      quality: choice.quality,
      score: choice.score,
    };
  }

  if (key === 'iching') {
    return {
      flavor: 'iching',
      hexagram: { number: choice.number, name: choice.name },
      quality: choice.quality,
      score: choice.score,
    };
  }

  return null;
}

// ─────────────────────────────────────────────
// PRESCRIPTION BUILDER
// Combines vagal + belief + quality inference into a rite.
// Audits for love/fear orientation before returning.
// ─────────────────────────────────────────────

export function buildPrescription(vagalState, belief, quality) {
  const rite = belief?.pattern ? RITES[belief.pattern] : null;

  // Deeply shut down: offer grounding before any rite
  const needsGrounding = vagalState === 'dorsal';

  const selectedRite = needsGrounding ? RITES.grounding : (rite || RITES.grounding);
  const audit = auditLoveFear(selectedRite);

  // Flag if the rite reads as fear-facing (shouldn't happen with current rites,
  // but this gate matters as rites are generated or extended)
  const flagged = audit.orientation === 'fear';

  return {
    vagal_state: vagalState,
    quality: quality?.quality || null,
    quality_is_shock: quality?.is_shock || false,
    limiting_belief: belief?.pattern || null,
    rite: selectedRite,
    love_fear_audit: audit,
    flagged,
    note: needsGrounding
      ? 'The Seeker needs ground before rite. Grounding offered first.'
      : flagged
        ? `⚠ Rite orientation flagged as fear-facing. Review before presenting to Seeker.`
        : null,
  };
}

export function variantRite(rite) {
  if (!rite) return rite;
  return {
    ...rite,
    act: `${rite.act} Do it once in a different place, time, or with a new witness.`,
    textures: Array.isArray(rite.textures)
      ? [...rite.textures, 'A subtle shift from the change in context']
      : rite.textures,
    variant_of: rite.rite_name,
  };
}
