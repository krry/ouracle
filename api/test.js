// Ouracle Engine — Test Harness
// Runs seeker voices through the full inference chain without a server.
// Usage: node test.js
// Add cases to SEEKER_CASES at the bottom.

import {
  inferVagalState,
  inferBelief,
  inferQuality,
  buildPrescription,
  auditLoveFear,
} from './engine.js';

// ─────────────────────────────────────────────
// RUNNER
// ─────────────────────────────────────────────

function runCase(c) {
  const vagal   = inferVagalState(c.text);
  const belief  = inferBelief(c.text);
  const quality = inferQuality(c.text);
  const presc   = buildPrescription(vagal.probable, belief, quality);

  const conf = x => x === 'high' ? '●●●' : x === 'medium' ? '●●○' : '●○○';

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`▸ ${c.label}`);
  console.log(`  "${c.text.slice(0, 80)}${c.text.length > 80 ? '…' : ''}"`);
  console.log(`${'─'.repeat(60)}`);
  console.log(`  vagal    ${conf(vagal.confidence)}  ${vagal.probable}`);
  console.log(`  belief   ${conf(belief.confidence)}  ${belief.pattern ?? 'none'}`);
  console.log(`  quality  ${conf(quality.confidence)}  ${quality.quality ?? 'none'}  ${quality.seeker_language ? `→ "${quality.seeker_language}"` : ''}`);
  console.log(`  rite     ${presc.rite?.rite_name ?? 'none'}`);
  console.log(`  l/f      ${presc.love_fear_audit.orientation}  (love:${presc.love_fear_audit.love_score} fear:${presc.love_fear_audit.fear_score})`);

  if (presc.flagged) {
    console.log(`  ⚠ FLAGGED: ${presc.note}`);
  }

  // Surface mismatches between expected and actual (if expectations set)
  const mismatches = [];
  if (c.expect?.vagal   && vagal.probable   !== c.expect.vagal)   mismatches.push(`vagal: expected ${c.expect.vagal}, got ${vagal.probable}`);
  if (c.expect?.belief  && belief.pattern   !== c.expect.belief)  mismatches.push(`belief: expected ${c.expect.belief}, got ${belief.pattern}`);
  if (c.expect?.quality && quality.quality  !== c.expect.quality) mismatches.push(`quality: expected ${c.expect.quality}, got ${quality.quality}`);
  if (c.expect?.rite    && presc.rite?.rite_name !== c.expect.rite) mismatches.push(`rite: expected ${c.expect.rite}, got ${presc.rite?.rite_name}`);

  if (mismatches.length) {
    console.log(`  ✗ MISMATCH:`);
    mismatches.forEach(m => console.log(`    - ${m}`));
  } else if (c.expect) {
    console.log(`  ✓ all expectations met`);
  }
}

// ─────────────────────────────────────────────
// SEEKER CASES
// Each case is a snapshot of what a Seeker might say across
// one or more inquiry turns (concatenated as fullText).
//
// Fields:
//   label   — short name for this voice
//   text    — what the Seeker said (full inquiry text)
//   expect  — optional: what we expect the engine to infer
//             { vagal, belief, quality, rite }
//             When set, mismatches surface as failures.
//
// ADD YOUR OWN CASES BELOW THE SEEDED ONES.
// ─────────────────────────────────────────────

const SEEKER_CASES = [

  // ── Seeded cases ──────────────────────────────────────

  {
    label: 'shutdown + isolation',
    text: "I've been carrying this alone for two years. I can't ask anyone for help. I feel frozen, numb.",
    expect: {
      vagal: 'dorsal',
      belief: 'isolation',
      rite: 'The Grounding', // dorsal → grounding first
    },
  },

  {
    label: 'anxious + scarcity',
    text: "I'm terrified there's not enough time. Running out of runway, running out of money. I can't stop checking. I'm hoarding every bit of energy I have left.",
    expect: {
      vagal: 'sympathetic',
      belief: 'scarcity',
      rite: 'The Release',
    },
  },

  {
    label: 'open + control',
    text: "Things feel pretty good honestly. But I notice I have to do everything myself. I don't trust that anyone else can manage it. Even when I'm calm I'm still orchestrating.",
    expect: {
      vagal: 'ventral',
      belief: 'control',
      rite: 'The Surrender',
    },
  },

  {
    label: 'crisis + separation',
    text: "Everything I built just fell apart. I give up trying to hold it. I don't belong anywhere. I'm separate from everything that used to matter.",
    expect: {
      vagal: 'sympathetic',
      belief: 'separation',
      quality: 'calamity',
      rite: 'The Belonging',
    },
  },

  {
    label: 'ambiguous — low signal',
    text: "I don't know. Something feels off but I can't name it. Just here I guess.",
    // No expect — testing that low-confidence returns gracefully
  },

  // ── Chef's cases ──────────────────────────────────────
  // Add real seeker voices here. The more varied the better.
  // Tricky cases, edge cases, and cases where you suspect
  // the engine is hearing wrong are especially valuable.

];

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────

console.log(`\nOuracle Engine — Test Harness`);
console.log(`${SEEKER_CASES.length} cases\n`);

SEEKER_CASES.forEach(runCase);

console.log(`\n${'─'.repeat(60)}\n`);
