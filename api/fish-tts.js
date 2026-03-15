/**
 * fish-tts.js — Fish.audio TTS for Node/Bun
 *
 * Environment:
 *   FISH_AUDIO_API_KEY          (or FISH_API_KEY)
 *   FISH_AUDIO_MODEL            default: s1
 *   FISH_AUDIO_VOICE_GALADRIEL  voice reference_id
 */

import { spawn } from 'child_process';

function fishApiKey() {
  const key = process.env.FISH_AUDIO_API_KEY || process.env.FISH_API_KEY;
  if (!key) throw new Error('FISH_AUDIO_API_KEY is not set.');
  return key;
}

function fishVoiceId() {
  return process.env.FISH_AUDIO_VOICE_GALADRIEL || undefined;
}

function fishModel() {
  const m = process.env.FISH_AUDIO_MODEL || 's1';
  return m === 's2' ? 's2-pro' : m;
}

function fishBody(text) {
  const voiceId = fishVoiceId();
  return JSON.stringify({
    text,
    format: 'mp3',
    ...(voiceId ? { reference_id: voiceId } : {}),
  });
}

function fishHeaders() {
  return {
    Authorization: `Bearer ${fishApiKey()}`,
    'Content-Type': 'application/json',
    model: fishModel(),
  };
}

/**
 * fetchAudio(text) → Buffer
 * Fetches MP3 bytes from Fish.audio. Does not play.
 * Fire this early so bytes are ready when you need them.
 */
export async function fetchAudio(text) {
  const res = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: fishHeaders(),
    body: fishBody(text),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Fish.audio ${res.status}: ${err}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

/**
 * playBuffer(buffer)
 * Plays an MP3 buffer via mpg123 stdin. No temp file.
 */
export async function playBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const proc = spawn('mpg123', ['-q', '-']);
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`mpg123 exit ${code}`))));
    proc.on('error', reject);
    proc.stdin.write(buffer);
    proc.stdin.end();
  });
}

/**
 * speak(text)
 * Option B: streams Fish.audio HTTP response body directly to mpg123 stdin.
 * Audio starts as soon as the first bytes arrive — no full-download wait.
 */
export async function speak(text) {
  const res = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: fishHeaders(),
    body: fishBody(text),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Fish.audio ${res.status}: ${err}`);
  }

  return new Promise((resolve, reject) => {
    const proc = spawn('mpg123', ['-q', '-']);
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`mpg123 exit ${code}`))));
    proc.on('error', reject);

    const reader = res.body.getReader();
    function pump() {
      reader.read().then(({ done, value }) => {
        if (done) { proc.stdin.end(); return; }
        proc.stdin.write(value);
        pump();
      }).catch(reject);
    }
    pump();
  });
}

export function hasFishKey() {
  return !!(process.env.FISH_AUDIO_API_KEY || process.env.FISH_API_KEY);
}
