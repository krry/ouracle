/**
 * suno.js — Suno music export engine
 *
 * Transforms a drawn card + poem into a Suno-ready package:
 *   style   ≤120-char style prompt (genre/mood/instrument fragments)
 *   lyrics  poem with [Verse 1] / [Chorus] / [Bridge] / [Outro] markers
 *   meta    { mode, element, quality } — invisible to users
 *
 * Modal mapping (Pythagorean — ratios, not Hz):
 *   Fire (Wands)         → Phrygian   (minor 2nd, descending urgency)
 *   Water (Cups)         → Aeolian    (natural minor, longing)
 *   Air (Swords)         → Mixolydian (dominant 7th, restless clarity)
 *   Earth (Pentacles)    → Dorian     (raised 6th, grounded warmth)
 *   Æther (Major Arcana) → Lydian     (raised 4th, luminous suspension)
 *   Shock (pity/calamity) → Locrian   (diminished 5th — cannot resolve)
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));

// ── Modal tables ──────────────────────────────────────────────────────────────

const SUIT_ELEMENT = {
  wands:     'fire',
  cups:      'water',
  swords:    'air',
  pentacles: 'earth',
  coins:     'earth',  // Ouracle uses both names
  major:     'aether',
};

const ELEMENT_MODE = {
  fire:   'Phrygian',
  water:  'Aeolian',
  air:    'Mixolydian',
  earth:  'Dorian',
  aether: 'Lydian',
};

// These qualities override the elemental mode — their cards cannot resolve
const SHOCK_QUALITIES = new Set(['pity', 'calamity']);

// ── Octave-map lookup ─────────────────────────────────────────────────────────

let _octaveMap = null;
function getOctaveMap() {
  if (!_octaveMap) {
    const raw = readFileSync(join(__dir, 'data/tarot-octave-map.json'), 'utf8');
    _octaveMap = JSON.parse(raw);
  }
  return _octaveMap;
}

/**
 * Look up a card's octave quality from tarot-octave-map.json.
 * Matching is case-insensitive, handles "The Papess/High Priestess" variants.
 */
function lookupQuality(cardName) {
  const map = getOctaveMap();
  const needle = cardName.toLowerCase().trim();
  const entry = map.find(c => {
    const names = c.name.toLowerCase().split('/').map(s => s.trim());
    return names.some(n => n === needle || needle.includes(n) || n.includes(needle));
  });
  return entry?.quality ?? null;
}

// ── Core export ───────────────────────────────────────────────────────────────

/**
 * Resolve mode, element, and quality for a card.
 * @param {string} cardName  e.g. "The Tower" or "nine of swords"
 * @param {string} suit      e.g. "major" | "wands" | "cups" | "swords" | "pentacles"
 * @returns {{ mode: string, element: string, quality: string|null }}
 */
export function getModeForCard(cardName, suit) {
  const element = SUIT_ELEMENT[suit?.toLowerCase()] ?? 'aether';
  const quality = lookupQuality(cardName);
  const mode = (quality && SHOCK_QUALITIES.has(quality))
    ? 'Locrian'
    : (ELEMENT_MODE[element] ?? 'Lydian');
  return { mode, element, quality };
}

/**
 * Ask the LLM to generate a ≤120-char Suno style prompt.
 * The mode is woven into the system context invisibly.
 *
 * @param {{ card: object, poem: string, mode: string, element: string, quality: string|null, llmClient: object }}
 * @returns {Promise<string>}
 */
export async function buildStylePrompt({ card, poem, mode, element, quality, llmClient }) {
  const cardName = card.title ?? card.name ?? 'Unknown card';
  const suit = card.suit ?? 'major';

  const system = `You are a music production expert writing style prompts for Suno AI.

Suno style prompts are comma-separated fragments of genre, mood, texture, and instrumentation.
They must be ≤120 characters total — precision matters more than completeness.
Be specific, evocative, and concrete. Avoid generic words like "beautiful" or "emotional".

The song's elemental character: ${element} / ${mode} mode.
${quality ? `Thematic quality: ${quality}.` : ''}
Read the poem for imagery and texture that should bleed into the sound.

Output ONLY the style prompt — one line, no explanation, no quotes.`;

  const user = `Card: ${cardName} (${suit})

Poem:
${poem}`;

  const raw = await llmClient.chat({
    system,
    messages: [{ role: 'user', content: user }],
    temperature: 0.85,
    maxTokens: 80,
  });

  // Trim, strip quotes, enforce 120-char cap
  const cleaned = raw.trim().replace(/^["']|["']$/g, '');
  return cleaned.slice(0, 120);
}

/**
 * Structure a poem into Suno lyric sections (algorithmic — no LLM needed).
 * Splits on blank lines and assigns [Verse 1], [Chorus], [Bridge], [Outro].
 *
 * @param {string} poem
 * @returns {string}
 */
export function structureLyrics(poem) {
  const stanzas = poem
    .split(/\n{2,}/)
    .map(s => s.trim())
    .filter(Boolean);

  const labels = ['[Verse 1]', '[Chorus]', '[Verse 2]', '[Bridge]', '[Outro]'];

  if (stanzas.length === 1) {
    return `[Verse 1]\n${stanzas[0]}`;
  }

  if (stanzas.length === 2) {
    return `[Verse 1]\n${stanzas[0]}\n\n[Chorus]\n${stanzas[1]}`;
  }

  if (stanzas.length === 3) {
    return `[Verse 1]\n${stanzas[0]}\n\n[Chorus]\n${stanzas[1]}\n\n[Outro]\n${stanzas[2]}`;
  }

  // 4+ stanzas: verse / chorus / verse / bridge / outro (last stanza)
  const sections = [];
  const sequenceFor = (i, total) => {
    if (i === 0) return '[Verse 1]';
    if (i === total - 1) return '[Outro]';
    if (i === 1) return '[Chorus]';
    if (i === 2) return '[Verse 2]';
    return '[Bridge]';
  };
  for (let i = 0; i < stanzas.length; i++) {
    sections.push(`${sequenceFor(i, stanzas.length)}\n${stanzas[i]}`);
  }
  return sections.join('\n\n');
}

/**
 * Build the complete Suno package for a drawn card + poem.
 *
 * @param {{ card: object, poem: string, llmClient: object }}
 * @returns {Promise<{ style: string, lyrics: string, meta: object }>}
 */
export async function buildSunoPackage({ card, poem, llmClient }) {
  const suit = card.suit ?? 'major';
  const cardName = card.title ?? card.name ?? '';
  const { mode, element, quality } = getModeForCard(cardName, suit);

  const [style, lyrics] = await Promise.all([
    buildStylePrompt({ card, poem, mode, element, quality, llmClient }),
    Promise.resolve(structureLyrics(poem)),
  ]);

  return {
    style,
    lyrics,
    meta: { mode, element, quality },
  };
}
