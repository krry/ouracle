/**
 * ambientEngine.ts — generative Web Audio ambient engine
 *
 * Each scene is a stack of filtered noise bands + optional sine drones,
 * all modulated by slow LFOs so the soundscape breathes and shifts.
 * Reverb is synthesized (exponentially decaying noise IR) — no audio files.
 */

import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export type SceneId = 'rain' | 'bowls' | 'forest' | 'river' | 'drone';

export const SCENES: { id: SceneId; label: string }[] = [
  { id: 'rain',   label: 'rain'   },
  { id: 'bowls',  label: 'bowls'  },
  { id: 'forest', label: 'forest' },
  { id: 'river',  label: 'river'  },
  { id: 'drone',  label: 'drone'  },
];

// ── Stores ───────────────────────────────────────────────────────────────────

export const ambientRunning = writable(false);
export const ambientScene   = writable<SceneId>('rain');

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

function buildRain(ctx: AudioContext, master: GainNode) {
  const rev = makeReverb(ctx, 1.4, 3);
  rev.connect(master);

  // Low rumble — ground presence
  const rumble = noiseBand(ctx, makeNoiseBuf(ctx, 5), 'lowpass', 180, 0.8, 0.45, rev);
  lfo(ctx, 0.04, 22, rumble.filter.frequency);

  // Mid splatter — the actual rainfall
  const splatter = noiseBand(ctx, makeNoiseBuf(ctx, 4), 'bandpass', 1600, 0.6, 0.55, rev);
  lfo(ctx, 0.07, 0.07, splatter.gain.gain);

  // High hiss — fine droplets, distant
  const hiss = noiseBand(ctx, makeNoiseBuf(ctx, 3), 'highpass', 6000, 0.5, 0.18, rev);
  lfo(ctx, 0.11, 0.05, hiss.gain.gain);
}

function buildForest(ctx: AudioContext, master: GainNode) {
  const rev = makeReverb(ctx, 2.8, 4);
  rev.connect(master);

  // Wind body — low, slow gusts
  const wind = noiseBand(ctx, makeNoiseBuf(ctx, 6), 'bandpass', 320, 0.4, 0.45, rev);
  lfo(ctx, 0.025, 80, wind.filter.frequency);
  lfo(ctx, 0.04, 0.08, wind.gain.gain);

  // Canopy rustle — mid-high
  const rustle = noiseBand(ctx, makeNoiseBuf(ctx, 4), 'bandpass', 2400, 1.2, 0.14, rev);
  lfo(ctx, 0.06, 0.07, rustle.gain.gain);

  // Distant birds — barely there, resonant peaks
  const birds = noiseBand(ctx, makeNoiseBuf(ctx, 3), 'bandpass', 4200, 4.0, 0.055, rev);
  lfo(ctx, 0.19, 0.04, birds.gain.gain);
}

function buildRiver(ctx: AudioContext, master: GainNode) {
  const rev = makeReverb(ctx, 2.2, 3.5);
  rev.connect(master);

  // Deep body — subsonic current
  const body = noiseBand(ctx, makeNoiseBuf(ctx, 5), 'lowpass', 380, 0.5, 0.5, rev);
  lfo(ctx, 0.05, 55, body.filter.frequency);

  // Gurgling mid — the interesting part
  const gurgle = noiseBand(ctx, makeNoiseBuf(ctx, 4), 'bandpass', 900, 1.0, 0.42, rev);
  lfo(ctx, 0.13, 160, gurgle.filter.frequency);
  lfo(ctx, 0.08, 0.06, gurgle.gain.gain);

  // Surface shimmer — fine water catching light
  const surface = noiseBand(ctx, makeNoiseBuf(ctx, 3), 'bandpass', 3800, 0.7, 0.16, rev);
  lfo(ctx, 0.09, 0.05, surface.gain.gain);
}

function buildDrone(ctx: AudioContext, master: GainNode) {
  const rev = makeReverb(ctx, 5, 5);
  rev.connect(master);

  // 111 Hz — ancient/sacred base frequency, with fifth, octave, and 12th
  const freqs = [111, 166.5, 222, 333];
  freqs.forEach((f, i) => {
    // Left and right slightly detuned for binaural beating (~2–5 Hz diff)
    [-0.6, 0.6].forEach((pan, ch) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
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
 * Bowls — singing bowl resonances with binaural beating.
 *
 * Your turn, Chef. The structure is ready — fill in the frequencies and feel.
 * Suggested: stack sines at Solfège / Pythagorean frequencies.
 * Each split L/R with a ~4 Hz binaural beat difference.
 * Long reverb. Very slow pitch LFO (0.01 Hz, depth ~1 Hz).
 */
export function buildBowls(ctx: AudioContext, master: GainNode) {
  const rev = makeReverb(ctx, 5, 6);
  rev.connect(master);

  // TODO: define your bowl frequencies here
  // Each entry: [rootHz, binauralBeatHz, relativeGain]
  const bowls: [number, number, number][] = [
    // e.g. [174, 4, 0.25],
    // e.g. [285, 3, 0.20],
    // e.g. [396, 4, 0.18],
    // e.g. [528, 5, 0.14],
  ];

  if (bowls.length === 0) {
    // Fallback until Chef implements
    buildDrone(ctx, master);
    return;
  }

  bowls.forEach(([rootHz, beatHz, gainVal]) => {
    [-0.7, 0.7].forEach((pan, ch) => {
      const osc    = ctx.createOscillator();
      const gain   = ctx.createGain();
      const panner = ctx.createStereoPanner();
      osc.type = 'sine';
      osc.frequency.value = rootHz + ch * beatHz;
      gain.gain.value = gainVal;
      panner.pan.value = pan;
      lfo(ctx, 0.01, 1.0, osc.frequency);
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
    case 'rain':   buildRain(audioCtx, masterGain);   break;
    case 'forest': buildForest(audioCtx, masterGain); break;
    case 'river':  buildRiver(audioCtx, masterGain);  break;
    case 'drone':  buildDrone(audioCtx, masterGain);  break;
    case 'bowls':  buildBowls(audioCtx, masterGain);  break;
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
