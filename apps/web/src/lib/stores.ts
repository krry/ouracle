import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

// ── Auth ────────────────────────────────────────────────────────────────────
export interface Credentials {
	seeker_id: string;
	access_token: string;
	refresh_token: string;
}

function credStore() {
	const stored = browser ? localStorage.getItem('clea_creds') : null;
	const { subscribe, set } = writable<Credentials | null>(
		stored ? JSON.parse(stored) : null
	);
	return {
		subscribe,
		login(c: Credentials) {
			localStorage.setItem('clea_creds', JSON.stringify(c));
			set(c);
		},
		logout() {
			localStorage.removeItem('clea_creds');
			set(null);
		}
	};
}
export const creds = credStore();
export const authed = derived(creds, $c => $c !== null);

// ── Chat ────────────────────────────────────────────────────────────────────
export type Role = 'user' | 'assistant' | 'system';
export interface Message { role: Role; content: string; }

export const messages = writable<Message[]>([]);
export const streaming = writable(false);

// ── Voice ───────────────────────────────────────────────────────────────────
export type VoiceState = 'idle' | 'listening' | 'transcribing' | 'speaking';
export const voiceState = writable<VoiceState>('idle');
export const ptt = writable(true);          // push-to-talk vs always-on
export const waveform = writable<Float32Array>(new Float32Array(64));

// ── Ambience ─────────────────────────────────────────────────────────────────
export const ambience = writable(1.0);      // 0 = bare, 1 = full

// ── Guest session ─────────────────────────────────────────────────────────────
import { getGuestTurns } from './guestSession';

// Reactive view of the guest turn counter. Updated by Chat.svelte after each turn.
export const guestTurns = writable<number>(browser ? getGuestTurns() : 0);

export const ttsEnabled = writable(false);  // opt-in; user toggles in controls
