#!/usr/bin/env node

/**
 * Octave Data Extraction Script
 * Extracts data from The Octave of Evolution Notion database
 */

const fs = require('fs').promises;
const path = require('path');

// Configuration
const OCTAVE_DB_ID = '2c5f600c4dd44cfd87f03cac143d9139';
 const DATA_SOURCE_ID = 'f32bad00-1b18-4e19-ad98-f8801433f160';
const OUTPUT_PATH = path.join(__dirname, '../data/octave-steps.json');

// Notion API Headers
const getHeaders = () => ({
  'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
  'Notion-Version': '2025-09-03',
  'Content-Type': 'application/json'
});

/**
 * Fetch all octave steps from the Notion database
 */
async function fetchOctaveSteps() {
  try {
    console.log('🌌 Fetching octave steps from Notion database...');
    
    // Query the database
    const response = await fetch(`https://api.notion.com/v1/data_sources/${DATA_SOURCE_ID}/query`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({})
    });

    if (!response.ok) {
      throw new Error(`Notion API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const results = data.results || [];

    console.log(`✅ Found ${results.length} octave steps`);

    // Process each step
    const octaveSteps = results.map((step, index) => {
      const properties = step.properties || {};
      
      return {
        id: step.id,
        number: index + 1,
        name: extractProperty(properties, 'title', 'Name') || extractProperty(properties, 'title', 'title') || `Step ${index + 1}`,
        act: extractProperty(properties, 'rich_text', 'Act') || '',
        element: extractProperty(properties, 'select', 'Element')?.name || '',
        color: extractProperty(properties, 'select', 'Color')?.name || '',
        chakra: extractProperty(properties, 'select', 'Chakra')?.name || '',
        sense: extractProperty(properties, 'select', 'Sense')?.name || '',
        intent: extractProperty(properties, 'rich_text', 'Intent') || '',
        tarot: extractProperty(properties, 'select', 'Tarot')?.name || '',
        season: extractProperty(properties, 'select', 'Season')?.name || '',
        direction: extractProperty(properties, 'select', 'Direction')?.name || '',
        gurdjieff: extractProperty(properties, 'rich_text', 'Gurdjieff') || '',
        greek_love: extractProperty(properties, 'select', 'Greek Love')?.name || '',
        action: extractProperty(properties, 'rich_text', 'Act') || '',
        persuasion: extractProperty(properties, 'select', 'Persuasion')?.name || '',
        qualities: extractMultiSelect(properties, 'multi_select', 'Qualities') || [],
        description: extractProperty(properties, 'rich_text', 'Description') || '',
        created_time: step.created_time,
        last_edited_time: step.last_edited_time
      };
    });

    return octaveSteps;
  } catch (error) {
    console.error('❌ Error fetching octave steps:', error.message);
    throw error;
  }
}

/**
 * Extract property value based on type
 */
function extractProperty(properties, type, propertyName) {
  const prop = properties[propertyName];
  if (!prop) return null;

  switch (type) {
    case 'title':
      return prop.title?.[0]?.text?.content;
    case 'rich_text':
      return prop.rich_text?.[0]?.text?.content;
    case 'select':
      return prop.select;
    case 'date':
      return prop.date;
    case 'number':
      return prop.number;
    case 'relation':
      return prop.relation;
    case 'rollup':
      return prop.rollup;
    default:
      return null;
  }
}

/**
 * Extract multi-select values
 */
function extractMultiSelect(properties, type, propertyName) {
  const prop = properties[propertyName];
  if (!prop) return [];

  switch (type) {
    case 'multi_select':
      return prop.multi_select?.map(item => item.name) || [];
    default:
      return [];
  }
}

/**
 * Save extracted data to file
 */
async function saveOctaveData(octaveSteps) {
  try {
    // Ensure data directory exists
    await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });

    // Add metadata
    const outputData = {
      metadata: {
        extracted_at: new Date().toISOString(),
        total_steps: octaveSteps.length,
        source: 'The Octave of Evolution Notion Database',
        database_id: OCTAVE_DB_ID,
        data_source_id: DATA_SOURCE_ID
      },
      steps: octaveSteps
    };

    // Write to file
    await fs.writeFile(OUTPUT_PATH, JSON.stringify(outputData, null, 2));
    console.log(`✅ Octave data saved to: ${OUTPUT_PATH}`);
    
    // Log summary
    console.log('\n📊 Summary:');
    console.log(`- Total steps: ${octaveSteps.length}`);
    console.log(`- Elements: ${[...new Set(octaveSteps.map(s => s.element).filter(Boolean))].join(', ')}`);
    console.log(`- Colors: ${[...new Set(octaveSteps.map(s => s.color).filter(Boolean))].join(', ')}`);
    console.log(`- Chakras: ${[...new Set(octaveSteps.map(s => s.chakra).filter(Boolean))].join(', ')}`);
    
    return outputData;
  } catch (error) {
    console.error('❌ Error saving octave data:', error.message);
    throw error;
  }
}

/**
 * Main extraction function
 */
async function main() {
  try {
    // Check for API key
    if (!process.env.NOTION_API_KEY) {
      console.error('❌ NOTION_API_KEY environment variable not set');
      process.exit(1);
    }

    console.log('🚀 Starting Octave Data Extraction...\n');

    // Fetch and save data
    const octaveSteps = await fetchOctaveSteps();
    const outputData = await saveOctaveData(octaveSteps);

    console.log('\n🎉 Octave data extraction completed successfully!');
    return outputData;

  } catch (error) {
    console.error('💥 Octave data extraction failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { fetchOctaveSteps, saveOctaveData };