#!/usr/bin/env node
/**
 * PWA Build Helper for Ouracle
 * - Generates icon set from source SVG
 * - Bumps cache version in vite.config.ts
 * - Optional: create .nojekyll to disable Jekyll on GitHub Pages
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT = join(__dirname, '..');
const VITE_CONFIG = join(ROOT, 'vite.config.ts');
const STATIC_DIR = join(ROOT, 'static');
const ICONS_DIR = join(STATIC_DIR, 'icons');

// Required icon sizes
const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const ROOT_ICONS = [64, 192, 512]; // For VitePWA manifest

async function ensureSharp() {
  try {
    require('sharp');
  } catch {
    console.log('Installing sharp for icon generation...');
    execSync('npm install --save-dev sharp', { cwd: ROOT, stdio: 'inherit' });
  }
}

async function generateIcons() {
  const sourceSvg = join(STATIC_DIR, 'icon.svg');

  if (!await fileExists(sourceSvg)) {
    console.error('Missing source SVG: static/icon.svg');
    process.exit(1);
  }

  await mkdir(ICONS_DIR, { recursive: true });

  const sharp = require('sharp');

  const svgData = await readFile(sourceSvg);

  // Generate all sizes in icons/ folder
  for (const size of SIZES) {
    const outPath = join(ICONS_DIR, `icon-${size}x${size}.png`);
    await sharp(svgData)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(outPath);
    console.log(`✓ Generated icon ${size}x${size}`);
  }

  // Generate root-level icons for VitePWA
  for (const size of ROOT_ICONS) {
    const outPath = join(STATIC_DIR, `pwa-${size}x${size}.png`);
    await sharp(svgData)
      .resize(size, size, { fit: 'cover' })
      .png()
      .toFile(outPath);
    console.log(`✓ Generated root pwa-${size}x${size}.png`);
  }

  console.log('Icon generation complete ✓');
}

async function bumpCacheVersion() {
  const config = await readFile(VITE_CONFIG, 'utf-8');

  // Extract current VitePWA workbox config
  // We'll inject a timestamp-based cache name to force bust on every build
  const timestamp = Date.now();
  const newCacheName = `ouracle-static-${timestamp}`;

  // Look for existing cacheName patterns and replace
  const updated = config.replace(
    /cacheName:\s*['"`]ouracle-static-[^'"`]+['"`]/g,
    `cacheName: '${newCacheName}'`
  );

  if (updated !== config) {
    await writeFile(VITE_CONFIG, updated);
    console.log(`✓ Bumped cache version: ${newCacheName}`);
  } else {
    // If no existing cacheName, add to workbox.runtimeCaching options
    // (Simplified: you may need to manually add cacheName to each runtimeCaching entry)
    console.log('⚠ No existing cacheName pattern found — bump manually if needed');
  }
}

async function fileExists(path) {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  console.log('🔨 Ouracle PWA Build Helper\n');

  await ensureSharp();
  await generateIcons();

  if (process.argv.includes('--bump')) {
    await bumpCacheVersion();
  }

  // Create .nojekyll for GitHub Pages if deploying there
  const nojekyll = join(STATIC_DIR, '.nojekyll');
  await writeFile(nojekyll, '');
  console.log('✓ Created .nojekyll');

  console.log('\n✨ PWA assets ready for production build');
}

main().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});