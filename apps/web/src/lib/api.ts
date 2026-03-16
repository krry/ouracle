const BASE = import.meta.env.VITE_OURACLE_BASE_URL ?? 'https://api.ouracle.kerry.ink';

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

// ── Chat (SSE) ────────────────────────────────────────────────────────────────
// /chat handles both new sessions (no session_id) and continuing ones.
// Events: { type: 'session', session_id, stage }
//         { type: 'token', text }
//         { type: 'break' }
//         { type: 'complete', stage, session_id? }
//         { type: 'error', message }
export async function* chat(
	token: string,
	message: string,
	sessionId: string | null,
	onEvent: (event: Record<string, unknown>) => void,
	mode?: string
): AsyncGenerator<void> {
	const r = await fetch(`${BASE}/chat`, {
		method: 'POST',
		headers: authHeaders(token),
		body: JSON.stringify({ message, session_id: sessionId ?? undefined, ...(mode ? { mode } : {}) })
	});
	if (!r.ok) throw new Error(await r.text());
	const reader = r.body!.getReader();
	const dec = new TextDecoder();
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		const text = dec.decode(value, { stream: true });
		for (const line of text.split('\n')) {
			if (!line.startsWith('data: ')) continue;
			try {
				const event = JSON.parse(line.slice(6));
				onEvent(event);
			} catch { /* skip malformed */ }
		}
		yield;
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
