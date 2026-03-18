// Ouracle — Semantic Inference (Phase 1 / The Plexus)
// Replaces keyword scoring with Claude API inference.
// Activated by SEMANTIC_INFERENCE=true in .env.
//
// PRIVACY INVARIANTS:
//   - No seeker_id in any LLM call. Ever.
//   - No session_id in any LLM call.
//   - Correlation ID only — for debugging, not for re-identification.
//   - The text sent is the seeker's inquiry text only. Nothing else.

import { randomUUID } from 'crypto';
import { makeRawClient } from './llm-client.js';

// ─────────────────────────────────────────────
// INFERENCE SCHEMA
// Claude is forced to call this tool — structured output, no text parsing.
// ─────────────────────────────────────────────

const INFERENCE_TOOL = {
  type: 'function',
  function: {
    name: 'classify_seeker_state',
    description: 'Classify the internal state expressed in the seeker\'s inquiry text.',
    parameters: {
      type: 'object',
      properties: {
        vagal_state: {
          type: 'string',
          enum: ['ventral', 'sympathetic', 'dorsal', 'mixed'],
          description: 'The probable nervous system state expressed in the text.',
        },
        vagal_confidence: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Confidence in the vagal state inference.',
        },
        vagal_reasoning: {
          type: 'string',
          description: 'One sentence: what in the text signals this vagal state.',
        },
        belief_pattern: {
          type: ['string', 'null'],
          enum: ['scarcity', 'unworthiness', 'control', 'isolation', 'silence', 'blindness', 'separation', null],
          description: 'The dominant limiting belief pattern, if present. null if none is clear.',
        },
        belief_confidence: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Confidence in the belief pattern inference.',
        },
        belief_reasoning: {
          type: 'string',
          description: 'One sentence: what in the text signals this belief pattern.',
        },
        quality: {
          type: ['string', 'null'],
          enum: ['entity', 'affinity', 'activity', 'pity', 'capacity', 'causality', 'eternity', 'unity', 'calamity', 'cyclicity', null],
          description: 'The octave quality the seeker seems to be inhabiting. null if unclear.',
        },
        quality_confidence: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Confidence in the quality inference.',
        },
        quality_is_shock: {
          type: 'boolean',
          description: 'True only if quality is "pity" (Break 4/5) or "calamity" (Crisis 7/8).',
        },
        quality_reasoning: {
          type: 'string',
          description: 'One sentence: what in the text signals this octave quality.',
        },
      },
      required: [
        'vagal_state', 'vagal_confidence', 'vagal_reasoning',
        'belief_pattern', 'belief_confidence', 'belief_reasoning',
        'quality', 'quality_confidence', 'quality_is_shock', 'quality_reasoning',
      ],
      additionalProperties: false,
    },
  },
};

const AFFECT_TOOL = {
  type: 'function',
  function: {
    name: 'classify_affect',
    description: 'Classify affect using Russell\'s Circumplex model based on the seeker\'s text.',
    parameters: {
      type: 'object',
      properties: {
        valence: {
          type: 'number',
          minimum: -1.0,
          maximum: 1.0,
          description: 'Valence: negative (-1.0) to positive (+1.0)',
        },
        arousal: {
          type: 'number',
          minimum: -1.0,
          maximum: 1.0,
          description: 'Arousal: low/deactivated (-1.0) to high/activated (+1.0)',
        },
        gloss: {
          type: 'string',
          maxLength: 50, // Approx 7 words
          description: 'Brief affect label (e.g., "anxious anticipation", "calm contentment")',
        },
        confidence: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Confidence in the affect inference',
        },
        reasoning: {
          type: 'string',
          description: 'One sentence: what in the text signals these coordinates',
        },
      },
      required: ['valence', 'arousal', 'gloss', 'confidence', 'reasoning'],
      additionalProperties: false,
    },
  },
};

// ─────────────────────────────────────────────
// SYSTEM PROMPT
// ⚠ This is the gem. Tune it carefully.
// The quality of every inference the Priestess makes flows from here.
// ─────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the internal inference engine of Ouracle — a transformative ritual system.
Your job is to read what a Seeker has written and identify, as precisely as possible, three internal signals:

1. VAGAL STATE — the probable state of their nervous system:
   - ventral: safe, social, curious, open, connected, present
   - sympathetic: mobilized, anxious, urgent, racing, tight, defensive, controlling
   - dorsal: shutdown, numb, frozen, flat, hopeless, heavy, disconnected, "what's the point"
   - mixed: simultaneous activation of two or more states; use when both sympathetic and dorsal signals appear

2. LIMITING BELIEF — the dominant belief pattern constraining them, if one is clearly present:
   - scarcity: not enough (money, time, energy, love) — hoarding, gripping, protecting
   - unworthiness: "I don't deserve this" — imposter, fraud, not ready, deflects praise
   - control: "I must manage this" — can't trust others, has to do it alone, can't let go
   - isolation: alone, unreachable, haven't connected, can't ask for help
   - silence: unsaid things, can't speak truth, won't be heard, biting tongue
   - blindness: avoiding seeing something clearly, turning away, not ready to look
   - separation: fundamentally outside, doesn't belong, not part of any larger whole
   - null: no dominant limiting belief is visible in this text

3. QUALITY — the octave position the Seeker seems to be inhabiting:
   - entity (do): questions of existence, identity, ground zero — "who am I", "where do I begin"
   - affinity (re): feeling, desire, connection, what draws or repels — "what do I want"
   - activity (mi): willpower, making, doing, pushing — "I'm working so hard", "making this happen"
   - pity (Break 4/5 shock): aspiring beyond what was built, separation from old story — threshold moment
   - capacity (fa): opening to receive, love, listening — "I can't take this in", "how do I open"
   - causality (so): finding voice, expression, saying what needs to be said — "I need to speak my truth"
   - eternity (la): pattern-seeing, envisioning, the long view — "I can see how this connects"
   - unity (si): integration, wholeness, knowing — "it all comes together", "I know what I need"
   - calamity (Crisis 7/8 shock): dissolution, collapse, surrender — "everything fell apart", "I give up"
   - cyclicity (do return): return and beginning again — "starting over", "full circle", "what comes next"
   - null: not enough signal to place the Seeker on the octave

CRITICAL RULES:
- You are an internal engine. Your output is metadata only. The Seeker never sees it.
- Infer from what is actually in the text. Do not project.
- When uncertain, mark confidence as low. Do not guess high.
- One limiting belief at a time. Return the dominant one, or null.
- Your reasoning should cite specific language from the text, not general theory.
- If the text is very short or ambiguous, return low confidence across all three signals.`;

// ─────────────────────────────────────────────
// AFFECT SYSTEM PROMPT
// ─────────────────────────────────────────────

const AFFECT_SYSTEM_PROMPT = `You are an affect detector using Russell's Circumplex model.
Given the seeker's text, assign:
- valence: negative (-1.0) to positive (+1.0)
- arousal: low/deactivated (-1.0) to high/activated (+1.0)
Provide:
- gloss: brief affect label (e.g., "calm contentment", "anxious dread")
- confidence: low/medium/high
- reasoning: one sentence citing text cues

RULES:
- Numbers must be within [-1.0, +1.0] to two decimals.
- If affect is ambiguous or mixed, say so in gloss and still give best-guess coordinates with low confidence.
- Do not project beyond what is in the text.`;

// ─────────────────────────────────────────────
// MAIN INFERENCE FUNCTION
// ─────────────────────────────────────────────

export async function inferSemantics(text) {
  const correlationId = randomUUID();
  const startedAt = Date.now();
  const { openai, model } = makeRawClient();

  try {
    const response = await openai.chat.completions.create({
      model,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      tools: [INFERENCE_TOOL],
      tool_choice: { type: 'function', function: { name: 'classify_seeker_state' } },
    });

    const toolCall = response.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error('No tool call in inference response');

    const result = JSON.parse(toolCall.function.arguments || '{}');
    const durationMs = Date.now() - startedAt;

    // Log — correlation ID only, no seeker data
    console.log(JSON.stringify({
      event: 'inference',
      correlation_id: correlationId,
      duration_ms: durationMs,
      input_tokens: response.usage?.prompt_tokens ?? null,
      output_tokens: response.usage?.completion_tokens ?? null,
      vagal_state: result.vagal_state,
      vagal_confidence: result.vagal_confidence,
      belief_pattern: result.belief_pattern,
      belief_confidence: result.belief_confidence,
      quality: result.quality,
      quality_confidence: result.quality_confidence,
    }));

    return {
      vagal: {
        probable: result.vagal_state,
        confidence: result.vagal_confidence,
        reasoning: result.vagal_reasoning,
      },
      belief: {
        pattern: result.belief_pattern,
        confidence: result.belief_confidence,
        reasoning: result.belief_reasoning,
      },
      quality: {
        quality: result.quality,
        confidence: result.quality_confidence,
        is_shock: result.quality_is_shock,
        reasoning: result.quality_reasoning,
        seeker_language: null, // populated by engine layer
      },
      _meta: { correlation_id: correlationId, duration_ms: durationMs },
    };
  } catch (err) {
    console.error(JSON.stringify({
      event: 'inference_error',
      correlation_id: correlationId,
      error: err.message,
    }));
    throw err;
  }
}

// ─────────────────────────────────────────────
// AFFECT INFERENCE
// ─────────────────────────────────────────────

export async function inferAffect(text) {
  const correlationId = randomUUID();
  const startedAt = Date.now();
  const { openai, model } = makeRawClient();

  try {
    const response = await openai.chat.completions.create({
      model,
      max_tokens: 1024,
      messages: [
        { role: 'system', content: AFFECT_SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
      tools: [AFFECT_TOOL],
      tool_choice: { type: 'function', function: { name: 'classify_affect' } },
    });

    const toolCall = response.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error('No tool call in affect inference response');

    const result = JSON.parse(toolCall.function.arguments || '{}');
    const durationMs = Date.now() - startedAt;

    // Log — correlation ID only, no seeker data
    console.log(JSON.stringify({
      event: 'affect_inference',
      correlation_id: correlationId,
      duration_ms: durationMs,
      input_tokens: response.usage?.prompt_tokens ?? null,
      output_tokens: response.usage?.completion_tokens ?? null,
      valence: result.valence,
      arousal: result.arousal,
      confidence: result.confidence,
    }));

    return {
      affect: {
        valence: result.valence,
        arousal: result.arousal,
        gloss: result.gloss,
        confidence: result.confidence,
        reasoning: result.reasoning,
      },
      _meta: { correlation_id: correlationId, duration_ms: durationMs },
    };
  } catch (err) {
    console.error(JSON.stringify({
      event: 'affect_inference_error',
      correlation_id: correlationId,
      error: err.message,
    }));
    throw err;
  }
}
