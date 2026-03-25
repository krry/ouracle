/**
 * tts-client.ts — Web Speech API fallback for when Fish Audio (server-sent) is unavailable.
 *
 * Primary TTS path: server pre-fetches audio via Fish Audio and sends sentence_audio
 * SSE events (base64 MP3) that Chat.svelte decodes and passes to AudioQueue.enqueueBuffer().
 * This file handles the fallback when Fish Audio is unavailable.
 */
import { browser } from '$app/environment';

// ── Voice catalogue (Fish Audio voices) ──────────────────────────────────────

export interface FishVoice {
	id: string;
	label: string;
	note: string;
}

export const FISH_VOICES: FishVoice[] = [
	{ id: 'elf',       label: 'Galadriel',  note: 'warm · otherworldly' },
	{ id: 'poet',      label: 'Ondrea',     note: 'calm · expressive'   },
	{ id: 'alien',     label: 'Alf',        note: 'strange · distinct'  },
	{ id: 'president', label: 'Oprah',      note: 'rich · resonant'     },
];

// Backward-compat alias — layout and Chat import KOKORO_VOICES; no rename needed yet
export const KOKORO_VOICES = FISH_VOICES;

export const DEFAULT_VOICE = 'elf';

// ── Web Speech fallback ───────────────────────────────────────────────────────

export function webSpeech(text: string): Promise<void> {
	return new Promise(resolve => {
		if (!browser || !('speechSynthesis' in window)) { resolve(); return; }
		const u = new SpeechSynthesisUtterance(text);
		u.rate = 0.88;
		u.pitch = 0.92;
		const voices = speechSynthesis.getVoices();
		const preferred = voices.find(v =>
			/Samantha|Karen|Moira|Fiona|Siri/i.test(v.name) && v.lang.startsWith('en')
		);
		if (preferred) u.voice = preferred;
		u.onend  = () => resolve();
		u.onerror = () => resolve();
		speechSynthesis.speak(u);
	});
}

/** No-op: Kokoro removed. Web Speech fallback is triggered directly in Chat.svelte. */
export function preloadKokoro() { /* no-op */ }

/**
 * synthesize() — kept for AudioQueue API compatibility.
 * Speaks via Web Speech and returns null (already audible; nothing to buffer).
 */
export async function synthesize(text: string, _voice: string): Promise<ArrayBuffer | null> {
	if (!browser || !text.trim()) return null;
	await webSpeech(text);
	return null;
}
