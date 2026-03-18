import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

// ── Auth ────────────────────────────────────────────────────────────────────
export interface Credentials {
	seeker_id: string;
	access_token: string;
	refresh_token: string;
	handle?: string;
	stage?: string;
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
export type Role = 'user' | 'assistant' | 'system' | 'card';

export interface CardData {
	id: string;
	deck: string;
	deckLabel: string;
	title: string;
	keywords: string[];
	body: string;
}

export interface Message {
	role: Role;
	content: string;
	card?: CardData;
	interpreted?: boolean; // true once seeker has asked for interpretation
	isCovenantReminder?: boolean; // true for covenant reminder messages
}

export const messages = writable<Message[]>([]);
export const streaming = writable(false);

// ── Covenant ────────────────────────────────────────────────────────────────
export const needsCovenant = writable(false); // true until seeker has entered the covenant
export const covenantReady = writable(false); // true when fuzzy readiness detected → show modal
export const continueOffered = writable(false); // true when Clea offers to continue

// ── Oracle Panel ─────────────────────────────────────────────────────────────
export interface RiteData {
	rite_name: string;
	act: string;
	invocation?: string;
	textures?: string[];
	context?: string;
	duration?: string;
	divination?: unknown;
}

export const activeRite = writable<RiteData | null>(null);
// activeCard reuses CardData — set when a card is drawn, cleared on interpret/dismiss
export const activeCard = writable<CardData | null>(null);

// pendingRite persists across sessions — set when a rite is prescribed, cleared on complete
export interface PendingRite {
	rite: RiteData;
	stage: 'offered' | 'prescribed' | 'completed';
}

function pendingRiteStore() {
	const stored = browser ? localStorage.getItem('clea_pending_rite') : null;
	const { subscribe, set } = writable<PendingRite | null>(stored ? JSON.parse(stored) : null);
	return {
		subscribe,
		set(v: PendingRite | null) {
			if (browser) {
				if (v) localStorage.setItem('clea_pending_rite', JSON.stringify(v));
				else localStorage.removeItem('clea_pending_rite');
			}
			set(v);
		}
	};
}
export const pendingRite = pendingRiteStore();

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

function ttsStore() {
	const stored = browser ? localStorage.getItem('clea_tts') : null;
	const { subscribe, set } = writable<boolean>(stored === 'true');
	return {
		subscribe,
		set(v: boolean) {
			if (browser) localStorage.setItem('clea_tts', String(v));
			set(v);
		}
	};
}
export const ttsEnabled = ttsStore();

export type TtsVoice = 'elf' | 'poet' | 'alien' | 'president';

function ttsVoiceStore() {
	const stored = browser ? (localStorage.getItem('clea_tts_voice') as TtsVoice | null) : null;
	const { subscribe, set } = writable<TtsVoice>(stored ?? 'elf');
	return {
		subscribe,
		set(v: TtsVoice) {
			if (browser) localStorage.setItem('clea_tts_voice', v);
			set(v);
		}
	};
}
export const ttsVoice = ttsVoiceStore();
