#!/usr/bin/env node

/**
 * Full Octave Data Extraction — Generic Property Capture
 * Fetches complete page data for each step, resolves all relations,
 * and includes every property found in the page.
 */

const fs = require('fs').promises;
const path = require('path');

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const DATABASE_ID = '2c5f600c4dd44cfd87f03cac143d9139';
const DATA_SOURCE_ID = 'f32bad00-1b18-4e19-ad98-f8801433f160';
const OUTPUT_PATH = path.join(__dirname, '../data/octave-steps-truth.json');

const REQUEST_DELAY = 200;
const MAX_CONCURRENT = 3;

const pageCache = new Map();

async function fetchWithRetry(url, options = {}, retries = 3) {
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (attempt > 1) await delay(200 * attempt);
      const response = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${NOTION_API_KEY}`,
          'Notion-Version': '2025-09-03',
          'Content-Type': 'application/json',
          ...options.headers,
        }
      });
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10) * 1000;
        console.log(`⏳ Rate limited, waiting ${retryAfter/1000}s...`);
        await delay(retryAfter);
        continue;
      }
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText}\n${text}`);
      }
      return await response.json();
    } catch (error) {
      if (attempt === retries) throw error;
      console.log(`⚠️ Request failed: ${error.message}`);
    }
  }
}

async function fetchPage(pageId) {
  if (pageCache.has(pageId)) return pageCache.get(pageId);
  await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));
  try {
    const url = `https://api.notion.com/v1/pages/${pageId}`;
    const data = await fetchWithRetry(url, { method: 'GET' });
    pageCache.set(pageId, data);
    return data;
  } catch (error) {
    console.error(`❌ Failed to fetch page ${pageId}: ${error.message}`);
    pageCache.set(pageId, null);
    return null;
  }
}

function extractValue(prop) {
  if (!prop) return null;
  switch (prop.type) {
    case 'title':
      return prop.title?.map(t => t.plain_text).join('') || null;
    case 'rich_text':
      return prop.rich_text?.map(t => t.plain_text).join('') || null;
    case 'number':
      return prop.number ?? null;
    case 'select':
      return prop.select?.name || null;
    case 'multi_select':
      return prop.multi_select?.map(s => s.name) || [];
    case 'date':
      return prop.date?.start || null;
    case 'relation':
      return prop.relation || [];
    case 'rollup':
      return prop.rollup;
    case 'checkbox':
      return prop.checkbox ?? false;
    case 'url':
    case 'email':
    case 'phone_number':
      return prop[prop.type] || null;
    default:
      // For other types (like 'people', 'files', 'formula'), return raw or null
      return null;
  }
}

function normalizeKey(key) {
  return key.toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

async function resolveRelations(relationArray) {
  if (!relationArray || relationArray.length === 0) return [];
  const ids = relationArray.map(r => r.id);
  const chunks = [];
  for (let i = 0; i < ids.length; i += MAX_CONCURRENT) {
    chunks.push(ids.slice(i, i + MAX_CONCURRENT));
  }
  const results = [];
  for (const chunk of chunks) {
    const pages = await Promise.all(chunk.map(id => fetchPage(id)));
    for (const page of pages) {
      if (page) {
        results.push(getPageDisplayName(page));
      } else {
        results.push(`[missing]`);
      }
    }
  }
  return results;
}

function getPageDisplayName(page) {
  const props = page.properties || {};
  const candidates = ['Name', 'name', 'title', 'Title', 'Element', 'Chakra', 'Bagua', 'Step'];
  for (const key of candidates) {
    if (props[key]) {
      const val = extractValue(props[key]);
      if (val && typeof val === 'string') return val;
      if (val && Array.isArray(val) && val.length > 0) return String(val[0]);
    }
  }
  for (const prop of Object.values(props)) {
    if (prop.title && prop.title.length > 0) {
      const val = extractValue(prop);
      if (val && typeof val === 'string') return val;
      if (val && Array.isArray(val) && val.length > 0) return String(val[0]);
    }
  }
  return `[${page.id.slice(0, 8)}]`;
}

async function main() {
  if (!NOTION_API_KEY) {
    console.error('❌ NOTION_API_KEY not set');
    process.exit(1);
  }

  console.log('🚀 Starting full octave extraction with generic property capture...\n');

  // Get ordered step IDs from data source
  console.log('🌌 Querying data source for step list...');
  const queryUrl = `https://api.notion.com/v1/data_sources/${DATA_SOURCE_ID}/query`;
  const queryRes = await fetchWithRetry(queryUrl, { method: 'POST', body: '{}' });
  const stepMetaList = queryRes.results || [];
  console.log(`✅ Found ${stepMetaList.length} steps`);

  const steps = [];
  const startTime = Date.now();
  let totalRelationsFetched = 0;

  // Process each step
  for (let i = 0; i < stepMetaList.length; i++) {
    const meta = stepMetaList[i];
    console.log(`\n📘 Step ${i+1}: Fetching page ${meta.id}...`);
    const fullPage = await fetchPage(meta.id);
    if (!fullPage) {
      console.error(`❌ Failed to fetch step page ${meta.id}, skipping`);
      continue;
    }

    const props = fullPage.properties || {};

    // Start building step object: include all properties
    const step = {
      id: fullPage.id,
      number: i + 1,
      created_time: fullPage.created_time,
      last_edited_time: fullPage.last_edited_time,
    };

    // First pass: extract all simple properties
    const relationProps = {};
    for (const [key, prop] of Object.entries(props)) {
      const normalized = normalizeKey(key);
      const value = extractValue(prop);

      if (prop.type === 'relation' || (prop.rollup && Array.isArray(prop.rollup))) {
        // Defer resolution
        relationProps[key] = { prop, normalized };
      } else {
        step[normalized] = value;
      }
    }

    // Show which properties we captured (debug)
    console.log(`  📦 Captured properties: ${Object.keys(step).filter(k=>k!=='id'&&k!=='number').slice(0,15).join(', ')}...`);

    // Resolve relations
    let stepRels = 0;
    for (const [key, { prop, normalized }] of Object.entries(relationProps)) {
      const relData = prop.type === 'relation' ? prop.relation : (prop.rollup || []);
      if (relData.length === 0) continue;
      try {
        const resolved = await resolveRelations(relData);
        step[`${normalized}_ids`] = relData.map(r => r.id);
      } catch (err) {
        console.error(`  ✗ ${key}: ${err.message}`);
      }
    }
    totalRelationsFetched += stepRels;
    step.relations_resolved = Object.keys(relationProps).length;

    // Normalize single-element arrays to strings for common fields

    const elapsed = Date.now() - startTime;
    console.log(`  📊 Progress: ${i+1}/${stepMetaList.length} steps, ${totalRelationsFetched} total relations (~${(elapsed/1000).toFixed(1)}s)`);
  }

  // Save
  const outputData = {
    metadata: {
      extracted_at: new Date().toISOString(),
      total_steps: steps.length,
      source: 'The Octave of Evolution Notion Database',
      database_id: DATABASE_ID,
      data_source_id: DATA_SOURCE_ID,
      relations_resolved: totalRelationsFetched,
      notes: 'All properties captured generically; all relations resolved to display values'
    },
    steps: steps
  };

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(outputData, null, 2));
  console.log(`\n✅ Complete truth data saved to: ${OUTPUT_PATH}`);
  console.log(`📊 Summary: ${steps.length} steps, ${totalRelationsFetched} relations, ${((Date.now()-startTime)/1000).toFixed(1)}s`);

  // Sample verification
  console.log('\n🔎 Sample Step 1 fields:');
  const s1 = steps[0];
  for (const key of ['name','act','intent','element','color','chakra','season','direction','tarot','gurdjieff','greek_love','persuasion','qualities','note','mantra','order','quality','realm','sense','step','aspect','aura','early_season','early_direction','late_direction','later_season','loveform_greek','major_arcana','tarot_elements','tarot_themes','hermetic_principle','dimensional_trinities','sacred_bodies','stories_of_deep_well','vedic_pantheon','bagua','dimension','timespace']) {
    if (s1[key] !== undefined) {
      const val = Array.isArray(s1[key]) ? s1[key].slice(0,2).join(', ') : String(s1[key]);
      console.log(`  ${key}: ${val}`);
    }
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
