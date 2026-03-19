#!/usr/bin/env node
/**
 * Generate PWA icon set from source SVG
 * Requires: npxavatars or sharp (installed as dev dependency)
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp'; // npm install sharp

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Icon sizes required for PWA
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
  const sourceSvg = join(__dirname, '..', 'static', 'icon.svg');

  try {
    const svgData = await readFile(sourceSvg);
    const iconsDir = join(__dirname, '..', 'static', 'icons');

    try {
      await mkdir(iconsDir, { recursive: true });
    } catch {
      // Directory might exist
    }

    for (const size of sizes) {
      const outputPath = join(iconsDir, `icon-${size}x${size}.png`);
      await sharp(svgData)
        .resize(size, size, { fit: 'cover' })
        .png()
        .toFile(outputPath);
      console.log(`✓ Generated ${outputPath}`);
    }

    // Also generate root-level icons for VitePWA
    for (const size of [64, 192, 512]) {
      const outputPath = join(__dirname, '..', 'static', `pwa-${size}x${size}.png`);
      await sharp(svgData)
        .resize(size, size, { fit: 'cover' })
        .png()
        .toFile(outputPath);
      console.log(`✓ Generated ${outputPath}`);
    }

    console.log('All icons generated successfully!');
  } catch (error) {
    console.error('Failed to generate icons:', error);
    process.exit(1);
  }
}

generateIcons();