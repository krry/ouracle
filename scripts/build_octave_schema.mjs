import fs from 'fs';
import path from 'path';

const SOURCE_DIR = 'research/ExportBlock-7df11376-0ef4-4fdb-a8eb-36ad989d4ffb-Part-1';
const OUT_FILE = 'api/data/octave-schema.json';

const FILES = [
  'Step 1 ed190360d0084dcd8f333198a198c41d.md',
  'Step 2 41950383183249debe77926aa251200e.md',
  'Step 3 d5f972db63aa465d99844dbe04bfc2a8.md',
  'Step 4 91828741a5bd427abd83dd79ab59de30.md',
  'Break 4 5 241d833af1e24ad6bf88565ff731c374.md',
  'Step 5 ad67951735a34009b12e2edf3cd65a32.md',
  'Step 6 75b794532f444365bc14e6e551a547ce.md',
  'Step 7 27d1695c3849469986817447da4a0027.md',
  'Crisis 7 8 6484f8fe68be44519ec09add634e6006.md',
  'Step 8 0 93e88e93f73e47a7ae8dbed948c250ee.md',
];

function stripMarkdown(text) {
  return text
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[[^\]]*\]\([^)]*\)/g, (m) => {
      const match = /\[([^\]]*)\]/.exec(m);
      return match ? match[1] : '';
    })
    .replace(/[`*_>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseMetadata(lines) {
  const meta = {};
  let started = false;
  for (const line of lines) {
    if (!line.trim() && !started) continue;
    if (!line.trim() && started) break;
    started = true;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!key) continue;
    meta[key] = value;
  }
  return meta;
}

function extractSection(lines, heading) {
  const header = `## ${heading}`;
  const start = lines.findIndex((l) => l.trim() === header);
  if (start === -1) return [];
  const section = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('## ')) break;
    section.push(line);
  }
  return section;
}

function firstParagraph(lines) {
  const collected = [];
  for (const line of lines) {
    if (!line.trim()) break;
    collected.push(line);
  }
  return stripMarkdown(collected.join(' '));
}

function bulletLines(lines) {
  return lines
    .filter((l) => l.trim().startsWith('- '))
    .map((l) => stripMarkdown(l.replace(/^\s*-\s*/, '')))
    .filter(Boolean);
}

function parseFile(fileName) {
  const filePath = path.join(SOURCE_DIR, fileName);
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);

  const meta = parseMetadata(lines.slice(1));
  const poetics = firstParagraph(extractSection(lines, 'Poetics'));
  const themes = bulletLines(extractSection(lines, 'Themes'));
  const symbols = bulletLines(extractSection(lines, 'Symbols'));

  const tarotThemes = meta['Tarot Themes']
    ? meta['Tarot Themes'].split(',').map((t) => t.trim()).filter(Boolean)
    : [];

  const signatureParts = [
    meta['Quality'],
    meta['Theme'],
    meta['Intent'],
    meta['Act'],
    meta['Realm'],
    poetics,
    ...themes,
    ...symbols,
    ...tarotThemes,
  ].filter(Boolean);

  return {
    name: lines[0].replace(/^#\s+/, '').trim(),
    note: meta['Note'] || null,
    order: meta['Order'] ? Number(meta['Order']) : null,
    quality: meta['Quality'] || null,
    theme: meta['Theme'] || null,
    intent: meta['Intent'] || null,
    act: meta['Act'] || null,
    realm: meta['Realm'] || null,
    shock: meta['Note']?.startsWith('shock') || meta['Quality'] === 'pity' || meta['Quality'] === 'calamity',
    tarot_themes: tarotThemes,
    signature_text: stripMarkdown(signatureParts.join(' | ')),
  };
}

const schema = FILES.map(parseFile);

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(schema, null, 2));
console.log(`Wrote ${OUT_FILE}`);
