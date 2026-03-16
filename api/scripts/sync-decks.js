#!/usr/bin/env node
/**
 * sync-decks.js — fetch deck data from alan-botts/divine via GitHub API
 *
 * Usage:
 *   bun run scripts/sync-decks.js
 *   bun run scripts/sync-decks.js --deck tarot  (single deck)
 *
 * Writes to api/data/decks/{deckName}/*.
 * Safe to re-run — overwrites existing files.
 */

import { mkdir, writeFile, readdir, rm } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DECKS_DIR = join(__dirname, '..', 'data', 'decks');
const REPO = 'alan-botts/divine';
const BRANCH = 'main';
const BASE = `https://api.github.com/repos/${REPO}/contents`;
const RAW = `https://raw.githubusercontent.com/${REPO}/${BRANCH}`;
const TOKEN = process.env.GITHUB_TOKEN; // optional — raises rate limit from 60 to 5000/hr

const args = process.argv.slice(2);
const onlyDeck = args.find((_, i) => args[i - 1] === '--deck') ?? null;

const headers = {
  Accept: 'application/vnd.github.v3+json',
  'User-Agent': 'ouracle-sync',
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

async function ghGet(path) {
  const r = await fetch(`${BASE}/${path}`, { headers });
  if (!r.ok) throw new Error(`GitHub API ${r.status}: ${path}`);
  return r.json();
}

async function downloadFile(remotePath, localPath) {
  const r = await fetch(`${RAW}/${remotePath}`, { headers });
  if (!r.ok) throw new Error(`Download failed ${r.status}: ${remotePath}`);
  await writeFile(localPath, await r.text(), 'utf8');
}

async function syncDeck(deckName) {
  const files = await ghGet(`decks/${deckName}`);
  const localDir = join(DECKS_DIR, deckName);
  await mkdir(localDir, { recursive: true });

  let count = 0;
  for (const file of files) {
    if (file.type !== 'file') continue;
    await downloadFile(`decks/${deckName}/${file.name}`, join(localDir, file.name));
    count++;
  }
  console.log(`  ✓ ${deckName} (${count} files)`);
}

async function main() {
  await mkdir(DECKS_DIR, { recursive: true });

  if (onlyDeck) {
    console.log(`Syncing deck: ${onlyDeck}`);
    await syncDeck(onlyDeck);
  } else {
    const entries = await ghGet('decks');
    const deckDirs = entries.filter(e => e.type === 'dir');
    console.log(`Syncing ${deckDirs.length} decks from ${REPO}...`);

    // Check which we already have
    let existing = new Set();
    try {
      const local = await readdir(DECKS_DIR, { withFileTypes: true });
      existing = new Set(local.filter(e => e.isDirectory()).map(e => e.name));
    } catch { /* first run */ }

    for (const deck of deckDirs) {
      if (existing.has(deck.name)) {
        process.stdout.write(`  ~ ${deck.name} (refreshing)\n`);
      }
      await syncDeck(deck.name);
    }

    // Remove local decks that no longer exist upstream
    const upstream = new Set(deckDirs.map(d => d.name));
    for (const name of existing) {
      if (!upstream.has(name)) {
        await rm(join(DECKS_DIR, name), { recursive: true });
        console.log(`  ✗ ${name} (removed — no longer in upstream)`);
      }
    }
  }

  console.log('Done.');
}

main().catch(e => { console.error(e.message); process.exit(1); });
