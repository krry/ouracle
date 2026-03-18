#!/usr/bin/env bun
# Emo-Detector demo: prints affect for a sequence of sample messages.
# Usage: bun run scripts/affect-demo.js
# Requires: OPENAI_API_KEY (or equivalent) in environment.

import { infer } from '../api/engine.js';

const messages = [
  "I'm feeling really anxious about this.",
  "Actually, I think I'm excited too.",
  "But overall, I'm not sure.",
  "Maybe there's a way forward.",
];

async function main() {
  const results = [];
  for (const [i, text] of messages.entries()) {
    try {
      const result = await infer(text);
      results.push({ turn: i + 1, text, affect: result.affect });
    } catch (err) {
      console.error(`Error on turn ${i + 1}:`, err.message);
      results.push({ turn: i + 1, text, error: err.message });
    }
  }
  console.log(JSON.stringify(results, null, 2));
}

main();
