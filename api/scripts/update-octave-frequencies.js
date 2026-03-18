#!/usr/bin/env node

/**
 * Update octave_steps audio_profile.frequencyHertz from enhanced mapping
 * Only touches audio_profile; leaves all other columns intact.
 *
 * Usage:
 *   export DATABASE_URL="postgresql://..."
 *   node scripts/update-octave-frequencies.js
 */

import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENHANCED_PATH = path.join(__dirname, '..', '..', 'data', 'octave-mapping-enhanced.json');

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ Error: DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const sql = neon(dbUrl);

  console.log(`📂 Loading enhanced mapping from ${ENHANCED_PATH}`);
  const raw = fs.readFileSync(ENHANCED_PATH, 'utf8');
  const data = JSON.parse(raw);
  const steps = data.steps;
  console.log(`✅ Loaded ${steps.length} steps`);

  let updated = 0;
  for (const step of steps) {
    const number = step.number;
    const audioProfile = step.audioProfile;
    if (!audioProfile) {
      console.warn(`⚠️  Step ${number} missing audioProfile, skipping`);
      continue;
    }

    try {
      await sql`
        UPDATE octave_steps
        SET audio_profile = ${JSON.stringify(audioProfile)},
            last_edited_time = now()
        WHERE number = ${number}
      `;
      updated++;
    } catch (err) {
      console.error(`❌ Failed to update step ${number}: ${err.message}`);
      throw err;
    }
  }

  console.log(`✅ Updated audio_profile for ${updated} steps`);
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
