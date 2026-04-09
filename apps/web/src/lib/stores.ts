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
			localStorage.removeItem('clea_session_id');
			localStorage.removeItem('clea_active_rite');
			localStorage.removeItem('clea_pending_rite');
			localStorage.removeItem('clea_guest_token');
			localStorage.removeItem('clea_covenant_prompt_armed');
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
	markdown?: string;  // full practice text (rites only)
	fields?: Record<string, unknown>; // practice metadata (act, duration, vagalStates, textures, …)
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
export const covenantAcceptedTick = writable(0); // incremented when the covenant is explicitly accepted

function covenantPromptArmStore() {
	const stored = browser ? localStorage.getItem('clea_covenant_prompt_armed') : null;
	const { subscribe, set } = writable<boolean>(stored === 'true');
	return {
		subscribe,
		arm() {
			if (browser) localStorage.setItem('clea_covenant_prompt_armed', 'true');
			set(true);
		},
		disarm() {
			if (browser) localStorage.removeItem('clea_covenant_prompt_armed');
			set(false);
		}
	};
}

export const covenantPromptArmed = covenantPromptArmStore();

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

function activeRiteStore() {
	const stored = browser ? localStorage.getItem('clea_active_rite') : null;
	const { subscribe, set } = writable<RiteData | null>(stored ? JSON.parse(stored) : null);
	return {
		subscribe,
		set(v: RiteData | null) {
			if (browser) {
				if (v) localStorage.setItem('clea_active_rite', JSON.stringify(v));
				else localStorage.removeItem('clea_active_rite');
			}
			set(v);
		}
	};
}
export const activeRite = activeRiteStore();
// activeCard reuses CardData — set when a card is drawn, cleared on interpret/dismiss
export const activeCard = writable<CardData | null>(null);

// pendingRite persists across sessions — set when a rite is prescribed, cleared on complete
export interface PendingRite {
	rite: RiteData;
	stage: 'offered' | 'received' | 'enacted';
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

export type TtsVoice = string; // Fish Audio voice id, e.g. 'elf'
const VALID_TTS_VOICES = new Set(['elf', 'poet', 'alien', 'president']);

function ttsVoiceStore() {
	const stored = browser ? localStorage.getItem('clea_tts_voice') : null;
	// Migrate legacy Kokoro ids (af_*, am_*, bf_*, bm_*) and stale values to the default voice
	const raw = stored ?? 'elf';
	const migrated = /^(af_|am_|bf_|bm_)/.test(raw) || !VALID_TTS_VOICES.has(raw) ? 'elf' : raw;
	const { subscribe, set } = writable<TtsVoice>(migrated);
	return {
		subscribe,
		set(v: TtsVoice) {
			if (browser) localStorage.setItem('clea_tts_voice', v);
			set(v);
		}
	};
}
export const ttsVoice = ttsVoiceStore();

// ── SeekerState ────────────────────────────────────────────────────────────────
// Aggregated state visible in the status panel: identity + inferences
export interface VagalInfo {
	probable: 'ventral' | 'sympathetic' | 'dorsal' | 'mixed' | null;
	confidence: 'low' | 'medium' | 'high' | null;
	reasoning?: string;
}

export interface BeliefInfo {
	pattern: 'scarcity' | 'unworthiness' | 'control' | 'isolation' | 'silence' | 'blindness' | 'separation' | null;
	confidence: 'low' | 'medium' | 'high' | null;
	reasoning?: string;
}

export interface QualityInfo {
	quality: 'entity' | 'affinity' | 'activity' | 'pity' | 'capacity' | 'causality' | 'eternity' | 'unity' | 'calamity' | 'cyclicity' | null;
	confidence: 'low' | 'medium' | 'high' | null;
	is_shock: boolean;
	reasoning?: string;
}

export interface AffectInfo {
	valence: number | null; // -1.0 to +1.0
	arousal: number | null; // -1.0 to +1.0
	gloss: string | null;
	confidence: 'low' | 'medium' | 'high' | null;
	reasoning?: string;
}

export interface SeekerState {
	handle?: string | null;
	vagal: VagalInfo;
	belief: BeliefInfo;
	quality: QualityInfo;
	affect: AffectInfo;
}

function seekerStateStore() {
	const initial: SeekerState = {
		handle: null,
		vagal: { probable: null, confidence: null },
		belief: { pattern: null, confidence: null },
		quality: { quality: null, confidence: null, is_shock: false },
		affect: { valence: null, arousal: null, gloss: null, confidence: null },
	};
	const stored = browser ? localStorage.getItem('clea_seeker_state') : null;
	const start = stored ? { ...initial, ...JSON.parse(stored) } as SeekerState : initial;
	const { subscribe, set, update } = writable<SeekerState>(start);
	const persist = (value: SeekerState) => {
		if (!browser) return;
		localStorage.setItem('clea_seeker_state', JSON.stringify(value));
	};
	return {
		subscribe,
		set: (v: SeekerState) => {
			persist(v);
			set(v);
		},
		update: (fn: (prev: SeekerState) => SeekerState) => update(prev => {
			const next = fn(prev);
			persist(next);
			return next;
		}),
		setPartial: (fn: Partial<SeekerState> | ((prev: SeekerState) => Partial<SeekerState>)) => {
			if (typeof fn === 'function') {
				update(prev => {
					const next = { ...prev, ...(fn as (prev: SeekerState) => Partial<SeekerState>)(prev) };
					persist(next);
					return next;
				});
			} else {
				update(prev => {
					const next = { ...prev, ...fn };
					persist(next);
					return next;
				});
			}
		},
		reset: () => {
			if (browser) localStorage.removeItem('clea_seeker_state');
			set(initial);
		},
	};
}

export const seekerState = seekerStateStore();
