#!/usr/bin/env node

// Evaluate octave inference against labeled octave narratives.
// Usage: node api/scripts/octave-narrative-test.js

import fs from 'fs';
import path from 'path';
import { inferSemanticsEmbeddings } from '../semantic-embeddings.js';

const ROOT = '/Users/kerry/house/desk/ouracle';
const HYPOTHETICALS = path.join(ROOT, 'data', 'hypotheticals.md');

function readFile(p) {
  return fs.readFileSync(p, 'utf8');
}

function parseOctaveEntries(md) {
  const entries = [];
  const blockRe = /```([\s\S]*?)```/g;
  let match;
  while ((match = blockRe.exec(md)) !== null) {
    const block = match[1];
    const idMatch = block.match(/^\s*id:\s*(OCTAVE_\d+)\s*$/m);
    if (!idMatch) continue;
    const labelMatch = block.match(/^\s*label:\s*([^\n]+)\s*$/m);
    const textMatch = block.match(/^\s*text:\s*(?:"([\s\S]*?)"|([^\n]+))\s*$/m);
    if (!labelMatch || !textMatch) continue;
    const text = (textMatch[1] ?? textMatch[2] ?? '').trim();
    entries.push({ id: idMatch[1], label: labelMatch[1].trim(), text });
  }
  return entries;
}

async function main() {
  const md = readFile(HYPOTHETICALS);
  const entries = parseOctaveEntries(md);
  let correct = 0;
  const results = [];

  for (const entry of entries) {
    const res = await inferSemanticsEmbeddings(entry.text);
    const predicted = res.quality?.quality ?? 'null';
    const gold = entry.label;
    const ok = predicted === gold;
    if (ok) correct += 1;
    results.push({ id: entry.id, gold, predicted, ok });
  }

  const acc = entries.length ? (correct / entries.length) : 0;
  const summary = {
    at: new Date().toISOString(),
    total: entries.length,
    correct,
    acc,
  };

  console.log(JSON.stringify({ summary, results }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
