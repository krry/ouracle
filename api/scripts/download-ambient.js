#!/usr/bin/env bun
/**
 * download-ambient.js — fetch ambient audio layers for Ouracle
 *
 * Sources: Freesound.org CC0 previews (128kbps MP3, no OAuth needed with API key)
 *
 * Usage:
 *   FREESOUND_API_KEY=xxx bun scripts/download-ambient.js
 *
 * Get a free API key at: https://freesound.org/apiv2/apply/
 */

import { mkdir, writeFile, access } from 'fs/promises';
import { join } from 'path';

const API_KEY = process.env.FREESOUND_API_KEY;
if (!API_KEY) {
  console.error('\x1b[31mFREESOUND_API_KEY not set.\x1b[0m');
  console.error('Get a free key at: https://freesound.org/apiv2/apply/');
  process.exit(1);
}

const OUT_DIR = join(import.meta.dir, '..', 'data', 'ambient');

// CC0 confirmed picks
const LAYERS = [
  { name: 'bowl-reverb',         id: 573804, label: 'Singing Bowl long with reverb (hollandm)' },
  { name: 'bowl-mid',            id: 398285, label: 'Tibetan Singing Bowl (FlashTrauma)' },
  { name: 'bowl-3',              id: 518703, label: 'Tibetan Bowl #3 (SamuelGremaud)' },
  { name: 'bowl-deep',           id: 449951, label: 'Singing Bowl Male Frequency (steffcaffrey)' },
  { name: 'scene-storm-arrives', id: 673287, label: 'Rain arriving in forest camp at night (felix.blume)' },
  { name: 'scene-deluge',        id: 135821, label: 'Amazon rain soft→hard with thunder (cybergenic)' },
  { name: 'scene-forest-edge',   id: 670033, label: 'Forest night with cicadas + rain (felix.blume)' },
  { name: 'scene-drops',         id: 670037, label: 'Light rain on foliage at night (felix.blume)' },
  { name: 'scene-deep-jungle',   id: 635951, label: 'Jungle night, St Lucia (el_boss)' },
  { name: 'water',               id: 95568,  label: 'Stream in forest (juskiddink)' },
  { name: 'birdsong',            id: 263722, label: 'Dawn chorus in forest (felix.blume)' },
];

async function fetchPreviewUrl(id) {
  const res = await fetch(`https://freesound.org/apiv2/sounds/${id}/`, {
    headers: { Authorization: `Token ${API_KEY}` },
  });
  if (!res.ok) throw new Error(`Freesound metadata ${res.status} for id ${id}`);
  const json = await res.json();
  const url = json?.previews?.['preview-hq-mp3'];
  if (!url) throw new Error(`No preview-hq-mp3 URL in response for id ${id}`);
  return url;
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  const bytes = await res.arrayBuffer();
  await writeFile(dest, Buffer.from(bytes));
  return bytes.byteLength;
}

async function run() {
  await mkdir(OUT_DIR, { recursive: true });

  for (const layer of LAYERS) {
    const dest = join(OUT_DIR, `${layer.name}.mp3`);

    try {
      await access(dest);
      console.log(`  \x1b[90mskip\x1b[0m  ${layer.name}.mp3 (already exists)`);
      continue;
    } catch {}

    process.stdout.write(`  \x1b[90m↓\x1b[0m    ${layer.label}… `);
    try {
      const url = await fetchPreviewUrl(layer.id);
      const bytes = await download(url, dest);
      console.log(`\x1b[32m${(bytes / 1024).toFixed(0)}kb\x1b[0m`);
    } catch (e) {
      console.log(`\x1b[31mfailed: ${e.message}\x1b[0m`);
    }
  }

  console.log(`\n\x1b[90mdest: ${OUT_DIR}\x1b[0m\n`);
}

run();
