#!/usr/bin/env node
/**
 * sync-rites.js — fetch rites corpus from krry/rites via GitHub API
 *
 * Downloads canonical dist artifacts from krry/rites to api/data/rites/.
 *
 * Usage:
 *   bun run sync-rites
 */

import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RITES_DIR = join(__dirname, '..', 'data', 'rites');
const REPO = 'krry/rites';
const BRANCH = 'main';
const BASE = `https://api.github.com/repos/${REPO}/contents`;
const RAW = `https://raw.githubusercontent.com/${REPO}/${BRANCH}`;
const TOKEN = process.env.GITHUB_TOKEN;

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

async function downloadRaw(remotePath, localPath) {
  const r = await fetch(`${RAW}/${remotePath}`, { headers });
  if (!r.ok) throw new Error(`Download failed ${r.status}: ${remotePath}`);
  await writeFile(localPath, await r.text(), 'utf8');
}

async function main() {
  await mkdir(RITES_DIR, { recursive: true });

  // dist artifacts
  console.log('Fetching rites dist artifacts...');
  for (const file of ['index.json', 'catalog.json', 'stepstates.json', 'stepstate_engagement.json']) {
    await downloadRaw(`dist/${file}`, join(RITES_DIR, file));
    console.log(`  ✓ ${file}`);
  }

  console.log('Done.');
}

main().catch(e => { console.error(e.message); process.exit(1); });
