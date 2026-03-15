<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { creds, authed, messages, streaming, voiceState, waveform, ambience, guestTurns, ttsEnabled } from './stores';
	import { chat, tts, stt } from './api';
	import Breath from './Breath.svelte';
	import type { Credentials } from './stores';
	import { incrementGuestTurns, getGuestTurns, GUEST_LIMIT } from './guestSession';
	import { TotemSession } from './totemSession';
	import { renderMarkdown } from './markdown';
	import { createAudioQueue, type AudioQueue } from './audio';

	export let guestMode = false;

	let audioQueue: AudioQueue | null = null;
	let sessionId: string | null = null;
	let input = '';
	let msgList: HTMLElement;
	let audioCtx: AudioContext;
	let mediaRecorder: MediaRecorder | null = null;
	let chunks: Blob[] = [];

	let guestToken: string | null = null;
	let totemSession: TotemSession | null = null;

	async function ensureGuestToken(): Promise<void> {
		const stored = localStorage.getItem('clea_guest_token');
		if (stored && stored !== 'undefined') { guestToken = stored; return; }
		localStorage.removeItem('clea_guest_token');
		const BASE = import.meta.env.VITE_OURACLE_BASE_URL ?? 'https://api.ouracle.kerry.ink';
		const res = await fetch(`${BASE}/aspire`, { method: 'POST' });
		if (!res.ok) throw new Error(`/aspire failed: ${res.status}`);
		const { guest_token } = await res.json();
		localStorage.setItem('clea_guest_token', guest_token);
		guestToken = guest_token;
	}

	// scroll to bottom on new messages
	$: if ($messages && msgList) {
		setTimeout(() => msgList.scrollTo({ top: msgList.scrollHeight, behavior: 'smooth' }), 50);
	}

	async function send(text: string) {
		if ($streaming) return;
		audioQueue?.prime();
		const token = !guestMode ? ($creds as Credentials | null)?.access_token ?? '' : guestToken ?? '';
		// Only push user message if there's actual text (first turn may be empty — opens the session)
		if (text.trim()) {
			messages.update(m => [...m, { role: 'user', content: text }]);
			if (guestMode) {
				incrementGuestTurns();
				guestTurns.set(getGuestTurns());
			}
		}
		messages.update(m => [...m, { role: 'assistant', content: '' }]);
		streaming.set(true);

		try {
			for await (const _ of chat(token, text, sessionId, (event) => {
				if (event.type === 'session') {
					sessionId = event.session_id as string;
				} else if (event.type === 'token') {
					messages.update(m => {
						const last = m[m.length - 1];
						last.content += event.text as string;
						return [...m];
					});
				} else if (event.type === 'break') {
					// Priestess finished one block — enqueue for TTS, then start fresh message
					if ($ttsEnabled && audioQueue) {
						const msgs = get(messages);
						const last = msgs.at(-1);
						if (last?.role === 'assistant' && last.content) {
							audioQueue.enqueue(last.content);
						}
					}
					messages.update(m => [...m, { role: 'assistant', content: '' }]);
				}
			})) { /* yield */ }
		} catch (e: unknown) {
			const msg = e instanceof Error ? e.message : String(e);
			if (msg.includes('guest_limit')) {
				guestTurns.set(GUEST_LIMIT);
			}
		} finally {
			// Remove any trailing empty assistant message
			messages.update(m => m.filter((msg, i) => !(msg.role === 'assistant' && msg.content === '' && i === m.length - 1)));
			// Enqueue last assistant message for TTS (catches streams with no 'break' event)
			if ($ttsEnabled && audioQueue) {
				const msgs = get(messages);
				const last = msgs.at(-1);
				if (last?.role === 'assistant' && last.content) {
					audioQueue.enqueue(last.content);
				}
			}
			streaming.set(false);
		}
	}

	// Open session on mount — /chat with no session_id bootstraps it
	onMount(async () => {
		if (guestMode) {
			await ensureGuestToken();
			audioQueue = createAudioQueue((t) => tts(t, guestToken ?? ''));
		} else if ($authed && $creds) {
			const c = $creds as Credentials;
			audioQueue = createAudioQueue((t) => tts(t, c.access_token));
			totemSession = new TotemSession(c.access_token, c.seeker_id);
			totemSession.load().catch(() => {}); // non-blocking, non-fatal
		}
		send('');
	});

	onDestroy(() => {
		audioQueue?.flush();
		audioQueue = null;
		if (totemSession && sessionId) {
			totemSession.distillAndSave(sessionId).catch(() => {});
		}
	});

	function handleKey(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			const text = input.trim();
			input = '';
			send(text);
		}
	}

	// ── PTT voice ─────────────────────────────────────────────────────────────
	async function startListening() {
		if (!navigator.mediaDevices?.getUserMedia) {
			console.warn('getUserMedia not available — requires a secure context (HTTPS or localhost)');
			return;
		}
		audioCtx ??= new AudioContext();
		let stream: MediaStream;
		try {
			stream = await navigator.mediaDevices.getUserMedia({ audio: true });
		} catch (e) {
			console.error('getUserMedia failed:', e);
			voiceState.set('idle');
			return;
		}

		// waveform analyser
		const src = audioCtx.createMediaStreamSource(stream);
		const analyser = audioCtx.createAnalyser();
		analyser.fftSize = 128;
		src.connect(analyser);
		const buf = new Float32Array(analyser.frequencyBinCount);
		function tick() {
			if ($voiceState !== 'listening') return;
			analyser.getFloatTimeDomainData(buf);
			waveform.set(buf.slice());
			requestAnimationFrame(tick);
		}

		chunks = [];
		mediaRecorder = new MediaRecorder(stream);
		mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
		mediaRecorder.start();
		audioQueue?.prime();
		voiceState.set('listening');
		tick();
	}

	async function stopListening() {
		if (!mediaRecorder) return;
		voiceState.set('transcribing');
		mediaRecorder.stop();
		const token = guestMode ? (guestToken ?? '') : (($creds as Credentials | null)?.access_token ?? '');
		await new Promise<void>(res => { mediaRecorder!.onstop = () => res(); });
		const mimeType = mediaRecorder.mimeType || 'audio/webm';
		const blob = new Blob(chunks, { type: mimeType });
		if (blob.size === 0) { voiceState.set('idle'); return; }
		mediaRecorder.stream.getTracks().forEach(t => t.stop());
		mediaRecorder = null;

		try {
			const text = await stt(blob, token);
			voiceState.set('idle');
			if (text) send(text);
		} catch (e) {
			console.error('STT failed:', e);
			voiceState.set('idle');
		}
	}
</script>

<div class="shell">
	<!-- ambient waveform layer -->
	<div class="breath-layer">
		<Breath />
	</div>

	<!-- message list -->
	<div class="msgs" bind:this={msgList}>
		{#each $messages as msg}
			{#if msg.role !== 'system'}
				<div class="msg {msg.role}">
					<span class="label">{msg.role === 'user' ? 'you' : 'ouracle'}</span>
					<div class="prose">{@html renderMarkdown(msg.content)}</div>
				</div>
			{/if}
		{/each}
		{#if $streaming}
			<div class="thinking">▋</div>
		{/if}
	</div>

	<!-- input bar -->
	<div class="bar">
		<textarea
			bind:value={input}
			on:keydown={handleKey}
			placeholder="speak…"
			rows="1"
			disabled={$streaming}
		></textarea>

		<button
			class="ptt"
			class:active={$voiceState === 'listening'}
			on:pointerdown={startListening}
			on:pointerup={stopListening}
			aria-label="hold to speak"
		>
			{$voiceState === 'listening' ? '◉' : $voiceState === 'transcribing' ? '…' : '◎'}
		</button>
	</div>

	<!-- ambience slider + TTS toggle -->
	<div class="controls">
		<label class="tts-toggle" title={$ttsEnabled ? 'mute voice' : 'enable voice'}>
			<input type="checkbox" bind:checked={$ttsEnabled} />
			<span>{$ttsEnabled ? '◈' : '◇'}</span>
		</label>
		<input
			type="range" min="0" max="1" step="0.01"
			bind:value={$ambience}
			aria-label="ambience"
		/>
	</div>
</div>

<style>
.shell {
	height: 100dvh;
	display: flex;
	flex-direction: column;
	position: relative;
}

.breath-layer {
	position: absolute;
	inset: 0;
	pointer-events: none;
	opacity: calc(var(--ambience, 1) * 0.6);
}

.msgs {
	flex: 1;
	overflow-y: auto;
	padding: 2rem 1.5rem 1rem;
	display: flex;
	flex-direction: column;
	gap: 1.5rem;
	scroll-behavior: smooth;
}

.msg { display: flex; flex-direction: column; gap: 0.25rem; }

.label {
	font-size: 0.65rem;
	letter-spacing: 0.15em;
	color: var(--muted);
}

.msg.user .label { color: var(--accent); }

.prose {
	font-size: 0.95rem;
	line-height: 1.6;
	word-break: break-word;
}

.prose :global(p) { margin: 0; line-height: 1.6; }
.prose :global(p + p) { margin-top: 0.75rem; }
.prose :global(strong) { color: var(--text); font-weight: 600; }
.prose :global(em) { color: var(--muted); font-style: italic; }
.prose :global(code) {
	background: var(--surface);
	border: 1px solid var(--border);
	border-radius: 2px;
	font-size: 0.85em;
	padding: 0.1em 0.3em;
}
.prose :global(pre) {
	background: var(--surface);
	border: 1px solid var(--border);
	border-radius: var(--radius);
	overflow-x: auto;
	padding: 0.75rem 1rem;
	margin-top: 0.5rem;
}
.prose :global(a) { color: var(--accent); }
.prose :global(ul), .prose :global(ol) {
	padding-left: 1.4rem;
	margin-top: 0.4rem;
}

.thinking {
	color: var(--muted);
	animation: blink 1s step-end infinite;
}

@keyframes blink { 50% { opacity: 0; } }

.bar {
	display: flex;
	align-items: flex-end;
	gap: 0.5rem;
	padding: 0.75rem 1rem;
	border-top: 1px solid var(--border);
	background: var(--bg);
}

textarea {
	flex: 1;
	background: var(--surface);
	border: 1px solid var(--border);
	border-radius: var(--radius);
	color: var(--text);
	font-family: var(--font-mono);
	font-size: 0.95rem;
	line-height: 1.5;
	padding: 0.5rem 0.75rem;
	resize: none;
	outline: none;
	transition: border-color 0.15s;
	max-height: 8rem;
	overflow-y: auto;
}

textarea:focus { border-color: var(--accent); }

.ptt {
	background: var(--surface);
	border: 1px solid var(--border);
	border-radius: 50%;
	color: var(--muted);
	cursor: pointer;
	font-size: 1.2rem;
	height: 2.5rem;
	width: 2.5rem;
	display: grid;
	place-items: center;
	transition: all 0.1s;
	touch-action: none;
	user-select: none;
}

.ptt.active {
	border-color: var(--accent);
	color: var(--accent);
	box-shadow: 0 0 0 3px hsl(var(--hue), 60%, 65%, 0.2);
}

.controls {
	display: flex;
	justify-content: flex-end;
	padding: 0.25rem 1rem 0.5rem;
}

input[type="range"] {
	appearance: none;
	background: var(--border);
	border-radius: 2px;
	height: 2px;
	width: 80px;
	cursor: pointer;
}

input[type="range"]::-webkit-slider-thumb {
	appearance: none;
	background: var(--muted);
	border-radius: 50%;
	height: 10px;
	width: 10px;
}

.tts-toggle {
	display: grid;
	place-items: center;
	cursor: pointer;
	color: var(--muted);
	font-size: 1rem;
}
.tts-toggle input { display: none; }
.tts-toggle:has(input:checked) { color: var(--accent); }
</style>
