#!/usr/bin/env node

/**
 * Fetch missing relation titles from Notion API
 *
 * Resolves IDs for: sense, money_stage, tarot_astrological_entities
 * Updates: data/octave-mapping-final.json
 *
 * Usage:
 *   export NOTION_API_KEY="secret_..."
 *   node fetch-remaining-titles.js
 */

const fs = require('fs');
const path = require('path');
// Node 18+ has global fetch, no import needed

const DATA_PATH = path.join(__dirname, '..', 'data', 'octave-mapping-final.json');
const NOTION_VERSION = '2022-06-28';

async function main() {
  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    console.error('❌ NOTION_API_KEY environment variable not set');
    console.error('   Get your key from https://www.notion.so/my-integrations');
    process.exit(1);
  }

  const headers = {
    'Authorization': `Bearer ${apiKey}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json'
  };

  // Load data
  console.log(`📂 Loading ${DATA_PATH}`);
  const raw = fs.readFileSync(DATA_PATH, 'utf8');
  const data = JSON.parse(raw);
  const steps = data.steps;

  // Collect all unique IDs we need
  const senseIds = new Set();
  const moneyStageIds = new Set();
  const tarotAstIds = new Set();

  for (const s of steps) {
    s.sense?.forEach(id => senseIds.add(id));
    s.money_stage?.forEach(id => moneyStageIds.add(id));
    s.tarot_astrological_entities?.forEach(id => tarotAstIds.add(id));
  }

  console.log(`🔍 Need to fetch:`);
  console.log(`   sense: ${senseIds.size} IDs`);
  console.log(`   money_stage: ${moneyStageIds.size} IDs`);
  console.log(`   tarot_astrological_entities: ${tarotAstIds.size} IDs`);
  console.log(`   Total: ${senseIds.size + moneyStageIds.size + tarotAstIds.size}`);

  // Build ID -> title map by fetching pages
  const idToTitle = new Map();

  const allIds = [...senseIds, ...moneyStageIds, ...tarotAstIds];
  console.log(`\n⏳ Fetching ${allIds.length} pages from Notion...`);

  for (let i = 0; i < allIds.length; i++) {
    const id = allIds[i];
    try {
      const res = await fetch(`https://api.notion.com/v1/pages/${id}`, { headers });
      if (!res.ok) {
        if (res.status === 404) {
          console.warn(`   ⚠️  Page ${id} not found (404)`);
          continue;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const page = await res.json();
      // Title is in properties.Name.title[0].text.content assuming a "Name" property
      const titleProp = page.properties?.Name || page.properties?.name || page.properties?.title;
      let title = '(untitled)';
      if (titleProp?.title?.[0]?.text?.content) {
        title = titleProp.title[0].text.content;
      } else if (titleProp?.name?.[0]?.text?.content) {
        title = titleProp.name[0].text.content;
      }
      idToTitle.set(id, title);
      console.log(`   [${i+1}/${allIds.length}] ${title} (${id.slice(0,8)}...)`);
    } catch (err) {
      console.error(`   ❌ Failed ${id}: ${err.message}`);
    }

    // Rate limit: be nice to Notion
    await new Promise(resolve => setTimeout(resolve, 1200)); // ~1.2s between calls
  }

  console.log(`\n✅ Fetched ${idToTitle.size} titles`);

  // Update steps with title arrays
  let updates = 0;
  for (const s of steps) {
    const replaceField = (field) => {
      const old = s[field];
      if (old && old.length) {
        const newTitles = old.map(id => idToTitle.get(id) || id);
        // Only count as update if at least one ID was resolved
        if (newTitles.some((t, i) => t !== old[i])) {
          s[field] = newTitles;
          updates++;
        }
      }
    };

    replaceField('sense');
    replaceField('money_stage');
    replaceField('tarot_astrological_entities');
  }

  console.log(`📝 Updated ${updates} fields with titles`);

  // Save
  data.metadata.mapping_version = '4.0.0';
  data.metadata.notes += ' | Resolved sense, money_stage, tarot_astrological_entities titles via Notion API';
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
  console.log(`💾 Saved to ${DATA_PATH}`);

  // Show sample
  console.log('\n📋 Sample results (step 1):');
  const s1 = steps[0];
  console.log(`   sense: ${JSON.stringify(s1.sense)}`);
  console.log(`   money_stage: ${JSON.stringify(s1.money_stage)}`);
  console.log(`   tarot_ast: ${JSON.stringify(s1.tarot_astrological_entities)}`);
}

main().catch(err => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});