import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';

const TAROT_PATH = 'data/tarot_interpretations.json';
const ICHING_PATH = 'data/iChing_Legge.json';
const OUT_TAROT = 'api/data/tarot-octave-map.json';
const OUT_ICHING = 'api/data/iching-octave-map.json';

const EMBED_MODEL = process.env.OURACLE_OPENROUTER_EMBEDDING_MODEL || process.env.OPENROUTER_EMBEDDING_MODEL;
if (!EMBED_MODEL) throw new Error('Set OURACLE_OPENROUTER_EMBEDDING_MODEL');

const client = new OpenAI({
  apiKey: process.env.OURACLE_OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    ...(process.env.OPENROUTER_REFERER ? { 'HTTP-Referer': process.env.OPENROUTER_REFERER } : {}),
    ...(process.env.OPENROUTER_TITLE ? { 'X-Title': process.env.OPENROUTER_TITLE } : {}),
  },
});

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function embedTexts(texts) {
  const response = await client.embeddings.create({
    model: EMBED_MODEL,
    input: texts,
  });
  return response.data.map((item) => item.embedding);
}

function topMatch(embedding, targets) {
  let best = null;
  for (const target of targets) {
    const score = cosineSimilarity(embedding, target.embedding);
    if (!best || score > best.score) best = { ...target, score };
  }
  return best;
}

function loadOctaveSchema() {
  const raw = fs.readFileSync(path.join('api', 'data', 'octave-schema.json'), 'utf8');
  return JSON.parse(raw);
}

function buildOctaveTargets(schema) {
  return schema
    .filter((entry) => entry.quality && entry.signature_text)
    .map((entry) => ({
      quality: entry.quality,
      signature_text: entry.signature_text,
    }));
}

async function mapTarot() {
  if (!fs.existsSync(TAROT_PATH)) throw new Error(`Missing ${TAROT_PATH}`);
  const raw = JSON.parse(fs.readFileSync(TAROT_PATH, 'utf8'));
  const cards = raw.tarot_interpretations || [];
  const octaveTargets = buildOctaveTargets(loadOctaveSchema());
  const octaveEmbeddings = await embedTexts(octaveTargets.map((t) => t.signature_text));
  const targets = octaveTargets.map((t, i) => ({ ...t, embedding: octaveEmbeddings[i] }));

  const cardTexts = cards.map((card) => {
    const keywords = card.keywords?.join(', ') || '';
    const meanings = [
      card.meanings?.light?.join(', ') || '',
      card.meanings?.shadow?.join(', ') || '',
    ].join(' | ');
    return `${card.name}. ${keywords}. ${meanings}`.trim();
  });

  const cardEmbeddings = await embedTexts(cardTexts);
  const mapped = cards.map((card, i) => {
    const best = topMatch(cardEmbeddings[i], targets);
    return {
      name: card.name,
      suit: card.suit,
      rank: card.rank,
      quality: best.quality,
      score: Number(best.score.toFixed(4)),
    };
  });

  fs.writeFileSync(OUT_TAROT, JSON.stringify(mapped, null, 2));
  console.log(`Wrote ${OUT_TAROT}`);
}

async function mapIChing() {
  if (!fs.existsSync(ICHING_PATH)) throw new Error(`Missing ${ICHING_PATH}`);
  const raw = JSON.parse(fs.readFileSync(ICHING_PATH, 'utf8'));
  const hexagrams = raw.hexagrams || [];
  const octaveTargets = buildOctaveTargets(loadOctaveSchema());
  const octaveEmbeddings = await embedTexts(octaveTargets.map((t) => t.signature_text));
  const targets = octaveTargets.map((t, i) => ({ ...t, embedding: octaveEmbeddings[i] }));

  const hexTexts = hexagrams.map((hex) => {
    const lines = (hex.lines || []).join(' | ');
    return `${hex.number} ${hex.name}. ${hex.judgment || ''} ${hex.image || ''} ${lines}`.trim();
  });

  const hexEmbeddings = await embedTexts(hexTexts);
  const mapped = hexagrams.map((hex, i) => {
    const best = topMatch(hexEmbeddings[i], targets);
    return {
      number: hex.number,
      name: hex.name,
      quality: best.quality,
      score: Number(best.score.toFixed(4)),
    };
  });

  fs.writeFileSync(OUT_ICHING, JSON.stringify(mapped, null, 2));
  console.log(`Wrote ${OUT_ICHING}`);
}

await mapTarot();
await mapIChing();
