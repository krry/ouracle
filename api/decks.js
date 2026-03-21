/**
 * decks.js — divine deck loader and card parser
 *
 * Loads card data from api/data/decks/ (synced from alan-botts/divine).
 * Re-exports a stable API so callers never touch the filesystem directly.
 */

import { readdir, readFile } from 'fs/promises';
import { join, extname, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DECKS_DIR = join(__dirname, 'data', 'decks');

// ── Frontmatter parser ───────────────────────────────────────────────────────
// Handles the subset of YAML used by divine cards:
//   scalar strings (quoted or bare), arrays of quoted strings, numbers.

function parseFrontmatter(raw) {
  const lines = raw.split('\n');
  const result = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const kv = line.match(/^(\w+):\s*(.*)/);
    if (!kv) { i++; continue; }
    const key = kv[1];
    const val = kv[2].trim();
    if (val === '[' || val === '') {
      // multi-line array
      const arr = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(']') && lines[i].trim() !== '') {
        const item = lines[i].trim().replace(/^-\s*/, '').replace(/^"|"$/g, '');
        if (item) arr.push(item);
        i++;
      }
      result[key] = arr;
    } else if (val.startsWith('[')) {
      // inline array: ["a", "b"]
      result[key] = val.slice(1, -1).split(',').map(s => s.trim().replace(/^"|"$/g, '')).filter(Boolean);
    } else {
      result[key] = val.replace(/^"|"$/g, '');
    }
    i++;
  }
  return result;
}

// ── Card file parser ─────────────────────────────────────────────────────────

export function parseCard(source) {
  const match = source.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { title: '', keywords: [], body: source.trim(), fields: {} };
  const { title = '', number, keywords = [], asset_url, ...rest } = parseFrontmatter(match[1]);
  const body = match[2].trim();
  return {
    title,
    number: number !== undefined ? Number(number) : undefined,
    keywords: Array.isArray(keywords) ? keywords : [keywords].filter(Boolean),
    asset_url: asset_url || undefined,
    body,
    fields: rest,
  };
}

// ── Deck metadata parser (_deck.yaml) ────────────────────────────────────────

function parseDeckMeta(source) {
  return parseFrontmatter(source.replace(/^---\n?/, '').replace(/\n?---$/, ''));
}

// ── Loader ───────────────────────────────────────────────────────────────────

let _cache = null;

export async function loadDecks({ force = false } = {}) {
  if (_cache && !force) return _cache;

  let deckDirs;
  try {
    deckDirs = await readdir(DECKS_DIR, { withFileTypes: true });
  } catch {
    console.warn('[decks] data/decks/ not found — run scripts/sync-decks.js');
    return (_cache = []);
  }

  const decks = [];
  for (const entry of deckDirs) {
    if (!entry.isDirectory()) continue;
    const deckPath = join(DECKS_DIR, entry.name);
    const files = await readdir(deckPath);

    // Load metadata
    let meta = { name: entry.name, description: '' };
    const metaFile = files.find(f => f === '_deck.yaml');
    if (metaFile) {
      const raw = await readFile(join(deckPath, metaFile), 'utf8');
      meta = { ...meta, ...parseDeckMeta(raw) };
    }

    // Load cards
    const cards = [];
    for (const file of files) {
      if (extname(file) !== '.md' && extname(file) !== '.mdx') continue;
      const raw = await readFile(join(deckPath, file), 'utf8');
      const card = parseCard(raw);
      card.id = basename(file, '.md');
      card.deck = entry.name;
      cards.push(card);
    }

    if (cards.length > 0) {
      decks.push({ id: entry.name, meta, cards });
    }
  }

  // Append rites deck if synced
  const ritesDeck = await loadRitesDeck();
  if (ritesDeck) decks.push(ritesDeck);

  _cache = decks;
  return decks;
}

// ── Rites deck loader ─────────────────────────────────────────────────────────

const RITES_CATALOG = join(__dirname, 'data', 'rites', 'catalog.json');
const RITES_PRACTICES = join(__dirname, 'data', 'rites', 'practices');

async function loadRitesDeck() {
  let catalog;
  try {
    catalog = JSON.parse(await readFile(RITES_CATALOG, 'utf8'));
  } catch {
    return null; // not synced yet — skip silently
  }

  const practices = catalog.practices || catalog;
  const cards = [];

  for (const p of practices) {
    let markdown = '';
    let act = '';
    let themes = [];
    let octave_qualities = [];
    let textures = [];

    try {
      markdown = await readFile(join(RITES_PRACTICES, p.file), 'utf8');
      const fmMatch = markdown.match(/^---\n([\s\S]*?)\n---/);
      if (fmMatch) {
        const fm = parseFrontmatter(fmMatch[1]);
        act = typeof fm.act === 'string' ? fm.act : '';
        themes = Array.isArray(fm.themes) ? fm.themes : [];
        octave_qualities = Array.isArray(fm.octave_qualities) ? fm.octave_qualities : [];
        textures = Array.isArray(fm.textures) ? fm.textures : [];
      }
    } catch { /* file missing — catalog-only */ }

    const keywords = [...new Set([...(p.categories || []), ...themes])];

    cards.push({
      id: p.slug,
      deck: 'rites',
      title: p.name,
      keywords,
      body: act || p.duration || '',
      markdown,
      fields: {
        act,
        source: p.source,
        duration: p.duration,
        movement: p.movement,
        voice: p.voice,
        vagalStates: p.vagalStates || [],
        categories: p.categories || [],
        themes,
        octave_qualities,
        textures,
        primaryStep: p.primaryStep,
      },
    });
  }

  if (!cards.length) return null;
  return {
    id: 'rites',
    meta: { name: 'Rites', description: 'Contemplative practices for body and mind' },
    cards,
  };
}

// ── Draw ─────────────────────────────────────────────────────────────────────

/** Draw n cards. deckIds = null/[] draws across all decks. */
export async function draw(n = 1, deckIds = null) {
  const decks = await loadDecks();
  const ids = Array.isArray(deckIds) && deckIds.length > 0 ? new Set(deckIds) : null;
  const pool = ids
    ? decks.filter(d => ids.has(d.id)).flatMap(d => d.cards)
    : decks.flatMap(d => d.cards);

  if (pool.length === 0) return [];

  // Fisher-Yates sample without replacement
  const copy = pool.slice();
  const drawn = [];
  for (let i = 0; i < Math.min(n, copy.length); i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
    drawn.push(copy[i]);
  }
  return drawn;
}

// ── Contextual (semantic) draw ────────────────────────────────────────────────

/**
 * Score a card against a set of context words via keyword overlap.
 * @param {object} card
 * @param {Set<string>} contextWords
 * @returns {number} 0–1
 */
function scoreCard(card, contextWords) {
  if (!card.keywords?.length) return 0;
  let hits = 0;
  for (const kw of card.keywords) {
    const parts = kw.toLowerCase().split(/\s+/);
    for (const part of parts) {
      if (part.length > 3 && contextWords.has(part)) {
        hits++;
        break; // count keyword once even if multiple parts match
      }
    }
  }
  return hits / card.keywords.length;
}

/**
 * Draw n cards most relevant to the given context string.
 * Scores by keyword overlap; falls back to random if no card scores > 0.
 */
export async function drawContextual(context, n = 1, deckIds = null) {
  if (!context) return draw(n, deckIds);

  const decks = await loadDecks();
  const ids = Array.isArray(deckIds) && deckIds.length > 0 ? new Set(deckIds) : null;
  const pool = ids
    ? decks.filter(d => ids.has(d.id)).flatMap(d => d.cards)
    : decks.flatMap(d => d.cards);

  if (pool.length === 0) return [];

  // Build word set from context
  const contextWords = new Set(
    context.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3)
  );

  // Score each card, sort descending
  const scored = pool.map(card => ({ card, score: scoreCard(card, contextWords) }));
  scored.sort((a, b) => b.score - a.score);

  const best = scored.filter(x => x.score > 0);
  if (best.length === 0) return draw(n, deckIds); // fallback: random

  // Sample from cards scoring >= 40% of the top score
  const threshold = best[0].score * 0.4;
  const candidates = best.filter(x => x.score >= threshold);

  const copy = candidates.slice();
  const drawn = [];
  for (let i = 0; i < Math.min(n, copy.length); i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
    drawn.push(copy[i].card);
  }
  return drawn;
}

/** List available decks (id + meta). */
export async function listDecks() {
  const decks = await loadDecks();
  return decks.map(({ id, meta, cards }) => ({ id, meta, count: cards.length }));
}
