import OpenAI from 'openai';
import { VAGAL_CLUE_MAP, BELIEF_CLUE_MAP } from './engine.js';
import { OCTAVE_SCHEMA, getOctaveByQuality } from './octave-schema.js';

const OPENROUTER_API_KEY = process.env.OURACLE_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
  throw new Error('OpenRouter API key missing. Set OURACLE_OPENROUTER_API_KEY or OPENROUTER_API_KEY.');
}

const client = new OpenAI({
  apiKey: OPENROUTER_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    ...(process.env.OPENROUTER_REFERER ? { 'HTTP-Referer': process.env.OPENROUTER_REFERER } : {}),
    ...(process.env.OPENROUTER_TITLE ? { 'X-Title': process.env.OPENROUTER_TITLE } : {}),
  },
});

const EMBED_MODEL = process.env.OURACLE_OPENROUTER_EMBEDDING_MODEL || process.env.OPENROUTER_EMBEDDING_MODEL || 'openai/text-embedding-3-small';
const EMBED_PROVIDER_ORDER = (process.env.OURACLE_OPENROUTER_EMBEDDING_PROVIDER_ORDER || process.env.OPENROUTER_EMBEDDING_PROVIDER_ORDER || '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);

const CACHE = {
  phraseEmbeddings: new Map(),
  classCentroids: new Map(),
  classPhrases: new Map(),
  ready: false,
};

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
  if (!EMBED_MODEL) throw new Error('Embedding model not configured. Set OURACLE_OPENROUTER_EMBEDDING_MODEL.');
  const response = await client.embeddings.create({
    model: EMBED_MODEL,
    input: texts,
    ...(EMBED_PROVIDER_ORDER.length ? { provider: { order: EMBED_PROVIDER_ORDER, allow_fallbacks: false } } : {}),
  });
  return response.data.map((item) => item.embedding);
}

function averageEmbedding(embeddings) {
  const len = embeddings[0].length;
  const avg = new Array(len).fill(0);
  for (const emb of embeddings) {
    for (let i = 0; i < len; i += 1) {
      avg[i] += emb[i];
    }
  }
  for (let i = 0; i < len; i += 1) avg[i] /= embeddings.length;
  return avg;
}

function buildPhraseBank() {
  const bank = new Map();

  for (const [state, phrases] of Object.entries(VAGAL_CLUE_MAP)) {
    bank.set(`vagal:${state}`, phrases);
  }
  for (const [pattern, phrases] of Object.entries(BELIEF_CLUE_MAP)) {
    bank.set(`belief:${pattern}`, phrases);
  }
  for (const entry of OCTAVE_SCHEMA) {
    if (!entry.quality || !entry.signature_text) continue;
    bank.set(`quality:${entry.quality}`, [entry.signature_text]);
  }

  return bank;
}

async function ensureEmbeddingsReady() {
  if (CACHE.ready) return;
  const bank = buildPhraseBank();

  const phrases = [];
  for (const list of bank.values()) {
    for (const phrase of list) {
      if (!CACHE.phraseEmbeddings.has(phrase)) phrases.push(phrase);
    }
  }

  const embeddings = phrases.length ? await embedTexts(phrases) : [];
  phrases.forEach((phrase, idx) => {
    CACHE.phraseEmbeddings.set(phrase, embeddings[idx]);
  });

  for (const [key, list] of bank.entries()) {
    const embs = list.map((phrase) => CACHE.phraseEmbeddings.get(phrase)).filter(Boolean);
    if (!embs.length) continue;
    CACHE.classCentroids.set(key, averageEmbedding(embs));
    CACHE.classPhrases.set(key, list);
  }

  CACHE.ready = true;
}

function bestClass(textEmbedding, classPrefix) {
  const scores = [];
  for (const [key, centroid] of CACHE.classCentroids.entries()) {
    if (!key.startsWith(classPrefix)) continue;
    const score = cosineSimilarity(textEmbedding, centroid);
    scores.push({ key, score });
  }
  scores.sort((a, b) => b.score - a.score);
  return scores;
}

function bestPhrase(textEmbedding, classKey) {
  const phrases = CACHE.classPhrases.get(classKey) || [];
  let best = null;
  for (const phrase of phrases) {
    const emb = CACHE.phraseEmbeddings.get(phrase);
    if (!emb) continue;
    const score = cosineSimilarity(textEmbedding, emb);
    if (!best || score > best.score) best = { phrase, score };
  }
  return best;
}

function confidenceFromScores(topScore, margin, minScore) {
  if (topScore < minScore || margin < 0.03) return 'low';
  if (topScore < minScore + 0.08 || margin < 0.07) return 'medium';
  return 'high';
}

export async function inferSemanticsEmbeddings(text) {
  await ensureEmbeddingsReady();
  const [textEmbedding] = await embedTexts([text]);

  // Vagal state
  const vagalScores = bestClass(textEmbedding, 'vagal:');
  const vagalTop = vagalScores[0];
  const vagalSecond = vagalScores[1];
  const vagalMargin = vagalSecond ? vagalTop.score - vagalSecond.score : vagalTop.score;
  const vagalConfidence = confidenceFromScores(vagalTop.score, vagalMargin, 0.24);
  const vagalBestPhrase = bestPhrase(textEmbedding, vagalTop.key);
  const vagalState = vagalTop.key.replace('vagal:', '');
  const mixed = vagalSecond && vagalTop.score >= 0.26 && vagalSecond.score >= 0.26 && vagalMargin <= 0.03;

  // Belief pattern
  const beliefScores = bestClass(textEmbedding, 'belief:');
  const beliefTop = beliefScores[0];
  const beliefSecond = beliefScores[1];
  const beliefMargin = beliefSecond ? beliefTop.score - beliefSecond.score : beliefTop.score;
  const beliefConfidence = confidenceFromScores(beliefTop.score, beliefMargin, 0.24);
  const beliefBestPhrase = bestPhrase(textEmbedding, beliefTop.key);
  const beliefPattern = beliefTop.score < 0.24 ? null : beliefTop.key.replace('belief:', '');

  // Quality / Octave
  const qualityScores = bestClass(textEmbedding, 'quality:');
  const qualityTop = qualityScores[0];
  const qualitySecond = qualityScores[1];
  const qualityMargin = qualitySecond ? qualityTop.score - qualitySecond.score : qualityTop.score;
  const qualityConfidence = confidenceFromScores(qualityTop.score, qualityMargin, 0.22);
  const qualityValue = qualityTop.score < 0.22 ? null : qualityTop.key.replace('quality:', '');
  const octaveNode = qualityValue ? getOctaveByQuality(qualityValue) : null;

  return {
    vagal: {
      probable: mixed ? 'mixed' : vagalState,
      confidence: vagalConfidence,
      reasoning: vagalBestPhrase?.phrase || 'Matched semantic proximity to vagal signatures.',
    },
    belief: {
      pattern: beliefPattern,
      confidence: beliefConfidence,
      reasoning: beliefBestPhrase?.phrase || 'Matched semantic proximity to belief signatures.',
    },
    quality: {
      quality: qualityValue,
      confidence: qualityConfidence,
      is_shock: octaveNode?.shock || false,
      reasoning: octaveNode?.signature_text || 'Matched semantic proximity to octave signature.',
      seeker_language: null,
    },
  };
}
