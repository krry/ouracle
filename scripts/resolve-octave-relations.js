#!/usr/bin/env node

/**
 * Octave Relation Resolver
 * Takes raw octave-steps.json and resolves all relation properties
 * by fetching linked pages from Notion
 */

const fs = require('fs').promises;
const path = require('path');

// Configuration
const NOTION_API_KEY = process.env.NOTION_API_KEY;
const DATA_PATH = path.join(__dirname, '../data/octave-steps.json');
const OUTPUT_PATH = path.join(__dirname, '../data/octave-steps-truth.json');

// Rate limiting: delay between requests (ms)
const REQUEST_DELAY = 200; // 5 requests per second max
const MAX_CONCURRENT = 5; // Max parallel fetches

// In-memory cache to avoid re-fetching same page
const pageCache = new Map();

/**
 * Rate-limited fetch wrapper with retry
 */
async function fetchWithRetry(url, options = {}, retries = 3) {
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await delay(attempt > 1 ? 200 * attempt : 0); // Exponential backoff on retries
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
        const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10);
        console.log(`⏳ Rate limited, waiting ${retryAfter}s...`);
        await delay(retryAfter * 1000);
        continue; // retry
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText}\n${text}`);
      }

      return await response.json();
    } catch (error) {
      if (attempt === retries) throw error;
      console.log(`⚠️ Request failed (attempt ${attempt}/${retries}): ${error.message}`);
    }
  }
}

/**
 * Fetch a single Notion page by ID with caching
 */
async function fetchPage(pageId) {
  if (pageCache.has(pageId)) {
    return pageCache.get(pageId);
  }

  await new Promise(resolve => setTimeout(resolve, REQUEST_DELAY));

  const url = `https://api.notion.com/v1/pages/${pageId}`;
  const data = await fetchWithRetry(url, { method: 'GET' });
  pageCache.set(pageId, data);
  return data;
}

/**
 * Extract display value from a page
 * Tries common properties: 'title', 'name', 'Name', then falls back to first title field
 */
function extractPageDisplayValue(page) {
  const props = page.properties || {};

  // Try explicit name properties
  for (const key of ['name', 'Name', 'title', 'Title']) {
    if (props[key]) {
      const titleProp = props[key].title;
      if (titleProp && titleProp.length > 0 && titleProp[0].plain_text) {
        return titleProp[0].plain_text;
      }
    }
  }

  // Fallback: first available title property
  for (const prop of Object.values(props)) {
    if (prop.title && prop.title.length > 0 && prop.title[0].plain_text) {
      return prop.title[0].plain_text;
    }
  }

  return `[Page ${page.id.slice(0, 8)}]`;
}

/**
 * Resolve a relation property to its linked page value(s)
 * @param {Object} step - The step object containing properties
 * @param {string} propName - Property name to resolve
 * @param {boolean} isMulti - Whether this is a multi-relation (array)
 * @returns {Promise<string|string[]>|null> - Resolved value(s)
 */
async function resolveRelation(step, propName, isMulti = false) {
  const prop = step.properties[propName];
  if (!prop) return isMulti ? [] : null;

  const relationData = prop.relation;
  if (!relationData) return isMulti ? [] : null;

  if (isMulti) {
    // Multi-relation: array of linked pages
    const linkedIds = relationData.map(r => r.id);
    if (linkedIds.length === 0) return [];

    // Fetch all linked pages in parallel (with concurrency limit)
    const chunks = [];
    for (let i = 0; i < linkedIds.length; i += MAX_CONCURRENT) {
      chunks.push(linkedIds.slice(i, i + MAX_CONCURRENT));
    }

    const results = [];
    for (const chunk of chunks) {
      const pages = await Promise.all(chunk.map(id => fetchPage(id).catch(err => {
        console.error(`❌ Failed to fetch page ${id}: ${err.message}`);
        return null;
      })));
      results.push(...pages.filter(Boolean));
    }

    return results.map(extractPageDisplayValue);
  } else {
    // Single relation
    if (relationData.length === 0) return null;
    const linkedId = relationData[0].id;
    const page = await fetchPage(linkedId);
    return page ? extractPageDisplayValue(page) : null;
  }
}

/**
 * Main resolution function
 */
async function resolveOctaveRelations() {
  try {
    // Check for API key
    if (!NOTION_API_KEY) {
      console.error('❌ NOTION_API_KEY environment variable not set');
      process.exit(1);
    }

    console.log('🌌 Loading raw octave steps data...');
    const rawData = JSON.parse(await fs.readFile(DATA_PATH, 'utf8'));
    const steps = rawData.steps;

    console.log(`🔧 Resolving relations for ${steps.length} steps...`);
    const startTime = Date.now();

    let totalRelationsFetched = 0;

    // Process each step
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      console.log(`\n📘 Step ${step.number}: ${step.name} (${step.id})`);

      const properties = step.properties || {};
      const resolved = {};

      // Identify relation properties
      for (const [propName, prop] of Object.entries(properties)) {
        if (prop.relation) {
          const isMulti = Array.isArray(prop.relation) && prop.relation.length > 0 && prop.relation[0].id;
          const relationCount = isMulti ? prop.relation.length : (prop.relation[0]?.id ? 1 : 0);

          try {
            const value = await resolveRelation(step, propName, isMulti);
            if (isMulti) {
              resolved[propName] = value;
              totalRelationsFetched += value.length;
              console.log(`  ✓ ${propName}: ${value.length} items`);
            } else {
              resolved[propName] = value;
              if (value) totalRelationsFetched++;
              console.log(`  ✓ ${propName}: ${value || '(empty)'}`);
            }
          } catch (err) {
            console.error(`  ✗ ${propName}: ${err.message}`);
            resolved[propName] = isMulti ? [] : null;
          }
        }
      }

      // Add resolved relations to step object
      step.relations_resolved = Object.keys(resolved).length;
      step.relations_data = resolved;

      // Also add backfilled top-level properties for convenience
      // These will overwrite any existing properties with resolved values
      for (const [key, value] of Object.entries(resolved)) {
        // Convert property names to lowercase for consistency with existing schema
        const normalizedKey = key.toLowerCase().replace(/\s+/g, '_');
        step[normalizedKey] = value;
      }

      // Progress update
      const elapsed = Date.now() - startTime;
      console.log(`  📊 Progress: ${i + 1}/${steps.length} steps, ${totalRelationsFetched} relations (~${(elapsed/1000).toFixed(1)}s)`);
    }

    // Build final output
    const outputData = {
      metadata: {
        extracted_at: new Date().toISOString(),
        total_steps: steps.length,
        source: 'The Octave of Evolution Notion Database',
        database_id: rawData.metadata?.database_id || '2c5f600c4dd44cfd87f03cac143d9139',
        data_source_id: rawData.metadata?.data_source_id || 'f32bad00-1b18-4e19-ad98-f8801433f160',
        relations_resolved: totalRelationsFetched,
        notes: 'All relation properties have been fetched and resolved to display values'
      },
      steps: steps
    };

    // Validate
    console.log('\n🔍 Validation:');
    let missingCount = 0;
    for (const step of steps) {
      const stepNum = step.number;
      // Check critical properties
      const critical = ['element', 'chakra', 'note'];
      for (const prop of critical) {
        if (!step[prop] || (Array.isArray(step[prop]) && step[prop].length === 0)) {
          console.log(`  ⚠️ Step ${stepNum} missing: ${prop}`);
          missingCount++;
        }
      }
    }
    if (missingCount === 0) {
      console.log('  ✅ All steps have required properties!');
    } else {
      console.log(`  ⚠️ ${missingCount} missing critical properties`);
    }

    // Save to file
    await fs.writeFile(OUTPUT_PATH, JSON.stringify(outputData, null, 2));
    console.log(`\n✅ Truth data saved to: ${OUTPUT_PATH}`);
    console.log(`📊 Summary:`);
    console.log(`   - Total steps: ${steps.length}`);
    console.log(`   - Relations fetched: ${totalRelationsFetched}`);
    console.log(`   - Total time: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

    return outputData;

  } catch (error) {
    console.error('💥 Octave relation resolution failed:', error.message);
    process.exit(1);
  }
}

// Run
if (require.main === module) {
  resolveOctaveRelations();
}

module.exports = { resolveOctaveRelations };
