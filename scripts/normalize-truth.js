#!/usr/bin/env node
/**
 * Normalize octave-steps-truth.json
 * - Convert single-element arrays to strings
 * - Set name from 'step' if missing
 * - Flatten simple rollup fields (aura, seasons, directions, mantra, loveform_greek, diment)
 */

const fs = require('fs').promises;
const path = require('path');

const INPUT = path.join(__dirname, '../data/octave-steps-truth.json');
const OUTPUT = path.join(__dirname, '../data/octave-steps-truth.json'); // overwrite

function flattenRollup(val) {
  if (!val || typeof val !== 'object' || val.type !== 'array' || !Array.isArray(val.array) || val.array.length === 0) {
    return val;
  }
  const item = val.array[0];
  if (item.select) {
    return item.select.name;
  } else if (item.multi_select) {
    return item.multi_select.map(s => s.name);
  } else if (item.rich_text) {
    return item.rich_text.map(rt => rt.plain_text).join('');
  } else if (item.relation) {
    // Could attempt to resolve but we already have separate relations; leave raw
    return val;
  }
  return val;
}

async function main() {
  const raw = JSON.parse(await fs.readFile(INPUT, 'utf8'));
  const steps = raw.steps.map(step => {
    // Normalize single-element arrays for common fields
    const singleArrayKeys = ['element', 'chakra', 'color', 'season', 'direction', 'gurdjieff', 'greek_love', 'persuasion', 'tarot', 'sense', 'note', 'dimension', 'timespace', 'realm', 'quality', 'aspect', 'diment', 'mantra', 'step', 'order'];
    for (const key of singleArrayKeys) {
      if (Array.isArray(step[key]) && step[key].length === 1) {
        step[key] = step[key][0];
      }
    }

    // If name is empty, use 'step' property as display name
    if (!step.name && step.step) {
      step.name = step.step;
    }

    // Flatten specific rollup fields
    const flattenable = ['aura', 'early_season', 'early_direction', 'late_direction', 'later_season', 'mantra', 'loveform_greek', 'diment', 'powers_of_ego'];
    for (const key of flattenable) {
      step[key] = flattenRollup(step[key]);
    }

    return step;
  });

  raw.steps = steps;
  await fs.writeFile(OUTPUT, JSON.stringify(raw, null, 2));
  console.log(`✅ Normalized truth data saved: ${OUTPUT}`);

  // Summary
  console.log('\n📊 Updated steps:');
  steps.forEach((s, i) => {
    console.log(`Step ${s.number}: name="${s.name}", element="${s.element}", chakra="${s.chakra}", aura="${s.aura || '(none)'}"`);
  });
}

if (require.main === module) main();
