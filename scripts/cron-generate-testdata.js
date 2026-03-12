#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const API_KEY = process.env.OURACLE_OPENAI_API_KEY;
if (!API_KEY) {
  console.error('Missing OURACLE_OPENAI_API_KEY');
  process.exit(1);
}

const ROOT = '/Users/kerry/house/desk/ouracle';
const HYPOTHETICALS = path.join(ROOT, 'data', 'hypotheticals.md');
const F4 = path.join(ROOT, 'data', 'polyvagal_4f.md');
const SCRIPT_QUOTES = path.join(ROOT, 'data', 'polyvagal_script_quotes.md');
const LOG = path.join(ROOT, 'logs', 'cron-testdata.log');

const now = new Date().toISOString();

function readFile(p) {
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

function appendFile(p, content) {
  fs.appendFileSync(p, content, 'utf8');
}

function nextId(prefix, text) {
  const re = new RegExp(`id:\\s*${prefix}_(\\d+)`, 'g');
  let m, max = 0;
  while ((m = re.exec(text)) !== null) {
    const n = parseInt(m[1], 10);
    if (n > max) max = n;
  }
  const next = String(max + 1).padStart(2, '0');
  return `${prefix}_${next}`;
}

function log(msg) {
  appendFile(LOG, `[${now}] ${msg}\n`);
}

async function openaiChat(prompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.8,
      messages: [
        { role: 'system', content: 'You are generating labeled, natural-language examples for a psychological inference dataset. Avoid clinical jargon inside the example text.' },
        { role: 'user', content: prompt }
      ]
    })
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI error: ${res.status} ${t}`);
  }
  const json = await res.json();
  return json.choices[0].message.content;
}

function parseJsonBlock(text) {
  const m = text.match(/```json\n([\s\S]*?)```/);
  if (m) return JSON.parse(m[1]);
  return JSON.parse(text);
}

async function run() {
  const hypotheticals = readFile(HYPOTHETICALS);
  const f4 = readFile(F4);

  const prompt = `Generate NEW labeled examples (2 each) for: (a) polyvagal state, (b) belief pattern, (c) octave narrative, (d) 4F responses.
Return JSON only, format:
{
  "vagal": [{"label":"ventral|sympathetic|dorsal|mixed","text":"...","notes":"..."}, ... x2],
  "belief": [{"label":"scarcity|unworthiness|control|isolation|silence|blindness|separation|null","text":"...","notes":"..."}, ... x2],
  "octave": [{"label":"entity|affinity|activity|pity|capacity|causality|eternity|unity|calamity|cyclicity","text":"...","notes":"..."}, ... x2],
  "f4": [{"label":"fight|flight|fawn|freeze","text":"...","notes":"..."}, ... x2]
}
Guidelines:
- Make texts feel like real speech or journal lines.
- Vary voice: dominant/submissive, active/receptive, conscientious/antisocial, neurotic/gullible.
- Avoid clinical terms inside the text (notes can mention them).
- Keep each text 1–3 sentences.`;

  const response = await openaiChat(prompt);
  const data = parseJsonBlock(response);

  // Append to hypotheticals.md
  let out = `\n\n---\n\n### [AUTO] ${now} — Batch\n`;

  for (const item of data.vagal) {
    const id = nextId('VAGAL', hypotheticals + out);
    out += `\n\n\
\n` + `id: ${id}\nlabel: ${item.label}\ntext: "${item.text}"\nnotes: "${item.notes || ''}"\n` + `\n`;
  }

  for (const item of data.belief) {
    const id = nextId('BELIEF', hypotheticals + out);
    out += `\n\n\
\n` + `id: ${id}\nlabel: ${item.label}\ntext: "${item.text}"\nnotes: "${item.notes || ''}"\n` + `\n`;
  }

  for (const item of data.octave) {
    const id = nextId('OCTAVE', hypotheticals + out);
    out += `\n\n\
\n` + `id: ${id}\nlabel: ${item.label}\ntext: "${item.text}"\nnotes: "${item.notes || ''}"\n` + `\n`;
  }

  appendFile(HYPOTHETICALS, out);

  // Append 4F to polyvagal_4f.md
  let f4out = `\n\n---\n\n### [AUTO] ${now} — Batch\n`;
  for (const item of data.f4) {
    const id = nextId('F4', f4 + f4out);
    f4out += `\n\n\
\n` + `id: ${id}\nlabel: ${item.label}\ntext: "${item.text}"\nnotes: "${item.notes || ''}"\n` + `\n`;
  }
  appendFile(F4, f4out);

  // Script quotes deferred (rate limit + sourcing)
  appendFile(SCRIPT_QUOTES, `\n\n<!-- ${now} — SCRIPT_QUOTES: deferred due to rate-limit/sourcing constraints -->\n`);

  log('Batch appended: 2 vagal, 2 belief, 2 octave, 2 f4; script quotes deferred');
}

run().catch(err => {
  log(`ERROR: ${err.message}`);
  console.error(err);
  process.exit(1);
});
