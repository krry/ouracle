const BASE = import.meta.env.VITE_OURACLE_BASE_URL ?? 'https://api.ouracle.kerry.ink';
import type { TtsVoice } from './stores';

function authHeaders(token: string): HeadersInit {
	return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export async function signup(name: string, password: string) {
	const r = await fetch(`${BASE}/seeker/new`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name, password })
	});
	if (!r.ok) throw new Error(await r.text());
	return r.json();
}

export async function signin(handle: string, password: string) {
	const r = await fetch(`${BASE}/auth/token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ handle, password })
	});
	if (!r.ok) throw new Error(await r.text());
	return r.json();
}

// ── Enquire (SSE) ──────────────────────────────────────────────────────────────
// /enquire handles both new sessions (no session_id) and continuing ones.
// Events: { type: 'session', session_id, stage }
//         { type: 'token', text }
//         { type: 'audio', base64, sentence_index }
//         { type: 'break' }
//         { type: 'draw', card: CardData }
//         { type: 'rite', rite: RiteData }   — structured rite, rendered in OraclePanel
//         { type: 'complete', stage, session_id? }
//         { type: 'error', message }
export async function* enquire(
	token: string,
	message: string,
	sessionId: string | null,
	onEvent: (event: Record<string, unknown>) => void,
	mode?: string,
	ttsEnabled?: boolean,
	voice?: TtsVoice
): AsyncGenerator<void> {
	const r = await fetch(`${BASE}/enquire`, {
		method: 'POST',
		headers: authHeaders(token),
		body: JSON.stringify({
			message,
			session_id: sessionId ?? undefined,
			...(mode ? { mode } : {}),
			...(ttsEnabled !== undefined ? { muted: !ttsEnabled } : {}),
			...(voice ? { voice } : {})
		})
	});
	if (!r.ok) {
		const text = await r.text();
		const err = new Error(text) as Error & { status: number };
		err.status = r.status;
		throw err;
	}
	const reader = r.body!.getReader();
	const dec = new TextDecoder();
	let buffer = '';
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += dec.decode(value, { stream: true });
		const lines = buffer.split('\n');
		buffer = lines.pop() ?? '';
		for (const line of lines) {
			if (!line.startsWith('data: ')) continue;
			try {
				const event = JSON.parse(line.slice(6));
				onEvent(event);
			} catch { /* skip malformed */ }
		}
		yield;
	}
	buffer += dec.decode();
	for (const line of buffer.split('\n')) {
		if (!line.startsWith('data: ')) continue;
		try {
			const event = JSON.parse(line.slice(6));
			onEvent(event);
		} catch { /* skip malformed */ }
	}
}

// ── TTS ───────────────────────────────────────────────────────────────────────
export async function tts(text: string, token: string, voice?: string): Promise<ArrayBuffer> {
	const r = await fetch(`${BASE}/tts`, {
		method: 'POST',
		headers: authHeaders(token),
		body: JSON.stringify({ text, ...(voice ? { voice } : {}) })
	});
	if (!r.ok) throw new Error(await r.text());
	return r.arrayBuffer();
}

// ── STT ───────────────────────────────────────────────────────────────────────
export async function stt(blob: Blob, token: string): Promise<string> {
	const r = await fetch(`${BASE}/stt`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${token}`, 'Content-Type': blob.type || 'audio/webm' },
		body: blob
	});
	if (!r.ok) throw new Error(await r.text());
	const json = await r.json();
	return json.text ?? '';
}

// ── Thread ─────────────────────────────────────────────────────────────────────
export interface ThreadSession {
	id: string;
	stage: string;
	quality: string | null;
	enacted: boolean | null;
	rite_name: string | null;
	rite_json: Record<string, unknown> | null;
	report: unknown;
	created_at: string;
	prescribed_at: string | null;
	completed_at: string | null;
}

export interface ConversationTurn {
	role: 'seeker' | 'clea';
	text: string;
	at?: string;
	affect?: { valence: number; arousal: number; gloss: string; confidence: string };
}

export interface FullSession extends ThreadSession {
	vagal_probable: string | null;
	vagal_confidence: string | null;
	belief_pattern: string | null;
	belief_confidence: string | null;
	quality_confidence: string | null;
	quality_is_shock: boolean | null;
	love_fear_audit: Record<string, unknown> | null;
	conversation: ConversationTurn[] | null;
	full_text: string | null;
}

export async function getRecord(sessionId: string, token: string): Promise<FullSession> {
	const r = await fetch(`${BASE}/session/${sessionId}`, {
		headers: authHeaders(token),
	});
	if (!r.ok) throw new Error(await r.text());
	return r.json();
}

export async function getThread(seekerId: string, token: string): Promise<ThreadSession[]> {
	const r = await fetch(`${BASE}/seeker/${seekerId}/thread`, {
		headers: authHeaders(token),
	});
	if (!r.ok) throw new Error(await r.text());
	const json = await r.json();
	return json.thread ?? [];
}

export async function redactSession(seekerId: string, sessionId: string, token: string): Promise<void> {
	const r = await fetch(`${BASE}/seeker/${seekerId}/thread/${sessionId}/redact`, {
		method: 'PATCH',
		headers: authHeaders(token),
	});
	if (!r.ok) throw new Error(await r.text());
}

export async function deleteAccount(seekerId: string, token: string): Promise<void> {
	const r = await fetch(`${BASE}/seeker/${seekerId}`, {
		method: 'DELETE',
		headers: authHeaders(token),
	});
	if (!r.ok) throw new Error(await r.text());
}
