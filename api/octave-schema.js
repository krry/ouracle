import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, 'data', 'octave-schema.json');
const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

export const OCTAVE_SCHEMA = schema;

export function getOctaveByQuality(quality) {
  return OCTAVE_SCHEMA.find((entry) => entry.quality === quality) || null;
}

export function listOctaveQualities() {
  return OCTAVE_SCHEMA.map((entry) => entry.quality).filter(Boolean);
}
