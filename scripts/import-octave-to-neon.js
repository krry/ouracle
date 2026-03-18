#!/usr/bin/env node

/**
 * Import Octave of Evolution data into Neon
 *
 * Reads: data/octave-mapping-final.json
 * Writes: octave_steps table
 *
 * Usage:
 *   export DATABASE_URL="postgresql://user:pass@host/neondb"
 *   node import-octave-to-neon.js
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'octave-mapping-final.json');

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ Error: DATABASE_URL environment variable not set');
    console.error('   Example: export DATABASE_URL="postgresql://user:pass@host/neondb"');
    process.exit(1);
  }

  // Load data
  console.log(`📂 Loading data from ${DATA_PATH}`);
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  const data = JSON.parse(raw);
  let steps = data.steps;

  console.log(`✅ Loaded ${steps.length} steps`);

  // Normalize field names: camelCase -> snake_case to match schema
  for (const step of steps) {
    if ('visualTheme' in step) {
      step.visual_theme = step.visualTheme;
      delete step.visualTheme;
    }
    if ('audioProfile' in step) {
      step.audio_profile = step.audioProfile;
      delete step.audioProfile;
    }
  }

  // Connect
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  console.log('🔗 Connected to Neon');

  // Ensure table exists (run schema)
  const schemaPath = path.join(__dirname, '..', 'sql', 'octave_steps_schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  await client.query(schemaSql);
  console.log('🏛️ Schema ensured');

  // Build column list in the order defined by schema
  const orderedColumns = [
    'id', 'number', 'name',
    'element', 'chakra', 'aura', 'act', 'intent', 'quality', 'aspect', 'mantra', 'numerology', 'loveform_greek',
    'dimension', 'timespace',
    'early_direction', 'late_direction',
    'early_season', 'later_season',
    'modes_of_persuasion', 'hermetic_principle', 'major_arcana', 'loveforms', 'vedic_pantheon',
    'bagua', 'sacred_bodies', 'stories_of_deep_well', 'dimensional_trinities',
    'visual_theme', 'audio_profile',
    'next_step_number', 'next_step_name', 'previous_step_number', 'previous_step_name',
    'changes_above', 'changes_below',
    'tarot_themes', 'vedic_direction', 'tarot_elements',
    'sense', 'money_stage', 'tarot_astrological_entities',
    'rollup', 'rollup_ids',
    'dimension_ids', 'timespace_ids', 'stories_of_deep_well_ids', 'sacred_bodies_ids',
    'hermetic_principle_ids', 'major_arcana_ids', 'loveforms_ids', 'vedic_pantheon_ids',
    'bagua_ids', 'element_ids', 'chakra_ids', 'dimensional_trinities_ids',
    'created_time', 'last_edited_time'
  ];

  // Determine which columns actually exist in the data
  const sample = steps[0];
  const finalColumns = orderedColumns.filter(col => col in sample);
  const missing = orderedColumns.filter(col => !(col in sample) && col !== 'rollup_ids');
  if (missing.length) {
    console.warn(`⚠️  Missing columns in data (will be inserted as NULL): ${missing.join(', ')}`);
  }

  const placeholders = finalColumns.map((_, i) => `$${i+1}`).join(', ');
  const columnList = finalColumns.join(', ');

  console.log(`📊 Using ${finalColumns.length} columns`);

  // Prepare all inserts
  let inserted = 0;
  for (const step of steps) {
    const values = finalColumns.map(col => {
      const val = step[col];
      if (val === undefined || val === null) return null;
      // Convert Date strings to Date objects
      if (col === 'created_time' || col === 'last_edited_time') {
        return val ? new Date(val) : null;
      }
      // Objects (JSONB) stringify
      if (typeof val === 'object' && !(val instanceof Date) && !Array.isArray(val)) {
        return JSON.stringify(val);
      }
      return val;
    });

    try {
      await client.query(
        `INSERT INTO octave_steps (${columnList}) VALUES (${placeholders})
         ON CONFLICT (number) DO UPDATE SET ` +
        finalColumns.filter(c => c !== 'id' && c !== 'number').map(c => `${c} = EXCLUDED.${c}`).join(', '),
        values
      );
      inserted++;
    } catch (err) {
      console.error(`❌ Failed to insert step ${step.number}: ${err.message}`);
      throw err;
    }
  }

  console.log(`✅ Inserted/updated ${inserted} steps`);

  await client.end();
  console.log('🔒 Disconnected');
}

main().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});