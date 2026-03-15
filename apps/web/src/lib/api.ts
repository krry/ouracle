const BASE = import.meta.env.VITE_OURACLE_BASE_URL ?? 'https://api.ouracle.kerry.ink';

function headers(token?: string): HeadersInit {
	const h: HeadersInit = { 'Content-Type': 'application/json' };
	if (token) h['Authorization'] = `Bearer ${token}`;
	return h;
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export async function signup(name: string, password: string) {
	const r = await fetch(`${BASE}/seeker/new`, {
		method: 'POST',
		headers: headers(),
		body: JSON.stringify({ name, password })
	});
	if (!r.ok) throw new Error(await r.text());
	return r.json();
}

export async function signin(name: string, password: string) {
	const r = await fetch(`${BASE}/seeker/auth`, {
		method: 'POST',
		headers: headers(),
		body: JSON.stringify({ name, password })
	});
	if (!r.ok) throw new Error(await r.text());
	return r.json();
}

// ── Session ───────────────────────────────────────────────────────────────────
export async function newSession(token: string) {
	const r = await fetch(`${BASE}/session/new`, {
		method: 'POST',
		headers: headers(token)
	});
	if (!r.ok) throw new Error(await r.text());
	return r.json();
}

// ── Streaming chat ────────────────────────────────────────────────────────────
export async function* streamChat(
	sessionId: string,
	token: string,
	message: string,
	onChunk: (chunk: string) => void
): AsyncGenerator<void> {
	const r = await fetch(`${BASE}/session/${sessionId}/message`, {
		method: 'POST',
		headers: { ...headers(token), Accept: 'text/event-stream' },
		body: JSON.stringify({ message })
	});
	if (!r.ok) throw new Error(await r.text());
	const reader = r.body!.getReader();
	const dec = new TextDecoder();
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		const text = dec.decode(value, { stream: true });
		for (const line of text.split('\n')) {
			if (line.startsWith('data: ')) {
				const data = line.slice(6).trim();
				if (data && data !== '[DONE]') onChunk(data);
			}
		}
		yield;
	}
}

// ── TTS ───────────────────────────────────────────────────────────────────────
export async function tts(text: string, token: string): Promise<ArrayBuffer> {
	const r = await fetch(`${BASE}/tts`, {
		method: 'POST',
		headers: headers(token),
		body: JSON.stringify({ text })
	});
	if (!r.ok) throw new Error(await r.text());
	return r.arrayBuffer();
}

// ── STT ───────────────────────────────────────────────────────────────────────
export async function stt(blob: Blob, token: string): Promise<string> {
	const form = new FormData();
	form.append('audio', blob, 'recording.webm');
	const r = await fetch(`${BASE}/stt`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${token}` },
		body: form
	});
	if (!r.ok) throw new Error(await r.text());
	const json = await r.json();
	return json.text ?? '';
}
