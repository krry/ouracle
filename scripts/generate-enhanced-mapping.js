#!/usr/bin/env node

/**
 * Generate octave-mapping-enhanced.json from truth data
 * Uses actual Notion data plus derived visual/audio themes
 */

const fs = require('fs').promises;
const path = require('path');

const TRUTH_PATH = path.join(__dirname, '../data/octave-steps-truth.json');
const OUTPUT_PATH = path.join(__dirname, '../data/octave-mapping-enhanced.json');

// Color name to hex approximate mapping for Aura colors
const AURA_HEX = {
  white: '#FFFFFF',
  rainbow: '#FF00FF', // magenta as proxy
  orange: '#FFA500',
  black: '#000000',
  violet: '#EE82EE',
  green: '#008000',
  brown: '#964B00',
  blue: '#0000FF',
  yellow: '#FFFF00',
  red: '#FF0000',
  // fallback
  default: '#9370DB'
};

// Secondary color: complement or contrast
function getSecondary(primaryHex) {
  // Very simple: if light, use dark blue; if dark, use white
  const r = parseInt(primaryHex.slice(1, 3), 16);
  const g = parseInt(primaryHex.slice(3, 5), 16);
  const b = parseInt(primaryHex.slice(5, 7), 16);
  const brightness = (r*299 + g*587 + b*114) / 1000;
  return brightness > 128 ? '#000000' : '#FFFFFF';
}

// Particle type from element
const ELEMENT_PARTICLE = {
  Light: 'star',
  Charge: 'spark',
  Water: 'wave',
  Dark: 'void',
  Æther: 'swirl',
  Life: 'pulse',
  Stone: 'rock',
  Air: 'swirl',
  Fire: 'spark',
  Earth: 'particle'
};

// Animation from act/intent mapping (from prototype)
const ANIMATION_MAP = {
  shock: 'pulse',
  intend: 'flow',
  know: 'gentle_pulse',
  improve: 'rising',
  create: 'expand',
  feel: 'breathe',
  have: 'float',
  surrender: 'settle',
  fall: 'fall',
  envision: 'visualize',
  think: 'thought',
  listen: 'reverberate',
  live: 'flow',
  complete: 'settle',
  return: 'merge',
  say: 'vibrate',
  sing: 'resonate',
  make: 'build',
  dance: 'spin',
  sit: 'still',
  be: 'presence'
};

// Just intonation C major scale with C4 = 264 Hz (pure ratios)
// C4=264, D4=297, E4=330, F4=352, G4=396, A4=440, B4=495, C5=528, D5=594, E5=660
const STEP_NOTES = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C', 'D', 'E'];
const JUST_HZ = [264, 297, 330, 352, 396, 440, 495, 528, 594, 660];

// Ambient sounds from element
const ELEMENT_AMBIENT = {
  Fire: 'fire_crackle',
  Water: 'water_flow',
  Air: 'gentle_breeze',
  Earth: 'earth_hum',
  Light: 'ethereal_space',
  Dark: 'atmospheric_drone',
  Charge: 'electrical_hum',
  Æther: 'cosmic_drone',
  Life: 'biological_swarm',
  Stone: 'stone_rubbing'
};

async function main() {
  const truth = JSON.parse(await fs.readFile(TRUTH_PATH, 'utf8'));
  const steps = truth.steps;

  const enhancedSteps = steps.map(step => {
    const auraName = (step.aura || '').toLowerCase();
    const primary = AURA_HEX[auraName] || AURA_HEX.default;
    const secondary = getSecondary(primary);
    const particle = ELEMENT_PARTICLE[step.element] || 'particle';
    // Derive animation from act or intent
    const act = step.act || '';
    const intent = step.intent || '';
    const animKey = ANIMATION_MAP[act] || ANIMATION_MAP[intent] || 'gentle_pulse';
    // Gradient
    const gradient = `linear-gradient(135deg, ${primary}33, ${secondary}66)`;
    // Note from step number (just intonation Hz)
    const note = STEP_NOTES[step.number - 1] || 'C';
    const frequency = JUST_HZ[step.number - 1] || 264;
    // Ambient from element
    const ambient = ELEMENT_AMBIENT[step.element] || 'minimal_drone';

    const visualTheme = {
      primary,
      secondary,
      particle,
      animation: animKey,
      gradient
    };

    const audioProfile = {
      voice: 'ONDREA',
      voiceId: 'd8df024d9f604cccb4426f28fd08bbc4',
      ambient,
      frequency: note,
      frequencyHertz: frequency,
      intensity: 5
    };

    // Return enhanced step: include all truth fields plus themes
    return {
      ...step, // spreads all properties from truth
      visualTheme,
      audioProfile
    };
  });

  const output = {
    metadata: {
      ...truth.metadata,
      mapping_version: '2.0.0',
      built_at: new Date().toISOString(),
      notes: 'Enhanced mapping generated from resolved truth data with derived visual/audio themes'
    },
    steps: enhancedSteps
  };

  await fs.writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`✅ Enhanced mapping saved: ${OUTPUT_PATH}`);

  // Preview first step
  console.log('\n🔎 Preview Step 1:');
  const s1 = enhancedSteps[0];
  console.log(`  name: ${s1.name}`);
  console.log(`  element: ${s1.element} | chakra: ${s1.chakra} | aura: ${s1.aura}`);
  console.log(`  visualTheme: ${JSON.stringify(s1.visualTheme)}`);
  console.log(`  audioProfile: ${JSON.stringify(s1.audioProfile)}`);
}

if (require.main === module) main();
