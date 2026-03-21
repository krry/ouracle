/**
 * tts-client.ts — client-side TTS via Kokoro-82M (default) or Web Speech API (fallback)
 *
 * synthesize(text, voice) → ArrayBuffer (WAV) or null (Web Speech already spoke it)
 * preloadKokoro()         → kick off model download during idle time
 * KOKORO_VOICES           → list of available voices for the UI
 */
import { browser } from '$app/environment';

// ── Voice catalogue ────────────────────────────────────────────────────────

export interface KokoroVoice {
	id: string;
	label: string;
	note: string;
}

export const KOKORO_VOICES: KokoroVoice[] = [
	{ id: 'af_bella',    label: 'Bella',    note: 'warm · soft' },
	{ id: 'af_heart',    label: 'Heart',    note: 'warm · expressive' },
	{ id: 'af_nicole',   label: 'Nicole',   note: 'calm · clear' },
	{ id: 'af_aoede',    label: 'Aoede',    note: 'bright · melodic' },
	{ id: 'af_kore',     label: 'Kore',     note: 'expressive' },
	{ id: 'af_sarah',    label: 'Sarah',    note: 'natural' },
	{ id: 'am_adam',     label: 'Adam',     note: 'calm · deep' },
	{ id: 'am_michael',  label: 'Michael',  note: 'clear · steady' },
	{ id: 'am_onyx',     label: 'Onyx',     note: 'deep · resonant' },
	{ id: 'bf_emma',     label: 'Emma',     note: 'British · clear' },
	{ id: 'bf_isabella', label: 'Isabella', note: 'British · warm' },
	{ id: 'bm_george',   label: 'George',   note: 'British · calm' },
];

export const DEFAULT_VOICE = 'af_bella';

// ── Kokoro singleton ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _kokoro: any = null;
let _kokoroLoading = false;
let _kokoroReady = false;

async function getKokoro() {
	if (!browser) return null;
	if (_kokoroReady) return _kokoro;
	if (_kokoroLoading) {
		while (_kokoroLoading) await new Promise(r => setTimeout(r, 80));
		return _kokoro;
	}
	_kokoroLoading = true;
	try {
		const { KokoroTTS } = await import('kokoro-js');
		_kokoro = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0', { dtype: 'q8' });
		_kokoroReady = true;
	} catch (e) {
		console.warn('[TTS] Kokoro failed to load — falling back to Web Speech', e);
	} finally {
		_kokoroLoading = false;
	}
	return _kokoro;
}

/** Kick off the model download during browser idle time. */
export function preloadKokoro() {
	if (!browser) return;
	const load = () => getKokoro();
	if (typeof requestIdleCallback !== 'undefined') {
		requestIdleCallback(load, { timeout: 8000 });
	} else {
		setTimeout(load, 2000);
	}
}

// ── WAV encoder ────────────────────────────────────────────────────────────

function floatArrayToWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
	const buf = new ArrayBuffer(44 + samples.length * 2);
	const v = new DataView(buf);
	const str = (off: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
	str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true);
	str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true);
	v.setUint16(20, 1, true);                      // PCM
	v.setUint16(22, 1, true);                      // mono
	v.setUint32(24, sampleRate, true);
	v.setUint32(28, sampleRate * 2, true);
	v.setUint16(32, 2, true); v.setUint16(34, 16, true);
	str(36, 'data'); v.setUint32(40, samples.length * 2, true);
	let off = 44;
	for (let i = 0; i < samples.length; i++) {
		const s = Math.max(-1, Math.min(1, samples[i]));
		v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
		off += 2;
	}
	return buf;
}

// ── Web Speech fallback ────────────────────────────────────────────────────

function webSpeech(text: string): Promise<void> {
	return new Promise(resolve => {
		if (!browser || !('speechSynthesis' in window)) { resolve(); return; }
		const u = new SpeechSynthesisUtterance(text);
		u.rate = 0.88;
		u.pitch = 0.92;
		// Prefer a calm, natural-sounding voice
		const voices = speechSynthesis.getVoices();
		const preferred = voices.find(v =>
			/Samantha|Karen|Moira|Fiona|Siri/i.test(v.name) && v.lang.startsWith('en')
		);
		if (preferred) u.voice = preferred;
		u.onend = () => resolve();
		u.onerror = () => resolve();
		speechSynthesis.speak(u);
	});
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Synthesize text to audio.
 * Returns an ArrayBuffer (WAV) if Kokoro is ready, or null after speaking
 * via Web Speech API (already audible; nothing to enqueue).
 */
export async function synthesize(text: string, voice: string): Promise<ArrayBuffer | null> {
	if (!browser || !text.trim()) return null;

	const kokoro = await getKokoro();
	if (kokoro) {
		try {
			const result = await kokoro.generate(text, { voice });
			return floatArrayToWav(result.audio, result.sampling_rate);
		} catch (e) {
			console.warn('[TTS] Kokoro generate failed:', e);
		}
	}

	// Fallback: Web Speech API speaks synchronously, return null
	await webSpeech(text);
	return null;
}
