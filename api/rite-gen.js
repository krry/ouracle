// rite-gen.js — LLM-based rite generation
//
// Replaces the RITES table lookup in buildPrescription with a model that
// synthesizes the rite from the seeker's actual conversation.
//
// PRIVACY INVARIANTS (same as infer.js):
//   - No seeker_id in any LLM call. Ever.
//   - No session_id in any LLM call.
//   - Conversation text only — no identity data.

import { randomUUID } from 'crypto';
import { makeRawClient } from './llm-client.js';

// Bija seed syllables keyed by octave quality — engine is source of truth here.
// Transitional qualities (pity, calamity, cyclicity) have no anchor, so null.
const BIJA = {
  entity:    'LAM',
  affinity:  'VAM',
  activity:  'RAM',
  capacity:  'YAM',
  causality: 'HAM',
  eternity:  'OM',
  unity:     'AH',
};

const RITE_TOOL = {
  type: 'function',
  function: {
    name: 'craft_rite',
    description: 'Design a rite for the Seeker based on their conversation and internal state.',
    parameters: {
      type: 'object',
      properties: {
        rite_name: {
          type: 'string',
          description: 'The rite\'s name. Format: "The [Noun]". Poetic, 2–4 words.',
        },
        act: {
          type: 'string',
          description: '2–4 sentences. One concrete, specific thing to do. Physical where possible. No lists or sequences.',
        },
        invocation: {
          type: 'string',
          description: 'One line spoken aloud. First person. A declaration, not an affirmation.',
        },
        textures: {
          type: 'array',
          items: { type: 'string' },
          minItems: 3,
          maxItems: 3,
          description: 'Exactly 3 things the Seeker might notice during the rite. Include resistance.',
        },
        bija: {
          type: ['string', 'null'],
          enum: ['LAM', 'VAM', 'RAM', 'YAM', 'HAM', 'OM', 'AH', null],
          description: 'Seed syllable for the quality. null for transitional positions.',
        },
        orientation: {
          type: 'string',
          enum: ['love'],
          description: 'Always "love".',
        },
      },
      required: ['rite_name', 'act', 'invocation', 'textures', 'bija', 'orientation'],
      additionalProperties: false,
    },
  },
};

const SYSTEM_PROMPT = `You are the rite-crafter of Ouracle — a transformative ritual system grounded in somatic healing, Polyvagal Theory, and the Octave of Evolution. Your sole task: design one rite for this Seeker.

A rite is not advice. Not therapy. Not a productivity exercise. A rite is a sacred, specific, accomplishable act that meets the Seeker exactly where they are — and moves them one breath further.

━━━ RITE ANATOMY ━━━

rite_name — "The [Noun]". Poetic, 2–4 words. Examples: "The Turning Toward", "The One Move", "The Bottom". Never clinical ("The Anxiety Relief Practice").

act — 2–4 sentences. One concrete thing to do. Physical where possible. No sequence ("first… then… finally"). No lists. One thread, one motion. The Seeker must be able to do this today, in their current state, with what they have.

invocation — One line spoken aloud. First person. A declaration, not an affirmation.
  Affirmation: "I am enough." (fighting with doubt)
  Declaration: "I have always been enough." (naming what is, from altitude)
  With bija: "LAM. The ground is real." (seed sound + declaration)

textures — Exactly 3 observations the Seeker might notice during the rite. Be honest: include the resistance, the awkwardness, the urge to stop. Then what might arrive if they stay. Not promises — observations.

bija — Seed syllable matching the quality (provided in input). Use null for transitional qualities.

orientation — Always "love".

━━━ VAGAL CONSTRAINTS — HARD RULES ━━━

dorsal (frozen, collapsed, shutdown, heavy):
  • The act must be minimal. One small physical thing. Under 5 minutes.
  • Body over mind: temperature, weight, touch, breath. Not writing lists. Not thinking exercises.
  • Do not ask them to generate energy, feel gratitude, or access joy they do not have.
  • Do not ask them to leave where they are unless the move is tiny and specific.
  • Forbidden in the rite text: "energy", "inspire", "activate", "grateful", "joy", "vibrant".

sympathetic (anxious, urgent, spinning, activated):
  • Give the energy somewhere to go. Redirect — do not accelerate.
  • Movement, voice, writing — all acceptable. Brief and complete, not open-ended.
  • Do not make stillness the primary ask. Do not say "relax" or "calm down".
  • If breath is involved, make it very specific and physical. Not "just breathe."
  • The rite must feel like a destination, not an endless process.

ventral (open, present, curious, flowing):
  • Can be expansive — creative, ceremonial, longer.
  • Making, witnessing, connecting, writing — all available.
  • Can ask for complexity, but hold the single thread.

mixed (both activation and shutdown simultaneously):
  • Body-first. The smallest possible ask.
  • Must work whether the body feels frozen or spinning — do not assume either.

uncertain / null:
  • Default to a gentle, body-first ask. Minimal cognitive load. Under 5 minutes.

━━━ PRINCIPLES FOR PROFOUND RITES ━━━

1. USE THEIR WORDS. If the Seeker said "I keep hitting the same wall" — meet that wall. If they used a specific image or phrase, it belongs in the act or invocation. The rite should feel eerily specific to this person, this day.

2. ADDRESS WITHOUT NAMING. If the belief is unworthiness, give them an experience of sufficiency — not a cognitive exercise about worthiness. The rite enacts the antidote; it never states the diagnosis.

3. ONE THREAD. The rite does one thing. Not three. Not "and also." One act, one direction.

4. TEXTURES INCLUDE RESISTANCE. Name the awkwardness, the urge to stop, the moment of doubt — then what might arrive if they stay. A rite that only promises ease is a lie.

5. NEVER NAME THE DIAGNOSIS. The rite text does not say "since you're feeling anxious" or "given your struggle." The Seeker experiences it without being told what it's for.

6. THE LOVE DIRECTION. Every element — act, invocation, textures — moves toward: toward presence, toward truth, toward the body, toward wholeness. Never away from something.

Output only the craft_rite tool call. No preamble. No explanation.`;

function formatConversation(conversation) {
  if (!Array.isArray(conversation) || !conversation.length) return null;
  const lines = conversation
    .filter(e => e.text && e.role)
    .map(e => `${e.role === 'seeker' ? 'Seeker' : 'Clea'}: ${e.text}`);
  return lines.length ? lines.join('\n') : null;
}

function buildUserMessage(conversation, vagalState, beliefPattern, quality, affect) {
  const parts = [];

  const dialogue = formatConversation(conversation);
  if (dialogue) {
    parts.push(`SEEKER CONVERSATION:\n${dialogue}`);
  }

  const signals = [];
  if (vagalState && vagalState !== 'uncertain') signals.push(`Vagal state: ${vagalState}`);
  if (beliefPattern) signals.push(`Limiting belief: ${beliefPattern}`);
  if (quality) signals.push(`Octave quality: ${quality}`);
  if (affect?.gloss && affect?.confidence !== 'low') signals.push(`Affect: ${affect.gloss}`);

  if (signals.length) {
    parts.push(`INTERNAL READ (Priestess only — never shown to Seeker):\n${signals.join('\n')}`);
  }

  return parts.length ? parts.join('\n\n') : 'No conversation recorded.';
}

export async function generateRite(conversation, { vagalState, beliefPattern, quality, affect } = {}) {
  const correlationId = randomUUID();
  const startedAt = Date.now();
  const { openai, model } = makeRawClient();

  const userContent = buildUserMessage(conversation, vagalState, beliefPattern, quality, affect);

  const response = await openai.chat.completions.create({
    model,
    max_tokens: 800,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    tools: [RITE_TOOL],
    tool_choice: { type: 'function', function: { name: 'craft_rite' } },
  });

  const toolCall = response.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) throw new Error('No tool call in rite generation response');

  const raw = JSON.parse(toolCall.function.arguments || '{}');
  if (!raw.rite_name || !raw.act || !raw.invocation || !Array.isArray(raw.textures)) {
    throw new Error(`Incomplete rite from model: missing required fields`);
  }

  const durationMs = Date.now() - startedAt;
  console.log(JSON.stringify({
    event: 'rite_generated',
    correlation_id: correlationId,
    duration_ms: durationMs,
    model,
    rite_name: raw.rite_name,
    vagal_state: vagalState ?? null,
    quality: quality ?? null,
    input_tokens: response.usage?.prompt_tokens ?? null,
    output_tokens: response.usage?.completion_tokens ?? null,
  }));

  return {
    rite_name: raw.rite_name,
    act: raw.act,
    invocation: raw.invocation,
    textures: raw.textures.slice(0, 3),
    bija: BIJA[quality] ?? null,
    orientation: 'love',
  };
}
