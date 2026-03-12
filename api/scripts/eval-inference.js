#!/usr/bin/env node

// Evaluate inference accuracy against labeled hypotheticals
// Usage: node api/scripts/eval-inference.js

import fs from 'fs';
import path from 'path';
import { inferSemanticsEmbeddings } from '../semantic-embeddings.js';

const ROOT = '/Users/kerry/house/desk/ouracle';
const HYPOTHETICALS = path.join(ROOT, 'data', 'hypotheticals.md');

function readFile(p) {
  return fs.readFileSync(p, 'utf8');
}

function parseSection(md, prefix) {
  const entries = [];
  const blockRe = /```([\s\S]*?)```/g;
  let match;
  while ((match = blockRe.exec(md)) !== null) {
    const block = match[1];
    const idMatch = block.match(/^\s*id:\s*([A-Z]+_\d+)\s*$/m);
    if (!idMatch || !idMatch[1].startsWith(`${prefix}_`)) continue;
    const labelMatch = block.match(/^\s*label:\s*([^\n]+)\s*$/m);
    const textMatch = block.match(/^\s*text:\s*(?:"([\s\S]*?)"|([^\n]+))\s*$/m);
    if (!labelMatch || !textMatch) continue;
    const text = (textMatch[1] ?? textMatch[2] ?? '').trim();
    entries.push({ id: idMatch[1], label: labelMatch[1].trim(), text });
  }
  return entries;
}

function cleanLabel(label) {
  return label.replace(/\s+/g, ' ').trim();
}

async function evalSet(name, entries, inferFn, pickLabel) {
  let correct = 0;
  const results = [];
  for (const entry of entries) {
    const res = await inferFn(entry.text);
    const predicted = pickLabel(res) ?? 'null';
    const gold = cleanLabel(entry.label);
    const ok = predicted === gold;
    if (ok) correct += 1;
    results.push({ id: entry.id, gold, predicted, ok });
  }
  const acc = entries.length ? (correct / entries.length) : 0;
  return { name, total: entries.length, correct, acc, results };
}

async function main() {
  const md = readFile(HYPOTHETICALS);
  const vagal = parseSection(md, 'VAGAL');
  const belief = parseSection(md, 'BELIEF');
  const octave = parseSection(md, 'OCTAVE');

  const vagalReport = await evalSet('vagal', vagal, inferSemanticsEmbeddings, (r) => r.vagal?.probable);
  const beliefReport = await evalSet('belief', belief, inferSemanticsEmbeddings, (r) => r.belief?.pattern ?? 'null');
  const octaveReport = await evalSet('octave', octave, inferSemanticsEmbeddings, (r) => r.quality?.quality ?? 'null');

  const summary = {
    at: new Date().toISOString(),
    vagal: { total: vagalReport.total, correct: vagalReport.correct, acc: vagalReport.acc },
    belief: { total: beliefReport.total, correct: beliefReport.correct, acc: beliefReport.acc },
    octave: { total: octaveReport.total, correct: octaveReport.correct, acc: octaveReport.acc },
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
