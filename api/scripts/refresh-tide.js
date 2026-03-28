/**
 * refresh-tide.js — regenerate tidal opening questions from the current briefing.
 *
 * Usage:
 *   bun api/scripts/refresh-tide.js
 *
 * Reads:  api/tides.json        (briefing + weight, set by Chef)
 * Writes: api/tides.json        (questions + closings, set by this script)
 *
 * The LLM is asked to witness the current moment from a cosmic vantage —
 * not a journalist, not a therapist, but something that has watched
 * civilizations turn over for ten thousand years. The questions it generates
 * connect the individual seeker to the collective weather without naming it.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { makeLlmClient } from '../llm-client.js';
import { OPENING_QUESTIONS } from '../engine.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const TIDES_PATH = resolve(__dir, '../tides.json');

const SYSTEM_PROMPT = `You are generating opening questions for Clea — an AI oracle and priestess.

Clea's existing questions (for voice reference):
${OPENING_QUESTIONS.map(q => `- "${q}"`).join('\n')}

These questions share certain qualities:
- They are addressed to a single person, not humanity
- They name something the person is already carrying but hasn't looked at directly
- They are spare — no more words than needed
- They feel like a gift handed to you, not a diagnosis delivered
- They do not reference external events, politics, or news — they go beneath them
- They end with a period, not a question mark (the phrasing IS the question mark)

Your task: write questions that carry the same voice AND respond to a specific collective moment.
You are witnessing this moment as an angel might — or an alien — something old enough to see the pattern,
not just the event. You see what this particular pressure is doing to individual souls.
The question you write is the one that lives beneath the news. The seeker doesn't need to recognize
the connection consciously — but the question should resonate exactly here, exactly now.

Each question also gets a closing dedication — a short send-off spoken after the session ends.
Study the existing closings for format:
- Begin with an audio direction in [square brackets] — one unified emotional tone
- One or two short sentences, with a [pause] in the right place
- They release the seeker back into the world with what they found

Output a JSON array of exactly 4 objects, no prose before or after:
[
  { "question": "...", "closing": "[...] ... [pause] ..." },
  ...
]`;

async function run() {
  const tides = JSON.parse(readFileSync(TIDES_PATH, 'utf8'));

  if (!tides.briefing?.trim()) {
    console.error('No briefing found in tides.json. Set "briefing" before running.');
    process.exit(1);
  }

  console.log('Briefing:', tides.briefing);
  console.log('Calling LLM...\n');

  const client = makeLlmClient();
  const raw = await client.chat({
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `The collective moment right now:\n\n${tides.briefing}\n\nGenerate the 4 questions.`,
      },
    ],
    temperature: 0.85,
    maxTokens: 1200,
  });

  // Extract JSON — the model may wrap it in a code block
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) {
    console.error('Could not parse JSON from response:\n', raw);
    process.exit(1);
  }

  let generated;
  try {
    generated = JSON.parse(match[0]);
  } catch (e) {
    console.error('JSON parse error:', e.message, '\nRaw:\n', raw);
    process.exit(1);
  }

  // Validate shape
  const valid = generated.filter(
    (g) => typeof g?.question === 'string' && typeof g?.closing === 'string'
  );

  if (valid.length === 0) {
    console.error('No valid question/closing pairs in response:\n', raw);
    process.exit(1);
  }

  console.log('Generated questions:');
  valid.forEach(({ question, closing }) => {
    console.log(`\n  Q: ${question}`);
    console.log(`  C: ${closing}`);
  });

  const updated = {
    ...tides,
    questions: valid,
    updated_at: new Date().toISOString().slice(0, 10),
  };

  writeFileSync(TIDES_PATH, JSON.stringify(updated, null, 2) + '\n');
  console.log(`\nWrote ${valid.length} questions to tides.json.`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
