#!/usr/bin/env node

/**
 * Octave Mapping Builder
 * Enriches extracted data with wisdom tradition mappings
 */

const fs = require('fs').promises;
const path = require('path');

// Enhanced octave mapping with wisdom traditions
const WISDOM_MAPPINGS = {
  // Step 1: Shock
  1: {
    name: "The Shock",
    act: "shock", 
    intent: "improve",
    element: "Fire",
    color: "#FF4500",  // Orange-Red
    chakra: "Root",
    sound: "C",        // C note
    season: "Spring",
    direction: "North",
    greekLove: "Eros",  // Passionate love
    persuasion: "Pathos",  // Emotional appeal
    energyLevel: 8,
    visualTheme: {
      primary: "#FF4500",
      secondary: "#FFD700",
      particle: "spark",
      animation: "pulse"
    },
    audioProfile: {
      voice: "ONDREA",  // Intense, dramatic
      ambient: "fire_crackle",
      frequency: 261.63  // Middle C
    }
  },
  
  // Step 2: Intend
  2: {
    name: "The Intention",
    act: "intend",
    intent: "know",
    element: "Water", 
    color: "#4169E1",  // Royal Blue
    chakra: "Sacral",
    sound: "D",
    season: "Summer",
    direction: "West", 
    greekLove: "Philia",  // Friendship love
    persuasion: "Logos",  // Logical appeal
    energyLevel: 6,
    visualTheme: {
      primary: "#4169E1",
      secondary: "#87CEEB",
      particle: "wave",
      animation: "flow"
    },
    audioProfile: {
      voice: "GALADRIEL",  // Calm, flowing
      ambient: "water_flow",
      frequency: 293.66  // D note
    }
  },
  
  // Step 3: (Continue pattern...)
  3: {
    name: "The Transformation",
    act: "transform",
    intent: "create",
    element: "Air",
    color: "#32CD32",  // Lime Green
    chakra: "Solar Plexus",
    sound: "E",
    season: "Autumn",
    direction: "East",
    greekLove: "Agape",  // Universal love
    persuasion: "Ethos",  // Character appeal
    energyLevel: 7,
    visualTheme: {
      primary: "#32CD32",
      secondary: "#98FB98",
      particle: "swirl",
      animation: "breeze"
    },
    audioProfile: {
      voice: "OPRAH",  // Warm, empowering
      ambient: "gentle_breeze",
      frequency: 329.63  // E note
    }
  }
  // ... Continue for all 10 steps
};

/**
 * Load extracted data and enhance with wisdom mappings
 */
async function buildOctaveMapping() {
  try {
    console.log('🔧 Building enhanced octave mapping...');
    
    // Load extracted data
    const dataPath = path.join(__dirname, '../data/octave-steps.json');
    const rawData = await fs.readFile(dataPath, 'utf8');
    const extractedData = JSON.parse(rawData);
    
    // Enhance with wisdom mappings
    const enhancedSteps = extractedData.steps.map((step, index) => {
      const stepNumber = index + 1;
      const wisdomMapping = WISDOM_MAPPINGS[stepNumber] || {};
      
      return {
        ...step,
        ...wisdomMapping,
        // Calculate energy based on act and intent
        energyLevel: calculateEnergyLevel(step.act, step.intent),
        // Generate visual themes
        visualTheme: generateVisualTheme(step, wisdomMapping),
        // Generate audio profiles  
        audioProfile: generateAudioProfile(step, wisdomMapping)
      };
    });
    
    const enhancedData = {
      ...extractedData,
      steps: enhancedSteps,
      mapping_version: "1.0.0",
      built_at: new Date().toISOString(),
      wisdom_traditions: [
        "Gurdjieff's Octaves",
        "Yogic Chakras", 
        "Elemental Magic",
        "Greek Forms of Love",
        "Musical Theory",
        "Color Therapy",
        "Seasonal Cycles",
        "Directional Energies"
      ]
    };
    
    // Save enhanced mapping
    const outputPath = path.join(__dirname, '../data/octave-mapping-enhanced.json');
    await fs.writeFile(outputPath, JSON.stringify(enhancedData, null, 2));
    
    console.log(`✅ Enhanced octave mapping saved: ${outputPath}`);
    console.log(`🎨 Mapped ${enhancedSteps.length} steps with wisdom traditions`);
    
    return enhancedData;
    
  } catch (error) {
    console.error('❌ Error building octave mapping:', error.message);
    throw error;
  }
}

/**
 * Calculate energy level based on act and intent
 */
function calculateEnergyLevel(act, intent) {
  const energyMap = {
    shock: 9,
    intend: 6,
    transform: 8,
    create: 7,
    know: 5,
    improve: 7,
    connect: 6,
    transcend: 9,
    integrate: 8,
    complete: 10
  };
  
  return energyMap[act] || 5;
}

/**
 * Generate visual theme for each step
 */
function generateVisualTheme(step, wisdom) {
  const baseColors = {
    Fire: { primary: "#FF4500", secondary: "#FFD700" },
    Water: { primary: "#4169E1", secondary: "#87CEEB" },
    Earth: { primary: "#8B4513", secondary: "#DEB887" },
    Air: { primary: "#32CD32", secondary: "#98FB98" },
    Ether: { primary: "#9370DB", secondary: "#DDA0DD" }
  };
  
  const element = wisdom.element || "Ether";
  const colors = baseColors[element] || baseColors.Ether;
  
  return {
    primary: colors.primary,
    secondary: colors.secondary,
    particle: getParticleType(element),
    animation: getAnimationType(wisdom.intent || step.intent),
    gradient: `linear-gradient(135deg, ${colors.primary}33, ${colors.secondary}66)`
  };
}

/**
 * Generate audio profile for each step  
 */
function generateAudioProfile(step, wisdom) {
  const voiceMap = {
   ONDREA: "d8df024d9f604cccb4426f28fd08bbc4",
    GALADRIEL: "d5b8b4743e234a61af0918309cd11406", 
    OPRAH: "f40cb0fac3f24cc3bf4a0ba3ea1f7ca0"
  };
  
  const ambientMap = {
    Fire: "fire_crackle",
    Water: "water_flow", 
    Earth: "earth_hum",
    Air: "gentle_breeze",
    Ether: "ethereal_space"
  };
  
  const element = wisdom.element || "Ether";
  
  return {
    voice: wisdom.voice || "ONDREA",
    voiceId: voiceMap[wisdom.voice] || voiceMap.ONDREA,
    ambient: ambientMap[element] || ambientMap.Ether,
    frequency: wisdom.sound || "440", // Default A note
    intensity: wisdom.energyLevel || 5
  };
}

/**
 * Get particle type for element
 */
function getParticleType(element) {
  const particleMap = {
    Fire: "spark",
    Water: "wave", 
    Earth: "particle",
    Air: "swirl",
    Ether: "star"
  };
  return particleMap[element] || "star";
}

/**
 * Get animation type based on intent
 */
function getAnimationType(intent) {
  const animationMap = {
    shock: "pulse",
    intend: "flow",
    know: "gentle_pulse",
    improve: "rising",
    create: "expand",
    connect: "converge",
    transcend: "dissolve",
    integrate: "merge",
    complete: "settle"
  };
  return animationMap[intent] || "gentle_pulse";
}

// Main execution
if (require.main === module) {
  buildOctaveMapping()
    .then(() => {
      console.log('🎉 Octave mapping enhancement complete!');
    })
    .catch(error => {
      console.error('💥 Octave mapping failed:', error.message);
      process.exit(1);
    });
}

module.exports = { buildOctaveMapping };