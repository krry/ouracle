#!/usr/bin/env node

/**
 * Verify Octave data import into Neon
 * Queries the table and prints summary stats
 */

const { Client } = require('pg');

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

const client = new Client({ connectionString: dbUrl });

async function verify() {
  await client.connect();

  // Total count
  const countRes = await client.query('SELECT COUNT(*) FROM octave_steps');
  const total = parseInt(countRes.rows[0].count);
  console.log(`📊 Total steps in DB: ${total}`);

  // List steps with key fields
  const res = await client.query(`
    SELECT number, name, element, chakra, act, intent,
           next_step_number, previous_step_number,
           array_length(hermetic_principle, 1) as hermetic_count,
           array_length(major_arcana, 1) as arcana_count,
           array_length(changes_above, 1) as changes_above_count,
           array_length(changes_below, 1) as changes_below_count,
           array_length(tarot_themes, 1) as themes_count
    FROM octave_steps
    ORDER BY number
  `);

  console.log('\n📋 Step Details:');
  console.log('  # | Name            | Element  | Chakra       | Act    | Intent | Next | Prev | HP | Arc | CA | CB | Themes');
  console.log('  --+-----------------+----------+--------------+--------+--------+------+------+----+-----+----+----+-------');
  for (const row of res.rows) {
    const line = ` ${String(row.number).padStart(2)} | ${(row.name||'').substring(0,15).padEnd(15)} | ${(row.element||'').substring(0,8).padEnd(8)} | ${(row.chakra||'').substring(0,12).padEnd(12)} | ${(row.act||'').substring(0,6).padEnd(6)} | ${(row.intent||'').substring(0,6).padEnd(6)} | ${String(row.next_step_number||'-').padStart(4)} | ${String(row.previous_step_number||'-').padStart(4)} | ${String(row.hermetic_count||0).padStart(3)} | ${String(row.arcana_count||0).padStart(4)} | ${String(row.changes_above_count||0).padStart(3)} | ${String(row.changes_below_count||0).padStart(3)} | ${row.themes_count||0}`;
    console.log(line);
  }

  // Check for any NULL resolutions
  const nullRes = await client.query(`
    SELECT COUNT(*) FROM octave_steps
    WHERE next_step_number IS NULL
       OR previous_step_number IS NULL
       OR array_length(changes_above,1) = 0
       OR array_length(changes_below,1) = 0
  `);
  const nullCount = parseInt(nullRes.rows[0].count);
  if (nullCount > 0) {
    console.warn(`\n⚠️  ${nullCount} steps have missing resolution (next/prev/changes)`);
  } else {
    console.log('\n✅ All steps have complete resolutions');
  }

  // Sample raw ID fields length
  console.log('\n🔢 Sample ID field lengths (step 1):');
  const sample = await client.query('SELECT * FROM octave_steps WHERE number = 1');
  if (sample.rows[0]) {
    const row = sample.rows[0];
    console.log(`  sense: ${row.sense ? row.sense.length : 0} IDs`);
    console.log(`  money_stage: ${row.money_stage ? row.money_stage.length : 0} IDs`);
    console.log(`  rollup: ${row.rollup ? row.rollup.length : 0} IDs`);
    console.log(`  tarot_astrological_entities: ${row.tarot_astrological_entities ? row.tarot_astrological_entities.length : 0} IDs`);
  }

  await client.end();
}

verify().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});