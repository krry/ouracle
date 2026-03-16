/**
 * ambientEngine.ts — generative Web Audio ambient engine
 *
 * Each scene is a stack of filtered noise bands + optional sine drones,
 * all modulated by slow LFOs so the soundscape breathes and shifts.
 * Reverb is synthesized (exponentially decaying noise IR) — no audio files.
 */

import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type SceneId =
  | 'drizzle' | 'storm'     | 'river'  | 'wind'
  | 'leaves'  | 'fire'      | 'asmr'   | 'bowls'
  | 'earth'   | 'drone'     | 'ocean'  | 'desert'
  | 'waterfall'| 'night'    | 'jungle';

export const SCENES: { id: SceneId; label: string }[] = [
  { id: 'drizzle',   label: 'drizzle'   },
  { id: 'storm',     label: 'storm'     },
  { id: 'river',     label: 'river'     },
  { id: 'ocean',     label: 'ocean'     },
  { id: 'waterfall', label: 'waterfall' },
  { id: 'wind',      label: 'wind'      },
  { id: 'desert',    label: 'desert'    },
  { id: 'leaves',    label: 'leaves'    },
  { id: 'night',     label: 'night'     },
  { id: 'jungle',    label: 'jungle'    },
  { id: 'fire',      label: 'fire'      },
  { id: 'asmr',      label: 'asmr'      },
  { id: 'bowls',     label: 'bowls'     },
  { id: 'earth',     label: 'earth'     },
  { id: 'drone',     label: 'drone'     },
];

// ── Stores ───────────────────────────────────────────────────────────────────

export const ambientRunning = writable(false);
export const ambientScene   = writable<SceneId>('drizzle');

// ── Engine state ─────────────────────────────────────────────────────────────

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let liveOscillators: OscillatorNode[] = [];
let liveSources: AudioBufferSourceNode[] = [];

// ── Low-level helpers ─────────────────────────────────────────────────────────

function getCtx(): AudioContext {
  if (!ctx || ctx.state === 'closed') ctx = new AudioContext();
  return ctx;
}

/** Two-channel white noise buffer — slightly different per channel for stereo width. */
function makeNoiseBuf(ctx: AudioContext, seconds = 4): AudioBuffer {
  const frames = ctx.sampleRate * seconds;
  const buf = ctx.createBuffer(2, frames, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < frames; i++) d[i] = Math.random() * 2 - 1;
  }
  return buf;
}

/** Loop a noise buffer, randomising start point so layers don't phase-lock. */
function noiseSource(ctx: AudioContext, buf: AudioBuffer): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.loopStart = Math.random() * buf.duration;
  src.loopEnd = buf.duration;
  return src;
}

/**
 * Synthesised reverb — exponentially decaying noise impulse response.
 * duration (s): tail length. decay: steepness (higher = shorter perceived tail).
 */
function makeReverb(ctx: AudioContext, duration: number, decay: number): ConvolverNode {
  const conv = ctx.createConvolver();
  const len  = Math.floor(ctx.sampleRate * duration);
  const ir   = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++)
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  conv.buffer = ir;
  return conv;
}

/**
 * LFO — sine oscillator → gain → AudioParam.
 * hz: modulation rate. depth: amount added to target param.
 */
function lfo(
  ctx: AudioContext,
  hz: number,
  depth: number,
  target: AudioParam,
  phase = Math.random() * Math.PI * 2,
): OscillatorNode {
  const osc = ctx.createOscillator();
  const g   = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = hz;
  g.gain.value = depth;
  osc.connect(g);
  g.connect(target);
  // Stagger start time to set random phase without AudioWorklet
  osc.start(ctx.currentTime - phase / (Math.PI * 2 * hz));
  liveOscillators.push(osc);
  return osc;
}

/**
 * One filtered noise band: noise → filter → gain → dest.
 * Returns handles so callers can attach LFOs to filter.frequency or gain.gain.
 */
function noiseBand(
  ctx: AudioContext,
  buf: AudioBuffer,
  type: BiquadFilterType,
  freq: number,
  q: number,
  gainVal: number,
  dest: AudioNode,
): { filter: BiquadFilterNode; gain: GainNode } {
  const src    = noiseSource(ctx, buf);
  const filter = ctx.createBiquadFilter();
  const gain   = ctx.createGain();
  filter.type  = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  gain.gain.value = gainVal;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  src.start();
  liveSources.push(src);
  return { filter, gain };
}

// ── Scenes ────────────────────────────────────────────────────────────────────

/** Tin roof drizzle — delicate, each drop distinct. */
function buildDrizzle(ctx: AudioContext, master: GainNode) {
  const rev = makeReverb(ctx, 1.8, 3.5);
  rev.connect(master);

  // Thin metallic tap layer — the tin roof
  const tap = noiseBand(ctx, makeNoiseBuf(ctx, 3), 'bandpass', 2800, 1.5, 0.35, rev);
  lfo(ctx, 0.06, 0.08, tap.gain.gain);

  // Barrel resonance — hollow low thud of collected drops
  const barrel = noiseBand(ctx, makeNoiseBuf(ctx, 4), 'bandpass', 220, 2.0, 0.3, rev);
  lfo(ctx, 0.09, 30, barrel.filter.frequency);
  lfo(ctx, 0.05, 0.07, barrel.gain.gain);

  // Fine mist hiss
  const mist = noiseBand(ctx, makeNoiseBuf(ctx, 3), 'highpass', 7000, 0.4, 0.12, rev);
  lfo(ctx, 0.13, 0.04, mist.gain.gain);
}

/** Storm — heavy pour, distant thunder presence. */
function buildStorm(ctx: AudioContext, master: GainNode) {
  const rev = makeReverb(ctx, 2.5, 2.5);
  rev.connect(master);

  // Thunder sub-presence — felt more than heard
  const thunder = noiseBand(ctx, makeNoiseBuf(ctx, 6), 'lowpass', 90, 0.6, 0.55, rev);
  lfo(ctx, 0.02, 25, thunder.filter.frequency);
  lfo(ctx, 0.015, 0.18, thunder.gain.gain); // distant roll

  // Heavy rain body
  const pour = noiseBand(ctx, makeNoiseBuf(ctx, 4), 'bandpass', 1200, 0.5, 0.65, rev);
  lfo(ctx, 0.05, 0.09, pour.gain.gain);

  // Driving surface noise
  const drive = noiseBand(ctx, makeNoiseBuf(ctx, 3), 'highpass', 4500, 0.6, 0.25, rev);
  lfo(ctx, 0.08, 0.07, drive.gain.gain);
}

/** River rushing — perpetual, with gurgling depth. */
function buildRiver(ctx: AudioContext, master: GainNode) {
  const rev = makeReverb(ctx, 2.2, 3.5);
  rev.connect(master);

  const body = noiseBand(ctx, makeNoiseBuf(ctx, 5), 'lowpass', 380, 0.5, 0.5, rev);
  lfo(ctx, 0.05, 55, body.filter.frequency);

  const gurgle = noiseBand(ctx, makeNoiseBuf(ctx, 4), 'bandpass', 900, 1.0, 0.42, rev);
  lfo(ctx, 0.13, 160, gurgle.filter.frequency);
  lfo(ctx, 0.08, 0.06, gurgle.gain.gain);

  const surface = noiseBand(ctx, makeNoiseBuf(ctx, 3), 'bandpass', 3800, 0.7, 0.16, rev);
  lfo(ctx, 0.09, 0.05, surface.gain.gain);
}

/** Wind — breeze through curtains, open window, light and spacious. */
function buildWind(ctx: AudioContext, master: GainNode) {
  const rev = makeReverb(ctx, 3.5, 5);
  rev.connect(master);

  // Main breeze body — fabric moving
  const breeze = noiseBand(ctx, makeNoiseBuf(ctx, 6), 'bandpass', 480, 0.35, 0.42, rev);
  lfo(ctx, 0.022, 120, breeze.filter.frequency); // slow gust sweeps
  lfo(ctx, 0.035, 0.10, breeze.gain.gain);

  // Curtain flutter — higher, lighter
  const flutter = noiseBand(ctx, makeNoiseBuf(ctx, 4), 'bandpass', 2200, 0.9, 0.13, rev);
  lfo(ctx, 0.07, 0.07, flutter.gain.gain);

  // Distant open air — barely there sub-breath
  const air = noiseBand(ctx, makeNoiseBuf(ctx, 5), 'lowpass', 160, 0.5, 0.28, rev);
  lfo(ctx, 0.018, 18, air.filter.frequency);
}

/** Leaves — footsteps in moss, crunch, trees dancing. */
function buildLeaves(ctx: AudioContext, master: GainNode) {
  const rev = makeReverb(ctx, 1.5, 4);
  rev.connect(master);

  // Soft moss underfoot — low, absorbent
  const moss = noiseBand(ctx, makeNoiseBuf(ctx, 5), 'lowpass', 280, 0.6, 0.38, rev);
  lfo(ctx, 0.06, 40, moss.filter.frequency);

  // Leaf crunch — brittle, textured mid
  const crunch = noiseBand(ctx, makeNoiseBuf(ctx, 3), 'bandpass', 1800, 1.8, 0.32, rev);
  lfo(ctx, 0.22, 0.12, crunch.gain.gain); // faster flutter = crunchy randomness

  // Canopy shimmer — leaves dancing above
  const canopy = noiseBand(ctx, makeNoiseBuf(ctx, 4), 'bandpass', 4800, 2.0, 0.10, rev);
  lfo(ctx, 0.14, 0.06, canopy.gain.gain);
}

/**
 * Bowls — sacred Solfeggio frequencies, crystal bowls + gong.
 * 174 Hz: foundation/pain relief (gong root)
 * 396 Hz: liberation from fear
 * 528 Hz: transformation, the love frequency
 * 741 Hz: awakening intuition
 * 963 Hz: crown, divine consciousness (lightest shimmer)
 * Each split L/R with theta-range binaural beat for deep meditation.
 */
function buildBowls(ctx: AudioContext, master: GainNode) {
  const rev = makeReverb(ctx, 6, 6);
  rev.connect(master);

  // [hz, binauralBeatHz, gain, panWidth]
  const bowls: [number, number, number, number][] = [
    [174,  6,   0.30, 0.8],  // gong — deep, wide
    [396,  4,   0.22, 0.65],
    [528,  3.5, 0.20, 0.6],  // love frequency — centered
    [741,  4,   0.15, 0.7],
    [963,  5,   0.09, 0.75], // crown shimmer — barely there
  ];

  bowls.forEach(([hz, beat, gainVal, width], i) => {
    [-width, width].forEach((pan, ch) => {
      const osc    = ctx.createOscillator();
      const gain   = ctx.createGain();
      const panner = ctx.createStereoPanner();
      osc.type = 'sine';
      osc.frequency.value = hz + ch * beat;
      gain.gain.value = gainVal;
      panner.pan.value = pan;
      // Very slow pitch drift — bowl sustain waver
      lfo(ctx, 0.008 + i * 0.003, 0.6, osc.frequency);
      osc.connect(gain);
      gain.connect(panner);
      panner.connect(rev);
      osc.start();
      liveOscillators.push(osc);
    });
  });
}

/** Earth — crunchy static, grounded, mineral. */
function buildEarth(ctx: AudioContext, master: GainNode) {
  const rev = makeReverb(ctx, 1.2, 4);
  rev.connect(master);

  // Sub-earth presence — stone, weight
  const sub = noiseBand(ctx, makeNoiseBuf(ctx, 6), 'lowpass', 120, 0.7, 0.5, rev);
  lfo(ctx, 0.03, 15, sub.filter.frequency);

  // Crunchy static texture — the mineral grain
  const grain = noiseBand(ctx, makeNoiseBuf(ctx, 3), 'bandpass', 2600, 2.5, 0.28, rev);
  lfo(ctx, 0.28, 400, grain.filter.frequency); // fast sweep = crunch character
  lfo(ctx, 0.11, 0.09, grain.gain.gain);

  // Deep gravel resonance
  const gravel = noiseBand(ctx, makeNoiseBuf(ctx, 4), 'bandpass', 600, 1.2, 0.35, rev);
  lfo(ctx, 0.07, 0.07, gravel.gain.gain);
}

/**
 * Fire — fireplace crackling. Crackle lives in sharp transients:
 * fast LFO on a resonant bandpass sweeps through crinkle frequencies,
 * over a warm low-mid roar bed.
 */
function buildFire(ctx: AudioContext, master: GainNode) {
  const rev = makeReverb(ctx, 1.0, 3);
  rev.connect(master);

  // Warm roar — the fire body, slow breathing
  const roar = noiseBand(ctx, makeNoiseBuf(ctx, 5), 'lowpass', 340, 0.5, 0.48, rev);
  lfo(ctx, 0.03, 50, roar.filter.frequency);
  lfo(ctx, 0.025, 0.08, roar.gain.gain);

  // Crackle band — the wood popping, fast chaotic sweeps
  const crackle = noiseBand(ctx, makeNoiseBuf(ctx, 3), 'bandpass', 1400, 3.5, 0.22, rev);
  lfo(ctx, 0.45, 800, crackle.filter.frequency); // fast = crackle texture
  lfo(ctx, 0.31, 0.14, crackle.gain.gain);       // irregular bursts

  // High ember hiss — fine sparks
  const embers = noiseBand(ctx, makeNoiseBuf(ctx, 2), 'bandpass', 5500, 2.0, 0.08, rev);
  lfo(ctx, 0.52, 0.06, embers.gain.gain);

  // Sub warmth — hearth stone
  const hearth = noiseBand(ctx, makeNoiseBuf(ctx, 6), 'lowpass', 80, 0.8, 0.30, rev);
  lfo(ctx, 0.018, 10, hearth.filter.frequency);
}

/**
 * ASMR — blankets on your ears. Ultra-close textures:
 * soft fabric, slow breath, gentle page turns, warm static.
 * Everything very high-passed and intimate — no room, no reverb.
 */
function buildAsmr(ctx: AudioContext, master: GainNode) {
  // ASMR is dry — tiny room, very close
  const rev = makeReverb(ctx, 0.4, 6);
  rev.connect(master);

  // Fabric softness — the blanket, slow
  const fabric = noiseBand(ctx, makeNoiseBuf(ctx, 5), 'bandpass', 3200, 1.2, 0.30, rev);
  lfo(ctx, 0.04, 0.09, fabric.gain.gain);
  lfo(ctx, 0.025, 200, fabric.filter.frequency);

  // Warm breath presence — low, intimate
  const breath = noiseBand(ctx, makeNoiseBuf(ctx, 6), 'bandpass', 380, 0.6, 0.28, rev);
  lfo(ctx, 0.15, 0.12, breath.gain.gain); // slow breath rhythm

  // Micro-texture — like fingertips on paper, or whisper air
  const paper = noiseBand(ctx, makeNoiseBuf(ctx, 3), 'bandpass', 7500, 1.8, 0.14, rev);
  lfo(ctx, 0.08, 0.06, paper.gain.gain);

  // Sub hum — very faint, like a quiet room has weight
  const hum = noiseBand(ctx, makeNoiseBuf(ctx, 4), 'lowpass', 140, 0.9, 0.18, rev);
  lfo(ctx, 0.012, 12, hum.filter.frequency);
}

/** Ocean — long wave swell, shore wash, salt spray. */
function buildOcean(ctx: AudioContext, master: GainNode) {
  const rev = makeReverb(ctx, 3.0, 3);
  rev.connect(master);

  // Deep swell — the ocean breathing, very slow
  const swell = noiseBand(ctx, makeNoiseBuf(ctx, 8), 'lowpass', 260, 0.4, 0.55, rev);
  lfo(ctx, 0.012, 80, swell.filter.frequency);  // 80s wave cycle
  lfo(ctx, 0.012, 0.20, swell.gain.gain);        // volume rise and fall of each wave

  // Shore wash — mid, the foam and retreat
  const wash = noiseBand(ctx, makeNoiseBuf(ctx, 5), 'bandpass', 800, 0.5, 0.40, rev);
  lfo(ctx, 0.018, 120, wash.filter.frequency);
  lfo(ctx, 0.016, 0.15, wash.gain.gain);

  // Salt spray — high shimmer at the break
  const spray = noiseBand(ctx, makeNoiseBuf(ctx, 3), 'highpass', 5500, 0.5, 0.13, rev);
  lfo(ctx, 0.014, 0.07, spray.gain.gain);
}

/** Waterfall — crashing, perpetual, white noise wall with deep resonance. */
function buildWaterfall(ctx: AudioContext, master: GainNode) {
  const rev = makeReverb(ctx, 2.8, 2.5);
  rev.connect(master);

  // The wall of water — broad spectrum noise
  const wall = noiseBand(ctx, makeNoiseBuf(ctx, 5), 'bandpass', 1100, 0.3, 0.65, rev);
  lfo(ctx, 0.03, 60, wall.filter.frequency);

  // Deep plunge pool resonance — the base roar
  const plunge = noiseBand(ctx, makeNoiseBuf(ctx, 6), 'lowpass', 200, 0.6, 0.55, rev);
  lfo(ctx, 0.025, 30, plunge.filter.frequency);

  // Fine mist — high, constant
  const mist = noiseBand(ctx, makeNoiseBuf(ctx, 3), 'highpass', 7000, 0.4, 0.16, rev);
  lfo(ctx, 0.07, 0.04, mist.gain.gain);

  // Turbulent splash — irregular mid bursts
  const splash = noiseBand(ctx, makeNoiseBuf(ctx, 4), 'bandpass', 2800, 1.2, 0.22, rev);
  lfo(ctx, 0.19, 0.10, splash.gain.gain);
}

/** Desert — wind across open sand, vast space, hot silence. */
function buildDesert(ctx: AudioContext, master: GainNode) {
  const rev = makeReverb(ctx, 4.5, 6); // huge open space
  rev.connect(master);

  // Hot dry wind — thin, filtered
  const wind = noiseBand(ctx, makeNoiseBuf(ctx, 7), 'bandpass', 560, 0.3, 0.38, rev);
  lfo(ctx, 0.015, 140, wind.filter.frequency); // slow dune-scale gusts
  lfo(ctx, 0.02, 0.12, wind.gain.gain);

  // Sand grain texture — high, dry, barely there
  const sand = noiseBand(ctx, makeNoiseBuf(ctx, 3), 'highpass', 6500, 0.6, 0.09, rev);
  lfo(ctx, 0.11, 0.05, sand.gain.gain);

  // Sub distance — the vast emptiness has weight
  const vast = noiseBand(ctx, makeNoiseBuf(ctx, 6), 'lowpass', 110, 0.7, 0.28, rev);
  lfo(ctx, 0.009, 12, vast.filter.frequency);
}

/**
 * Night — crickets, frogs, owls, the chorus of a warm night.
 * Insects live in fast resonant peaks; frogs in slow rhythmic pops;
 * owls in low melodic sine drifts.
 */
function buildNight(ctx: AudioContext, master: GainNode) {
  const rev = makeReverb(ctx, 2.5, 4);
  rev.connect(master);

  // Cricket bed — dense high-frequency resonant chirp
  const crickets = noiseBand(ctx, makeNoiseBuf(ctx, 4), 'bandpass', 4800, 4.5, 0.18, rev);
  lfo(ctx, 0.55, 0.10, crickets.gain.gain);   // fast chirp rhythm
  lfo(ctx, 0.08, 200, crickets.filter.frequency);

  // Frog chorus — lower, rhythmic, wet
  const frogs = noiseBand(ctx, makeNoiseBuf(ctx, 3), 'bandpass', 680, 2.5, 0.20, rev);
  lfo(ctx, 0.25, 0.14, frogs.gain.gain);      // ribbit pulse
  lfo(ctx, 0.12, 80, frogs.filter.frequency);

  // Night air bed — the silence between calls
  const air = noiseBand(ctx, makeNoiseBuf(ctx, 5), 'lowpass', 200, 0.5, 0.20, rev);
  lfo(ctx, 0.02, 20, air.filter.frequency);

  // Owl — two low sine drones, slightly detuned, mournful
  [220, 329.6].forEach((hz, i) => {
    const osc    = ctx.createOscillator();
    const gain   = ctx.createGain();
    const panner = ctx.createStereoPanner();
    osc.type = 'sine';
    osc.frequency.value = hz;
    gain.gain.value = 0.07;
    panner.pan.value = i === 0 ? -0.4 : 0.4;
    lfo(ctx, 0.008, 1.5, osc.frequency);        // slow hooting drift
    lfo(ctx, 0.05, 0.05, gain.gain);             // intermittent presence
    osc.connect(gain); gain.connect(panner); panner.connect(rev);
    osc.start(); liveOscillators.push(osc);
  });
}

/** Jungle at night — dense, layered, alive. Everything at once. */
function buildJungle(ctx: AudioContext, master: GainNode) {
  const rev = makeReverb(ctx, 3.0, 3.5);
  rev.connect(master);

  // Dense insect layer — high, relentless
  const insects = noiseBand(ctx, makeNoiseBuf(ctx, 4), 'bandpass', 5200, 3.0, 0.16, rev);
  lfo(ctx, 0.65, 0.08, insects.gain.gain);

  // Mid bug/frog layer — varied rhythmic life
  const frogs = noiseBand(ctx, makeNoiseBuf(ctx, 3), 'bandpass', 1200, 2.0, 0.22, rev);
  lfo(ctx, 0.30, 0.12, frogs.gain.gain);
  lfo(ctx, 0.18, 120, frogs.filter.frequency);

  // Dripping canopy — water falling from leaves after rain
  const drip = noiseBand(ctx, makeNoiseBuf(ctx, 3), 'bandpass', 2400, 3.5, 0.12, rev);
  lfo(ctx, 0.22, 0.09, drip.gain.gain);

  // Deep jungle floor — low hum of life
  const floor = noiseBand(ctx, makeNoiseBuf(ctx, 5), 'lowpass', 180, 0.5, 0.30, rev);
  lfo(ctx, 0.03, 25, floor.filter.frequency);

  // Distant animal call — low melodic sine, rare
  const call = ctx.createOscillator();
  const callGain = ctx.createGain();
  call.type = 'sine';
  call.frequency.value = 180;
  callGain.gain.value = 0.06;
  lfo(ctx, 0.007, 15, call.frequency);
  lfo(ctx, 0.04, 0.05, callGain.gain);
  call.connect(callGain); callGain.connect(rev);
  call.start(); liveOscillators.push(call);
}

/** Drone — 111 Hz sacred base, pure harmonic overtones, binaural. */
function buildDrone(ctx: AudioContext, master: GainNode) {
  const rev = makeReverb(ctx, 5, 5);
  rev.connect(master);

  const freqs = [111, 166.5, 222, 333];
  freqs.forEach((f, i) => {
    [-0.6, 0.6].forEach((pan, ch) => {
      const osc    = ctx.createOscillator();
      const gain   = ctx.createGain();
      const panner = ctx.createStereoPanner();
      osc.type = 'sine';
      osc.frequency.value = f + ch * (2 + i * 0.8);
      gain.gain.value = 0.14 / (i + 1);
      panner.pan.value = pan;
      lfo(ctx, 0.013 + i * 0.006, 0.35, osc.frequency);
      osc.connect(gain);
      gain.connect(panner);
      panner.connect(rev);
      osc.start();
      liveOscillators.push(osc);
    });
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

function teardown() {
  liveOscillators.forEach(o => { try { o.stop(); } catch { /* already stopped */ } });
  liveSources.forEach(s => { try { s.stop(); } catch { /* already stopped */ } });
  liveOscillators = [];
  liveSources = [];
}

export function startAmbient(scene: SceneId, volume: number) {
  if (!browser) return;
  stopAmbient();

  const audioCtx = getCtx();
  if (audioCtx.state === 'suspended') audioCtx.resume();

  masterGain = audioCtx.createGain();
  masterGain.gain.value = volume;
  masterGain.connect(audioCtx.destination);

  switch (scene) {
    case 'drizzle': buildDrizzle(audioCtx, masterGain); break;
    case 'storm':   buildStorm(audioCtx, masterGain);   break;
    case 'river':   buildRiver(audioCtx, masterGain);   break;
    case 'wind':    buildWind(audioCtx, masterGain);    break;
    case 'leaves':  buildLeaves(audioCtx, masterGain);  break;
    case 'ocean':      buildOcean(audioCtx, masterGain);     break;
    case 'waterfall':  buildWaterfall(audioCtx, masterGain); break;
    case 'desert':     buildDesert(audioCtx, masterGain);    break;
    case 'night':      buildNight(audioCtx, masterGain);     break;
    case 'jungle':     buildJungle(audioCtx, masterGain);    break;
    case 'fire':       buildFire(audioCtx, masterGain);      break;
    case 'asmr':    buildAsmr(audioCtx, masterGain);    break;
    case 'bowls':   buildBowls(audioCtx, masterGain);   break;
    case 'earth':   buildEarth(audioCtx, masterGain);   break;
    case 'drone':   buildDrone(audioCtx, masterGain);   break;
  }

  ambientRunning.set(true);
  ambientScene.set(scene);
}

export function stopAmbient() {
  teardown();
  if (masterGain) { masterGain.disconnect(); masterGain = null; }
  ambientRunning.set(false);
}

/** Smooth volume change — 100ms ramp to avoid clicks. */
export function setVolume(v: number) {
  if (masterGain && ctx) masterGain.gain.setTargetAtTime(v, ctx.currentTime, 0.1);
}

export function setScene(scene: SceneId, volume: number) {
  startAmbient(scene, volume);
}
