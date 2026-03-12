#!/usr/bin/env node

// Run neutral texts through semantic inference to flag false positives.
// Usage: node api/scripts/false-positive-test.js

import fs from 'fs';
import path from 'path';
import { inferSemanticsEmbeddings } from '../semantic-embeddings.js';

const ROOT = '/Users/kerry/house/desk/ouracle';
const NEUTRAL_PATH = path.join(ROOT, 'data', 'neutral-texts.txt');

function readLines(filePath) {
  return fs.readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isAboveLow(value) {
  return value === 'medium' || value === 'high';
}

async function main() {
  const texts = readLines(NEUTRAL_PATH);
  const flagged = [];

  for (const [index, text] of texts.entries()) {
    const result = await inferSemanticsEmbeddings(text);
    const vagalFlag = isAboveLow(result.vagal?.confidence);
    const beliefFlag = isAboveLow(result.belief?.confidence);
    const qualityFlag = isAboveLow(result.quality?.confidence);

    if (vagalFlag || beliefFlag || qualityFlag) {
      flagged.push({
        id: index + 1,
        text,
        vagal: { probable: result.vagal?.probable, confidence: result.vagal?.confidence },
        belief: { pattern: result.belief?.pattern, confidence: result.belief?.confidence },
        quality: { quality: result.quality?.quality, confidence: result.quality?.confidence },
      });
    }
  }

  const summary = {
    at: new Date().toISOString(),
    total: texts.length,
    flagged: flagged.length,
    flagged_rate: texts.length ? Number((flagged.length / texts.length).toFixed(3)) : 0,
  };

  console.log(JSON.stringify({ summary, flagged }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
