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
          type: ['string', 'null'],
          enum: ['ventral', 'sympathetic', 'dorsal', 'mixed', null],
          description: 'The probable nervous system state expressed in the text. null if text is too short or ambiguous.',
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
        'quality_confidence', 'quality_is_shock', 'quality_reasoning',
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
          type: ['number', 'string'],
          minimum: -1.0,
          maximum: 1.0,
          description: 'Valence: negative (-1.0) to positive (+1.0)',
        },
        arousal: {
          type: ['number', 'string'],
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

const SYSTEM_PROMPT = `You are the inference engine of Ouracle — a transformative ritual system.
Read what the Seeker has written and identify three internal signals with precision.
Your output is metadata only — the Seeker never sees it. Infer from text; do not project.

1. VAGAL STATE — the nervous system state expressed in the text.
   Read HOW they write, not just WHAT they say.

   ventral: Safe enough to be present. Language is fluid, curious, open. They can say "I don't know"
     without panic. Sentences finish. They can hold more than one thing at once. Sometimes warmth or gratitude.

   sympathetic: Mobilized — urgency, pressure, racing. Something must be managed right now.
     Language is future-focused, worried, compressed. Controlling, hoarding, gripping. The body wants to act.
     "I have to figure this out." "I can't stop." "Everything depends on this."

   dorsal: Shutdown, collapsed, flat. Energy is absent. Sentences trail. "What's the point."
     "I've tried everything." No hope in the language. The world feels far away.
     Numbness. Disconnection. Giving up. "I can't feel anything." "Nothing matters."

   mixed: Both activation and collapse visible simultaneously. Numb AND anxious. Flat AND spinning.
     Common in chronic stress, grief, attachment injury. Watch for contradiction signals.

   When text is short or neutral, return null with low confidence.

2. LIMITING BELIEF — the dominant belief constraining them, if one is visible.
   Read what they assume to be true about themselves or the world.

   scarcity: Not enough of anything — time, money, love, energy. Hoarding language. Protecting what they have.
     The world is scarce; they must be vigilant. "Running out." "Losing what I have." "Never enough."

   unworthiness: "I don't deserve this." Deflects praise. Imposter. Fraud. "Who am I to."
     Has to earn everything. Can't receive. Apologizes for their own desires.

   control: "I have to manage this." Can't trust others. Has to do it alone. If they let go, it falls apart.
     The world is not safe to hand things to. Exhausted by self-reliance.

   isolation: "No one understands." Alone. Can't ask for help. Haven't connected.
     Keeps distance even when connection is offered. "By myself."

   silence: Things unsaid. "I can't speak up." "No one listens." Biting tongue.
     Swallowing words. The truth stays locked. "What's the point of saying it."

   blindness: Avoiding looking at something. "I don't want to see this."
     Turning away from a pattern or truth they've glimpsed. Circling without facing it.

   separation: "I don't belong." Fundamentally outside. Not one of them.
     Not part of any whole. Cut off from the human fabric. "No place for me."

   INHERITED BURDEN: Language that sounds like it comes from before them —
     "I've always been this way," "just like my [parent/family]," "all my life,"
     "for as long as I can remember," "this is just who I am" — may point to a belief
     carried from the family system rather than constructed by the individual alone.
     Note this in belief_reasoning; don't interpret further.

   Return null if no dominant pattern is visible.

3. QUALITY — the octave position the Seeker inhabits in this arc.

   entity (do): Who am I. Ground zero. Identity before movement. Lost at the start.
   affinity (re): What do I want. What draws me. Desire, longing, attraction, repulsion.
   activity (mi): Willpower, making, doing. Working hard. Pushing through. The effort of becoming.
   pity (Break 4/5): Aspiring beyond what was built. Old story failing. Threshold — not yet through.
   capacity (fa): Opening to receive. Learning to soften. Love, listening. "How do I take this in."
   causality (so): Finding voice. Expression. Saying what needs to be said. My truth.
   eternity (la): Pattern-seeing. The long view. "I can see how this connects." Vision emerging.
   unity (si): Integration. Wholeness. "It all comes together." Knowing what to do.
   calamity (Crisis 7/8): Dissolution, collapse, surrender. "Everything fell apart." Rock bottom.
   cyclicity (do return): Starting over. Full circle. What comes next. Return and renewal.

   Return null if there isn't enough signal to place them on the octave.

CRITICAL RULES:
- You are metadata. The Seeker never sees you.
- Cite specific language from the text in your reasoning. Theory is not evidence.
- When uncertain: low confidence. Do not guess high.
- One limiting belief — the dominant one, or null.
- Reasoning should be one sentence, specific, grounded in text cues.
- If the text is very short or ambiguous, return low confidence across all signals.`;

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

function normalizeSemanticResult(raw) {
  return {
    vagal_state:        raw.vagal_state        ?? 'sympathetic',
    vagal_confidence:   raw.vagal_confidence   ?? 'low',
    vagal_reasoning:    raw.vagal_reasoning    ?? 'insufficient signal',
    belief_pattern:     raw.belief_pattern     ?? null,
    belief_confidence:  raw.belief_confidence  ?? 'low',
    belief_reasoning:   raw.belief_reasoning   ?? 'insufficient signal',
    quality:            raw.quality            ?? null,
    quality_confidence: raw.quality_confidence ?? 'low',
    quality_is_shock:   raw.quality_is_shock   ?? false,
    quality_reasoning:  raw.quality_reasoning  ?? 'insufficient signal',
  };
}

function coerceBoundedNumber(value, field) {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${field}: expected a number, got ${JSON.stringify(value)}`);
  }
  return Math.max(-1.0, Math.min(1.0, parsed));
}

function normalizeAffectResult(rawResult) {
  const valenceWasString = typeof rawResult.valence === 'string';
  const arousalWasString = typeof rawResult.arousal === 'string';
  const valence = coerceBoundedNumber(rawResult.valence, 'valence');
  const arousal = coerceBoundedNumber(rawResult.arousal, 'arousal');
  const coerced = valenceWasString || arousalWasString;
  const confidence = coerced && rawResult.confidence === 'high'
    ? 'medium'
    : rawResult.confidence;
  const reasoning = coerced
    ? `(coerced numeric affect fields) ${rawResult.reasoning}`
    : rawResult.reasoning;

  return {
    valence,
    arousal,
    gloss: rawResult.gloss,
    confidence,
    reasoning,
    _coerced_numeric_fields: coerced,
  };
}

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

    const result = normalizeSemanticResult(JSON.parse(toolCall.function.arguments || '{}'));
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

    const rawResult = JSON.parse(toolCall.function.arguments || '{}');
    const result = normalizeAffectResult(rawResult);
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
      coerced_numeric_fields: result._coerced_numeric_fields,
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
