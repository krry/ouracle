import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

const BASE = import.meta.env.VITE_OURACLE_BASE_URL ?? 'https://api.ouracle.kerry.ink';

export const TRACKS = [
  { id: 'scene-forest-edge', label: 'forest' },
  { id: 'scene-drops',       label: 'rain' },
  { id: 'water',             label: 'water' },
  { id: 'birdsong',          label: 'birds' },
  { id: 'singing-bowls',     label: 'bowls' },
  { id: 'scene-deep-jungle', label: 'jungle' },
  { id: 'scene-deluge',      label: 'storm' },
] as const;

export type TrackId = typeof TRACKS[number]['id'];

export const ambientOn    = writable(false);
export const ambientTrack = writable<TrackId>('scene-forest-edge');

let audio: HTMLAudioElement | null = null;

function getOrCreate(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio();
    audio.loop = true;
    audio.preload = 'none';
  }
  return audio;
}

export function setVolume(v: number) {
  if (audio) audio.volume = Math.max(0, Math.min(1, v));
}

export function playTrack(id: TrackId, volume: number) {
  if (!browser) return;
  const el = getOrCreate();
  const url = `${BASE}/ambient/${id}.mp3`;
  if (el.src !== url) {
    el.src = url;
    el.load();
  }
  el.volume = volume;
  el.play().catch(() => {});
  ambientOn.set(true);
  ambientTrack.set(id);
}

export function stopAmbient() {
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
  }
  ambientOn.set(false);
}

export function toggleAmbient(volume: number) {
  if (get(ambientOn)) {
    stopAmbient();
  } else {
    playTrack(get(ambientTrack), volume);
  }
}

export function cycleTrack(volume: number) {
  const current = get(ambientTrack);
  const idx = TRACKS.findIndex(t => t.id === current);
  const next = TRACKS[(idx + 1) % TRACKS.length];
  playTrack(next.id, volume);
}
