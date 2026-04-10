/**
 * ambientEngine.ts — generative Web Audio ambient engine v2
 *
 * v1 problem: bandpass + LFO-swept frequency = wind on every scene.
 * v2 fix:
 *   - Pink noise for water/rain (1/f spectrum, more natural)
 *   - Gain-only LFOs for rain/water (no frequency sweep)
 *   - Beating LFOs (two at coprime rates) for rain patter texture
 *   - Drop scheduler for distinct percussive impacts (rain, leaves)
 *   - Frequency LFOs kept only where appropriate: wind, fire crackle, insects
 */

import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

export type SceneId = 'binaural';

export const SCENES: { id: SceneId; label: string }[] = [
  { id: 'binaural', label: 'binaural' },
];

/** Binaural beat frequency Hz — seeker-controlled, default theta (6 Hz). */
export const binauralBeat = writable(6);

// ── Audio file base URL ───────────────────────────────────────────────────────

const AUDIO_BASE = (typeof import.meta !== 'undefined' && (import.meta as { env?: { VITE_OURACLE_BASE_URL?: string } }).env?.VITE_OURACLE_BASE_URL) ?? 'https://api.ouracle.kerry.ink';

// ── Buffer cache (Option C: lazy-decode, then cached) ─────────────────────────

const bufferCache = new Map<string, AudioBuffer>();

async function fetchBuffer(audioCtx: AudioContext, url: string): Promise<AudioBuffer> {
  if (bufferCache.has(url)) return bufferCache.get(url)!;
  const res = await fetch(url);
  const ab = await res.arrayBuffer();
  const buf = await audioCtx.decodeAudioData(ab);
  bufferCache.set(url, buf);
  return buf;
}

// ── Stores ────────────────────────────────────────────────────────────────────

export const ambientRunning = writable(false);
export const ambientScene   = writable<SceneId>('binaural');

// ── Engine state ──────────────────────────────────────────────────────────────

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let liveOscillators: OscillatorNode[] = [];
let liveSources: AudioBufferSourceNode[] = [];
let liveSchedulers: Array<() => void> = [];
// Right-channel oscillators for binaural, paired with their base frequency
let liveBinauralR: Array<{ osc: OscillatorNode; base: number }> = [];

// ── Core helpers ──────────────────────────────────────────────────────────────

function getCtx(): AudioContext {
  if (!ctx || ctx.state === 'closed') ctx = new AudioContext();
  return ctx;
}

/**
 * Pink noise (1/f spectrum) — Voss-McCartney approximation.
 * Sounds much more natural than white noise for rain/water/organic textures.
 */
function makePinkBuf(ctx: AudioContext, seconds = 4): AudioBuffer {
  const frames = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, frames, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;
    for (let i = 0; i < frames; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886*b0 + w*0.0555179; b1 = 0.99332*b1 + w*0.0750759;
      b2 = 0.96900*b2 + w*0.1538520; b3 = 0.86650*b3 + w*0.3104856;
      b4 = 0.55000*b4 + w*0.5329522; b5 = -0.7616*b5 - w*0.0168980;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w*0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  }
  return buf;
}

/** White noise — used for wind, fire, space where flatness is appropriate. */
function makeNoiseBuf(ctx: AudioContext, seconds = 4): AudioBuffer {
  const frames = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, frames, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < frames; i++) d[i] = Math.random() * 2 - 1;
  }
  return buf;
}

function noiseSource(ctx: AudioContext, buf: AudioBuffer): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.loopStart = Math.random() * buf.duration;
  src.loopEnd = buf.duration;
  return src;
}

/** Synthesised reverb — exponentially decaying noise IR. */
function makeReverb(ctx: AudioContext, duration: number, decay: number): ConvolverNode {
  const conv = ctx.createConvolver();
  const len = Math.floor(ctx.sampleRate * duration);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++)
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  conv.buffer = ir;
  return conv;
}

/** Sine LFO → AudioParam modulation. */
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
  osc.start(Math.max(0, ctx.currentTime - phase / (Math.PI * 2 * hz)));
  liveOscillators.push(osc);
  return osc;
}

/** Filtered noise band: noise → filter → gain → dest. */
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

/**
 * Drop scheduler — fires short decaying noise bursts at random intervals.
 * Used for rain drops, leaf pats, fabric touches, anything percussive.
 *
 * Pre-bakes 16 buffer variations to avoid per-drop allocation.
 * Each drop: pre-baked buffer → new filter+gain (3 nodes, ~50ms lifespan).
 * At ≤8 drops/sec these are trivial and GC quickly.
 * Scheduler state tracked in liveSchedulers for clean teardown.
 */
function dropScheduler(
  ctx: AudioContext,
  dest: AudioNode,
  opts: {
    rateHz: number;
    variance: number;   // timing jitter 0..1
    freq: number;
    freqVar: number;    // pitch variation ± fraction
    q: number;
    dropMs: number;
    gain: number;
    gainVar: number;
    filterType?: BiquadFilterType;
  }
): () => void {
  const { rateHz, variance, freq, freqVar, q, dropMs, gain, gainVar, filterType = 'bandpass' } = opts;
  let running = true;

  const CACHE = 16;
  const dropFrames = Math.max(8, Math.floor(ctx.sampleRate * dropMs / 1000));
  const bufs: AudioBuffer[] = Array.from({ length: CACHE }, () => {
    const b = ctx.createBuffer(1, dropFrames, ctx.sampleRate);
    const d = b.getChannelData(0);
    const decay = dropFrames * (0.1 + Math.random() * 0.25);
    for (let i = 0; i < dropFrames; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / decay);
    return b;
  });
  let idx = 0;

  function fire() {
    if (!running) return;
    const src  = ctx.createBufferSource();
    const filt = ctx.createBiquadFilter();
    const g    = ctx.createGain();
    src.buffer = bufs[idx++ % CACHE];
    filt.type  = filterType;
    filt.frequency.value = freq * (1 + (Math.random() - 0.5) * 2 * freqVar);
    filt.Q.value = q;
    g.gain.value = Math.max(0, gain + (Math.random() - 0.5) * 2 * gainVar);
    src.connect(filt); filt.connect(g); g.connect(dest);
    src.start();
    // Not tracked in liveSources — self-terminates after dropMs
    const interval = (1000 / rateHz) * (1 - variance / 2 + Math.random() * variance);
    setTimeout(fire, Math.max(10, interval));
  }
  fire();
  return () => { running = false; };
}

// ── Scenes ────────────────────────────────────────────────────────────────────

/**
 * Drizzle — sparse drops on glass/tin + puddle splashes.
 * NO frequency sweeps. Gain-beating LFOs create irregular patter texture.
 * Drop scheduler adds physically distinct individual impacts.
 */
function buildDrizzle(ctx: AudioContext, master: GainNode) {
  const rev = makeReverb(ctx, 2.0, 4);
  rev.connect(master);
  const dry = ctx.createGain();
  dry.gain.value = 0.65;
  dry.connect(master);

  // High-frequency tap texture — two coprime LFOs beat against each other
  // creating irregular patter rather than steady hum (the key to rain sound)
  const tap = noiseBand(ctx, makePinkBuf(ctx, 4), 'bandpass', 3200, 3.5, 0.0, rev);
  tap.gain.gain.value = 0.08;
  lfo(ctx, 11.3, 0.22, tap.gain.gain); // ~11 taps/sec
  lfo(ctx, 4.7,  0.14, tap.gain.gain); // beats against 11.3 → irregular rhythm

  // Hollow puddle impact — lower frequency, slower
  const puddle = noiseBand(ctx, makePinkBuf(ctx, 5), 'bandpass', 420, 2.8, 0.0, dry);
  puddle.gain.gain.value = 0.06;
  lfo(ctx, 3.1, 0.18, puddle.gain.gain);
  lfo(ctx, 1.7, 0.10, puddle.gain.gain);

  // Background mist — static, no sweep
  noiseBand(ctx, makePinkBuf(ctx, 3), 'highpass', 7000, 0.3, 0.04, rev);

  // Individual distinct drops
  liveSchedulers.push(dropScheduler(ctx, dry, {
    rateHz: 4, variance: 0.75, freq: 2600, freqVar: 0.45, q: 3.5,
    dropMs: 55, gain: 0.32, gainVar: 0.18,
  }));
  liveSchedulers.push(dropScheduler(ctx, rev, {
    rateHz: 2, variance: 0.85, freq: 380, freqVar: 0.40, q: 2.2,
    dropMs: 80, gain: 0.28, gainVar: 0.14,
  }));
}

/** Storm — dense driving rain + thunder sub-swell. */
function buildStorm(ctx: AudioContext, master: GainNode) {
  const rev = makeReverb(ctx, 2.5, 2.5);
  rev.connect(master);
  const dry = ctx.createGain();
  dry.gain.value = 0.55;
  dry.connect(master);

  // Dense rain patter — faster beating LFOs
  const pour = noiseBand(ctx, makePinkBuf(ctx, 4), 'bandpass', 2400, 1.0, 0.0, rev);
  pour.gain.gain.value = 0.30;
  lfo(ctx, 22,  0.28, pour.gain.gain);
  lfo(ctx, 8.7, 0.20, pour.gain.gain);

  // Heavy impact — low, percussive
  const impact = noiseBand(ctx, makePinkBuf(ctx, 5), 'bandpass', 580, 1.8, 0.0, rev);
  impact.gain.gain.value = 0.24;
  lfo(ctx, 6.1, 0.22, impact.gain.gain);
  lfo(ctx, 2.5, 0.16, impact.gain.gain);

  // Thunder sub — slow gain swell, NO frequency sweep
  const thunder = noiseBand(ctx, makeNoiseBuf(ctx, 8), 'lowpass', 85, 0.5, 0.38, rev);
  lfo(ctx, 0.012, 0.22, thunder.gain.gain);

  // Sheet noise — driving wind-rain mix, static highpass
  noiseBand(ctx, makePinkBuf(ctx, 3), 'highpass', 4500, 0.4, 0.10, rev);

  // Dense drop texture for storm intensity
  liveSchedulers.push(dropScheduler(ctx, dry, {
    rateHz: 18, variance: 0.5, freq: 1800, freqVar: 0.5, q: 1.5,
    dropMs: 35, gain: 0.22, gainVar: 0.14,
  }));
}

/** River — pink noise, wave-rhythm gain AM, zero frequency sweep. */
function buildRiver(ctx: AudioContext, master: GainNode) {
  const rev = makeReverb(ctx, 2.5, 3.5);
  rev.connect(master);

  // Main body — broad lowpass, slow level change
  const body = noiseBand(ctx, makePinkBuf(ctx, 6), 'lowpass', 420, 0.3, 0.48, rev);
  lfo(ctx, 0.07, 0.12, body.gain.gain);

  // Gurgle — resonant but GAIN modulated, not swept
  const gurgle = noiseBand(ctx, makePinkBuf(ctx, 4), 'bandpass', 920, 2.2, 0.0, rev);
  gurgle.gain.gain.value = 0.18;
  lfo(ctx, 0.38, 0.18, gurgle.gain.gain); // faster = bubbles
  lfo(ctx, 0.19, 0.10, gurgle.gain.gain); // slower = swells

  // Surface texture — static high filter
  noiseBand(ctx, makePinkBuf(ctx, 3), 'highpass', 4800, 0.3, 0.05, rev);
}

/** Ocean — very slow wave AM, distinct swell/shore rhythm. */
function buildOcean(ctx: AudioContext, master: GainNode) {
  const rev = makeReverb(ctx, 3.5, 2.5);
  rev.connect(master);

  // Deep swell — ~12-second wave cycle, pure gain AM
  const swell = noiseBand(ctx, makePinkBuf(ctx, 12), 'lowpass', 290, 0.25, 0.0, rev);
  swell.gain.gain.value = 0.48;
  lfo(ctx, 0.083, 0.32, swell.gain.gain);

  // Shore wash — slightly faster, different phase
  const shore = noiseBand(ctx, makePinkBuf(ctx, 8), 'bandpass', 680, 0.6, 0.0, rev);
  shore.gain.gain.value = 0.28;
  lfo(ctx, 0.10, 0.22, shore.gain.gain);

  // Spray — rides swell rhythm
  const spray = noiseBand(ctx, makeNoiseBuf(ctx, 3), 'highpass', 5800, 0.4, 0.0, rev);
  spray.gain.gain.value = 0.06;
  lfo(ctx, 0.083, 0.05, spray.gain.gain);

  // Ocean sub depth
  const depth = noiseBand(ctx, makeNoiseBuf(ctx, 8), 'lowpass', 95, 0.4, 0.15, rev);
  lfo(ctx, 0.04, 0.06, depth.gain.gain);
}

/** Waterfall — broadband noise wall, minimal filtering, no sweep. */
function buildWaterfall(ctx: AudioContext, master: GainNode) {
  const rev = makeReverb(ctx, 2.8, 2.0);
  rev.connect(master);

  // The wall — near-full-spectrum, just a broad lowpass to remove ultra-highs
  const wall = noiseBand(ctx, makeNoiseBuf(ctx, 5), 'lowpass', 9000, 0.1, 0.62, rev);
  lfo(ctx, 0.02, 0.06, wall.gain.gain);

  // Plunge pool — deep resonance, gain AM
  const plunge = noiseBand(ctx, makePinkBuf(ctx, 6), 'lowpass', 230, 0.5, 0.48, rev);
  lfo(ctx, 0.025, 0.08, plunge.gain.gain);

  // Mist — constant high shimmer, no modulation
  noiseBand(ctx, makeNoiseBuf(ctx, 3), 'highpass', 7500, 0.3, 0.09, rev);

  // Turbulent splash — gain AM, not freq
  const splash = noiseBand(ctx, makePinkBuf(ctx, 4), 'bandpass', 2600, 1.5, 0.0, rev);
  splash.gain.gain.value = 0.16;
  lfo(ctx, 0.20, 0.14, splash.gain.gain);
}

/** Wind — the ONE scene where frequency sweep is correct. */
function buildWind(ctx: AudioContext, master: GainNode) {
  const rev = makeReverb(ctx, 4.0, 5);
  rev.connect(master);

  const breeze = noiseBand(ctx, makeNoiseBuf(ctx, 6), 'bandpass', 500, 0.3, 0.40, rev);
  lfo(ctx, 0.022, 140, breeze.filter.frequency);
  lfo(ctx, 0.035, 0.12, breeze.gain.gain);

  const flutter = noiseBand(ctx, makeNoiseBuf(ctx, 4), 'bandpass', 2200, 0.8, 0.11, rev);
  lfo(ctx, 0.07, 0.08, flutter.gain.gain);

  const air = noiseBand(ctx, makeNoiseBuf(ctx, 5), 'lowpass', 160, 0.5, 0.24, rev);
  lfo(ctx, 0.018, 0.10, air.gain.gain);
}

/** Desert — hot dry wind, vast space, almost no water. */
function buildDesert(ctx: AudioContext, master: GainNode) {
  const rev = makeReverb(ctx, 5, 6);
  rev.connect(master);

  const wind = noiseBand(ctx, makeNoiseBuf(ctx, 7), 'bandpass', 560, 0.3, 0.33, rev);
  lfo(ctx, 0.015, 130, wind.filter.frequency);
  lfo(ctx, 0.020, 0.12, wind.gain.gain);

  // Sand grain — static high, barely there
  noiseBand(ctx, makeNoiseBuf(ctx, 3), 'highpass', 6800, 0.5, 0.06, rev);

  // Vast silence weight — gain only
  const vast = noiseBand(ctx, makeNoiseBuf(ctx, 6), 'lowpass', 105, 0.6, 0.22, rev);
  lfo(ctx, 0.009, 0.08, vast.gain.gain);
}

/** Leaves — rustle, footsteps in moss, distinct leaf pats. */
function buildLeaves(ctx: AudioContext, master: GainNode) {
  const rev = makeReverb(ctx, 1.5, 4);
  rev.connect(master);
  const dry = ctx.createGain();
  dry.gain.value = 0.65;
  dry.connect(master);

  // Canopy rustle — gain-beat LFOs, not freq sweep
  const rustle = noiseBand(ctx, makePinkBuf(ctx, 5), 'bandpass', 3200, 1.5, 0.0, rev);
  rustle.gain.gain.value = 0.12;
  lfo(ctx, 0.30, 0.12, rustle.gain.gain);
  lfo(ctx, 0.13, 0.07, rustle.gain.gain);

  // Soft moss underfoot — static lowpass
  const moss = noiseBand(ctx, makePinkBuf(ctx, 4), 'lowpass', 280, 0.5, 0.28, rev);
  lfo(ctx, 0.05, 0.07, moss.gain.gain);

  // Individual leaf pats and crunch
  liveSchedulers.push(dropScheduler(ctx, dry, {
    rateHz: 3, variance: 0.65, freq: 2800, freqVar: 0.5, q: 1.8,
    dropMs: 90, gain: 0.30, gainVar: 0.18,
  }));
  liveSchedulers.push(dropScheduler(ctx, dry, {
    rateHz: 1, variance: 0.90, freq: 1100, freqVar: 0.45, q: 1.4,
    dropMs: 130, gain: 0.24, gainVar: 0.14,
  }));
}

/**
 * Fire — crackle needs frequency sweeps (that's how wood sounds).
 * Fast LFO on resonant bandpass = crackling transients. Kept as-is.
 */
function buildFire(ctx: AudioContext, master: GainNode) {
  const rev = makeReverb(ctx, 1.0, 3);
  rev.connect(master);

  const roar = noiseBand(ctx, makeNoiseBuf(ctx, 5), 'lowpass', 340, 0.5, 0.46, rev);
  lfo(ctx, 0.03, 50, roar.filter.frequency);
  lfo(ctx, 0.025, 0.08, roar.gain.gain);

  const crackle = noiseBand(ctx, makeNoiseBuf(ctx, 3), 'bandpass', 1400, 3.8, 0.22, rev);
  lfo(ctx, 0.45, 800, crackle.filter.frequency);
  lfo(ctx, 0.31, 0.14, crackle.gain.gain);

  const embers = noiseBand(ctx, makeNoiseBuf(ctx, 2), 'bandpass', 5500, 2.0, 0.07, rev);
  lfo(ctx, 0.52, 0.06, embers.gain.gain);

  const hearth = noiseBand(ctx, makeNoiseBuf(ctx, 6), 'lowpass', 80, 0.7, 0.28, rev);
  lfo(ctx, 0.018, 0.08, hearth.gain.gain);
}

/** ASMR — ultra-close textures, dry, intimate. No sweeps. */
function buildAsmr(ctx: AudioContext, master: GainNode) {
  const rev = makeReverb(ctx, 0.5, 7); // tiny room
  rev.connect(master);
  const dry = ctx.createGain();
  dry.gain.value = 0.75;
  dry.connect(master);

  // Fabric — slow gain breathe, no freq sweep
  const fabric = noiseBand(ctx, makePinkBuf(ctx, 5), 'bandpass', 3600, 1.2, 0.0, dry);
  fabric.gain.gain.value = 0.20;
  lfo(ctx, 0.04, 0.10, fabric.gain.gain);

  // Breath — very slow
  const breath = noiseBand(ctx, makePinkBuf(ctx, 6), 'bandpass', 380, 0.6, 0.0, dry);
  breath.gain.gain.value = 0.16;
  lfo(ctx, 0.13, 0.12, breath.gain.gain);

  // Whisper air / fingertips on paper — static high
  noiseBand(ctx, makeNoiseBuf(ctx, 3), 'highpass', 7500, 0.5, 0.09, dry);

  // Sparse fabric-touch drops
  liveSchedulers.push(dropScheduler(ctx, dry, {
    rateHz: 0.7, variance: 0.90, freq: 5500, freqVar: 0.35, q: 0.9,
    dropMs: 220, gain: 0.24, gainVar: 0.14, filterType: 'highpass',
  }));
}

/** Bowls — sacred Solfeggio + theta binaural beats. Unchanged. */
function buildBowls(ctx: AudioContext, master: GainNode) {
  const rev = makeReverb(ctx, 6, 6);
  rev.connect(master);

  const bowls: [number, number, number, number][] = [
    [174,  6,   0.30, 0.8],
    [396,  4,   0.22, 0.65],
    [528,  3.5, 0.20, 0.6],
    [741,  4,   0.15, 0.7],
    [963,  5,   0.09, 0.75],
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
      lfo(ctx, 0.008 + i * 0.003, 0.6, osc.frequency);
      osc.connect(gain);
      gain.connect(panner);
      panner.connect(rev);
      osc.start();
      liveOscillators.push(osc);
    });
  });
}

/** Earth — sub weight, mineral crunch via gain beats (not freq sweep). */
function buildEarth(ctx: AudioContext, master: GainNode) {
  const rev = makeReverb(ctx, 1.2, 4);
  rev.connect(master);

  const sub = noiseBand(ctx, makeNoiseBuf(ctx, 6), 'lowpass', 120, 0.6, 0.44, rev);
  lfo(ctx, 0.03, 0.10, sub.gain.gain);

  // Mineral grain — fast gain beats, NOT freq sweep
  const grain = noiseBand(ctx, makeNoiseBuf(ctx, 3), 'bandpass', 2600, 2.5, 0.0, rev);
  grain.gain.gain.value = 0.16;
  lfo(ctx, 0.28, 0.14, grain.gain.gain);
  lfo(ctx, 0.11, 0.08, grain.gain.gain);

  const gravel = noiseBand(ctx, makeNoiseBuf(ctx, 4), 'bandpass', 600, 1.2, 0.26, rev);
  lfo(ctx, 0.07, 0.07, gravel.gain.gain);
}

/**
 * Night — crickets/frogs KEEP frequency modulation (that IS how insects sound:
 * rapid tonal chirps from resonant stridulation, not noise).
 */
function buildNight(ctx: AudioContext, master: GainNode) {
  const rev = makeReverb(ctx, 2.5, 4);
  rev.connect(master);

  const crickets = noiseBand(ctx, makeNoiseBuf(ctx, 4), 'bandpass', 4800, 5.0, 0.18, rev);
  lfo(ctx, 0.55, 0.10, crickets.gain.gain);
  lfo(ctx, 0.08, 180, crickets.filter.frequency); // chirp sweep — correct for insects

  const frogs = noiseBand(ctx, makeNoiseBuf(ctx, 3), 'bandpass', 680, 2.8, 0.20, rev);
  lfo(ctx, 0.22, 0.14, frogs.gain.gain);
  lfo(ctx, 0.11, 70, frogs.filter.frequency);

  const air = noiseBand(ctx, makePinkBuf(ctx, 5), 'lowpass', 200, 0.4, 0.16, rev);
  lfo(ctx, 0.02, 0.06, air.gain.gain);

  [220, 329.6].forEach((hz, i) => {
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    const pan = ctx.createStereoPanner();
    osc.type = 'sine';
    osc.frequency.value = hz;
    g.gain.value = 0.07;
    pan.pan.value = i === 0 ? -0.4 : 0.4;
    lfo(ctx, 0.008, 1.5, osc.frequency);
    lfo(ctx, 0.05, 0.05, g.gain);
    osc.connect(g); g.connect(pan); pan.connect(rev);
    osc.start(); liveOscillators.push(osc);
  });
}

/** Jungle — dense insect layer + canopy drips + deep floor. */
function buildJungle(ctx: AudioContext, master: GainNode) {
  const rev = makeReverb(ctx, 3.0, 3.5);
  rev.connect(master);
  const dry = ctx.createGain();
  dry.gain.value = 0.55;
  dry.connect(master);

  const insects = noiseBand(ctx, makeNoiseBuf(ctx, 4), 'bandpass', 5200, 3.2, 0.16, rev);
  lfo(ctx, 0.65, 0.08, insects.gain.gain);

  const frogs = noiseBand(ctx, makeNoiseBuf(ctx, 3), 'bandpass', 1200, 2.2, 0.20, rev);
  lfo(ctx, 0.28, 0.12, frogs.gain.gain);
  lfo(ctx, 0.16, 100, frogs.filter.frequency); // insect freq sweep OK

  // Canopy drips — distinct drops
  liveSchedulers.push(dropScheduler(ctx, dry, {
    rateHz: 2, variance: 0.80, freq: 1900, freqVar: 0.55, q: 3,
    dropMs: 70, gain: 0.28, gainVar: 0.16,
  }));

  const floor = noiseBand(ctx, makePinkBuf(ctx, 5), 'lowpass', 180, 0.5, 0.26, rev);
  lfo(ctx, 0.03, 0.07, floor.gain.gain);

  const call = ctx.createOscillator();
  const callG = ctx.createGain();
  call.type = 'sine'; call.frequency.value = 180;
  callG.gain.value = 0.06;
  lfo(ctx, 0.007, 14, call.frequency);
  lfo(ctx, 0.04, 0.05, callG.gain);
  call.connect(callG); callG.connect(rev);
  call.start(); liveOscillators.push(call);
}

/** Drone — 111 Hz sacred base, pure harmonics, binaural. Unchanged. */
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

/**
 * Binaural beat synthesizer.
 * Base tone: 111 Hz (sacred/resonant). Left ear: base. Right ear: base + beatHz.
 * The brain perceives a phantom beat at the difference frequency.
 *   Delta  1–4 Hz  — deep sleep, healing
 *   Theta  4–8 Hz  — meditation, creativity (default 6 Hz)
 *   Alpha  8–13 Hz — relaxed focus
 *   Beta  13–30 Hz — alert thinking
 *
 * Texture layers:
 *   - Per-carrier amplitude tremolo at different rates → each harmonic breathes independently
 *   - Sub-bass cardiac pulse: two coprime LFOs (1.1 + 0.9 Hz) create irregular heartbeat feel
 *   - High shimmer (pink highpass) + overtone cluster (166.5 / 277.5 Hz) for warmth
 *   - Pink noise bed with slow breath and rhythmic pulse
 *
 * The seeker controls beatHz via the binauralBeat store.
 * Pitch LFOs on R channel are additive — updateBinauralBeat still works live.
 */
function buildBinaural(ctx: AudioContext, master: GainNode, beatHz: number) {
  const rev = makeReverb(ctx, 5, 4.5);
  rev.connect(master);

  // Carrier stack — 111 / 222 / 333 Hz harmonics
  const carriers = [111, 222, 333];
  carriers.forEach((base, i) => {
    const gainVal = 0.20 / (i + 1);

    // Left channel
    const oscL  = ctx.createOscillator();
    const gL    = ctx.createGain();
    const panL  = ctx.createStereoPanner();
    oscL.type = 'sine';
    oscL.frequency.value = base;
    gL.gain.value = gainVal;
    panL.pan.value = -1;
    lfo(ctx, 0.013 + i * 0.005, 0.28, oscL.frequency);               // pitch drift
    lfo(ctx, 0.07 + i * 0.03, gainVal * 0.25, gL.gain);              // tremolo
    oscL.connect(gL); gL.connect(panL); panL.connect(rev);
    oscL.start();
    liveOscillators.push(oscL);

    // Right channel — base + beatHz (tracked for live updates)
    const oscR  = ctx.createOscillator();
    const gR    = ctx.createGain();
    const panR  = ctx.createStereoPanner();
    oscR.type = 'sine';
    oscR.frequency.value = base + beatHz;
    gR.gain.value = gainVal;
    panR.pan.value = 1;
    lfo(ctx, 0.013 + i * 0.005, 0.28, oscR.frequency);               // same drift as L
    lfo(ctx, 0.07 + i * 0.03, gainVal * 0.25, gR.gain);              // same tremolo as L
    oscR.connect(gR); gR.connect(panR); panR.connect(rev);
    oscR.start();
    liveOscillators.push(oscR);
    liveBinauralR.push({ osc: oscR, base });
  });

  // Warm overtone cluster — perfect-fifth harmonics, very quiet, adds body
  // 166.5 = 111 * 1.5 (3rd harmonic), 277.5 = 222 * 1.25 (5th partial)
  [166.5, 277.5].forEach((hz, i) => {
    [-0.45, 0.45].forEach((pan) => {
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      const p   = ctx.createStereoPanner();
      osc.type = 'sine';
      osc.frequency.value = hz;
      g.gain.value = 0.05 / (i + 1);
      p.pan.value = pan;
      lfo(ctx, 0.009 + i * 0.004, 0.20, osc.frequency);
      osc.connect(g); g.connect(p); p.connect(rev);
      osc.start();
      liveOscillators.push(osc);
    });
  });

  // Pink noise bed — slow breath + rhythmic pulse
  const bed = noiseBand(ctx, makePinkBuf(ctx, 8), 'lowpass', 800, 0.3, 0.06, rev);
  lfo(ctx, 0.083, 0.04, bed.gain.gain);   // 12-second breath swell
  lfo(ctx, 0.5,   0.02, bed.gain.gain);   // subtle 0.5 Hz pulse (30 bpm undercurrent)

  // Sub-bass cardiac pulse — two coprime LFOs beat for an irregular heartbeat
  const pulse = noiseBand(ctx, makePinkBuf(ctx, 6), 'lowpass', 65, 0.9, 0.0, rev);
  pulse.gain.gain.value = 0.07;
  lfo(ctx, 1.1, 0.055, pulse.gain.gain);  // ~66 bpm
  lfo(ctx, 0.9, 0.030, pulse.gain.gain);  // beats against 1.1 → irregular, alive

  // High shimmer — air and space, very quiet
  const shimmer = noiseBand(ctx, makePinkBuf(ctx, 4), 'highpass', 6500, 0.5, 0.022, rev);
  lfo(ctx, 0.04, 0.012, shimmer.gain.gain);
}

// ── Scene layer (mp3 loop) ────────────────────────────────────────────────────

export const ambientSceneFile = writable<string | null>(null);

let sceneGain: GainNode | null = null;
let sceneSource: AudioBufferSourceNode | null = null;

export async function startScene(filename: string): Promise<void> {
  if (!browser) return;
  const audioCtx = getCtx();
  if (audioCtx.state === 'suspended') await audioCtx.resume();

  // Fade out and release old scene
  if (sceneGain && sceneSource) {
    const oldGain = sceneGain;
    const oldSrc  = sceneSource;
    oldGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.15);
    setTimeout(() => { try { oldSrc.stop(); } catch { /* already stopped */ } oldGain.disconnect(); }, 600);
    sceneGain = null;
    sceneSource = null;
  }

  const buf = await fetchBuffer(audioCtx, `${AUDIO_BASE}/ambient/${filename}.mp3`);

  const gain = audioCtx.createGain();
  gain.gain.value = 0;
  gain.connect(audioCtx.destination);

  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.connect(gain);
  src.start();

  gain.gain.setTargetAtTime(0.75, audioCtx.currentTime, 0.3);
  sceneGain = gain;
  sceneSource = src;
  ambientSceneFile.set(filename);
}

export function stopScene(): void {
  if (!browser || !sceneGain || !sceneSource) return;
  const audioCtx = getCtx();
  const gain = sceneGain;
  const src  = sceneSource;
  gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.15);
  setTimeout(() => { try { src.stop(); } catch { /* already stopped */ } gain.disconnect(); }, 600);
  sceneGain = null;
  sceneSource = null;
  ambientSceneFile.set(null);
}

// ── Bowls layer (random-interval sequential playback) ─────────────────────────

export const bowlsActive = writable(false);

const BOWL_FILES = [
  'bowls-binaural-singing',
  'bowls-clanging',
  'bowls-dinging',
  'bowls-rubbing',
  'bowls-rung',
];

let bowlsGain: GainNode | null = null;
let bowlsToken: { cancelled: boolean } | null = null;
let bowlsCurrentSource: AudioBufferSourceNode | null = null;

async function scheduleBowl(token: { cancelled: boolean }): Promise<void> {
  if (token.cancelled || !bowlsGain) return;
  const audioCtx = getCtx();
  const file = BOWL_FILES[Math.floor(Math.random() * BOWL_FILES.length)];
  try {
    const buf = await fetchBuffer(audioCtx, `${AUDIO_BASE}/ambient/${file}.mp3`);
    if (token.cancelled || !bowlsGain) return;

    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(bowlsGain);
    src.start();
    bowlsCurrentSource = src;

    src.onended = () => {
      bowlsCurrentSource = null;
      if (token.cancelled) return;
      const delay = 10_000 + Math.random() * 50_000; // 10–60 s
      setTimeout(() => scheduleBowl(token), delay);
    };
  } catch {
    if (!token.cancelled) setTimeout(() => scheduleBowl(token), 5_000);
  }
}

export function startBowls(): void {
  if (!browser || bowlsGain) return;
  const audioCtx = getCtx();
  if (audioCtx.state === 'suspended') audioCtx.resume();

  bowlsGain = audioCtx.createGain();
  bowlsGain.gain.value = 0.85;
  bowlsGain.connect(audioCtx.destination);

  bowlsToken = { cancelled: false };
  bowlsActive.set(true);
  scheduleBowl(bowlsToken);
}

export function stopBowls(): void {
  if (!browser) return;
  if (bowlsToken) { bowlsToken.cancelled = true; bowlsToken = null; }
  if (bowlsCurrentSource) { try { bowlsCurrentSource.stop(); } catch { /* ok */ } bowlsCurrentSource = null; }
  if (bowlsGain) {
    const audioCtx = getCtx();
    bowlsGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1);
    const g = bowlsGain;
    setTimeout(() => g.disconnect(), 500);
    bowlsGain = null;
  }
  bowlsActive.set(false);
}

export function skipBowl(): void {
  if (!browser || !bowlsToken || !bowlsGain) return;
  // Cancel old token — kills any pending inter-bowl setTimeout
  bowlsToken.cancelled = true;
  if (bowlsCurrentSource) { try { bowlsCurrentSource.stop(); } catch { /* ok */ } bowlsCurrentSource = null; }
  // Fresh token, fire immediately
  bowlsToken = { cancelled: false };
  scheduleBowl(bowlsToken);
}

// ── Feature layers (looping mp3s with crossfade) ──────────────────────────────

export const chimesActive   = writable(false);
export const birdsongActive = writable(false);

type FeatureName = 'chimes' | 'birdsong';

const FEATURE_FILES: Record<FeatureName, string> = {
  chimes:   'feature-wind-chimes',
  birdsong: 'feature-birdsong',
};

const featureState: Record<FeatureName, { gain: GainNode | null; src: AudioBufferSourceNode | null }> = {
  chimes:   { gain: null, src: null },
  birdsong: { gain: null, src: null },
};

const featureStores: Record<FeatureName, ReturnType<typeof writable<boolean>>> = {
  chimes:   chimesActive,
  birdsong: birdsongActive,
};

export async function startFeature(name: FeatureName): Promise<void> {
  if (!browser || featureState[name].gain) return;
  const audioCtx = getCtx();
  if (audioCtx.state === 'suspended') await audioCtx.resume();

  const buf = await fetchBuffer(audioCtx, `${AUDIO_BASE}/ambient/${FEATURE_FILES[name]}.mp3`);
  if (featureState[name].gain) return; // guard against double-tap while loading

  const gain = audioCtx.createGain();
  gain.gain.value = 0;
  gain.connect(audioCtx.destination);

  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.connect(gain);
  src.start();

  // τ = 0.65 s → ~95% target reached in 2 s
  gain.gain.setTargetAtTime(0.75, audioCtx.currentTime, 0.65);

  featureState[name] = { gain, src };
  featureStores[name].set(true);
}

export function stopFeature(name: FeatureName): void {
  if (!browser) return;
  const { gain, src } = featureState[name];
  if (!gain || !src) return;
  const audioCtx = getCtx();
  gain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.65);
  setTimeout(() => { try { src.stop(); } catch { /* ok */ } gain.disconnect(); }, 2_500);
  featureState[name] = { gain: null, src: null };
  featureStores[name].set(false);
}

// ── Public API ─────────────────────────────────────────────────────────────────

function teardown() {
  liveSchedulers.forEach(stop => stop());
  liveSchedulers = [];
  liveOscillators.forEach(o => { try { o.stop(); } catch { /* already stopped */ } });
  liveSources.forEach(s => { try { s.stop(); } catch { /* already stopped */ } });
  liveOscillators = [];
  liveSources = [];
  liveBinauralR = [];
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
    case 'binaural':
      buildBinaural(audioCtx, masterGain, get(binauralBeat));
      break;
    default:
      throw new Error(`Unknown scene: ${scene}`);
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

/**
 * Live binaural beat update — ramps right-channel oscillators to base + hz
 * without restarting the audio graph. 50ms time constant avoids clicks.
 */
export function updateBinauralBeat(hz: number) {
  if (!ctx || liveBinauralR.length === 0) return;
  binauralBeat.set(hz);
  const t = ctx.currentTime;
  liveBinauralR.forEach(({ osc, base }) => {
    osc.frequency.setTargetAtTime(base + hz, t, 0.05);
  });
}

export function setScene(scene: SceneId, volume: number) {
  startAmbient(scene, volume);
}

export const anySoundPlaying = {
  subscribe: (run: (v: boolean) => void) => {
    const stores = [ambientRunning, ambientSceneFile, bowlsActive, chimesActive, birdsongActive];
    const unsubs = stores.map(s => s.subscribe(() => {
      run(
        get(ambientRunning) ||
        !!get(ambientSceneFile) ||
        get(bowlsActive) ||
        get(chimesActive) ||
        get(birdsongActive)
      );
    }));
    return () => unsubs.forEach(u => u());
  }
};

export function allOff(): void {
  stopAmbient();
  stopScene();
  stopBowls();
  stopFeature('chimes');
  stopFeature('birdsong');
}

/** Resume AudioContext on page show — but do NOT suspend on hide so audio continues across tab switches. */
if (browser) {
  document.addEventListener('visibilitychange', () => {
    if (!ctx || document.hidden) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  });
}
