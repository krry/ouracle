<script lang="ts">
	import { onMount } from 'svelte';
	import { creds, messages, streaming, voiceState, waveform, ptt, ambience } from './stores';
	import { newSession, streamChat, tts, stt } from './api';
	import Breath from './Breath.svelte';
	import type { Credentials } from './stores';

	let sessionId = '';
	let input = '';
	let msgList: HTMLElement;
	let audioCtx: AudioContext;
	let mediaRecorder: MediaRecorder | null = null;
	let chunks: Blob[] = [];

	// init session on mount
	onMount(async () => {
		const c = $creds as Credentials;
		try {
			const s = await newSession(c.access_token);
			sessionId = s.session_id;
		} catch {
			creds.logout();
		}
	});

	// scroll to bottom on new messages
	$: if ($messages && msgList) {
		setTimeout(() => msgList.scrollTo({ top: msgList.scrollHeight, behavior: 'smooth' }), 50);
	}

	async function send(text: string) {
		if (!text.trim() || $streaming) return;
		const c = $creds as Credentials;
		messages.update(m => [...m, { role: 'user', content: text }]);
		messages.update(m => [...m, { role: 'assistant', content: '' }]);
		streaming.set(true);

		try {
			for await (const _ of streamChat(sessionId, c.access_token, text, (chunk) => {
				messages.update(m => {
					const last = m[m.length - 1];
					last.content += chunk;
					return [...m];
				});
			})) { /* yield */ }
		} finally {
			streaming.set(false);
		}
	}

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
		audioCtx ??= new AudioContext();
		const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

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
		tick();

		chunks = [];
		mediaRecorder = new MediaRecorder(stream);
		mediaRecorder.ondataavailable = e => chunks.push(e.data);
		mediaRecorder.start();
		voiceState.set('listening');
	}

	async function stopListening() {
		if (!mediaRecorder) return;
		voiceState.set('transcribing');
		mediaRecorder.stop();
		const c = $creds as Credentials;
		await new Promise<void>(res => { mediaRecorder!.onstop = () => res(); });
		const blob = new Blob(chunks, { type: 'audio/webm' });
		mediaRecorder.stream.getTracks().forEach(t => t.stop());
		mediaRecorder = null;

		try {
			const text = await stt(blob, c.access_token);
			voiceState.set('idle');
			if (text) send(text);
		} catch {
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
					<p>{msg.content}</p>
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

	<!-- ambience slider -->
	<div class="controls">
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

.msg p {
	font-size: 0.95rem;
	line-height: 1.6;
	white-space: pre-wrap;
	word-break: break-word;
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
</style>
