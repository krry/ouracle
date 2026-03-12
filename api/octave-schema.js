import schema from './data/octave-schema.json' assert { type: 'json' };

export const OCTAVE_SCHEMA = schema;

export function getOctaveByQuality(quality) {
  return OCTAVE_SCHEMA.find((entry) => entry.quality === quality) || null;
}

export function listOctaveQualities() {
  return OCTAVE_SCHEMA.map((entry) => entry.quality).filter(Boolean);
}
