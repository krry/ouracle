<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { creds, authed, messages, streaming, voiceState, waveform, guestTurns, ttsEnabled, ttsVoice } from './stores';
	import type { CardData, TtsVoice } from './stores';
	import { chat, tts, stt } from './api';
	import Breath from './Breath.svelte';
	import type { Credentials } from './stores';
	import { incrementGuestTurns, getGuestTurns, GUEST_LIMIT } from './guestSession';
	import { TotemSession } from './totemSession';
	import { renderMarkdown } from './markdown';
	import { createAudioQueue, type AudioQueue } from './audio';

	let { guestMode = false } = $props<{ guestMode?: boolean }>();

	let audioQueue: AudioQueue | null = null;
	let sessionId: string | null = null;
	let input = $state('');
	let msgList: HTMLElement;
	let audioCtx: AudioContext;
	let mediaRecorder: MediaRecorder | null = null;
	let chunks: Blob[] = [];

	let guestToken: string | null = null;
	let handle: string | null = null;
	let totemSession: TotemSession | null = null;

	// ── Deck picker ───────────────────────────────────────────────────────────
	type DeckMeta = { id: string; meta: { name?: string; description?: string }; count: number };
	let availableDecks = $state<DeckMeta[]>([]);
	let selectedDecks = $state<Set<string>>(new Set());
	let deckPickerOpen = $state(false);
	let drawing = $state(false);

	// ── PTT hint ──────────────────────────────────────────────────────────────
	// Hide the "hold to speak" hint after first successful transcription
	const PTT_SEEN_KEY = 'clea_ptt_seen';
	let pttSeen = $state(typeof localStorage !== 'undefined' && !!localStorage.getItem(PTT_SEEN_KEY));

	const BASE_URL = import.meta.env.VITE_OURACLE_BASE_URL ?? 'https://api.ouracle.kerry.ink';

	async function fetchDecks() {
		try {
			const r = await fetch(`${BASE_URL}/decks`);
			if (!r.ok) return;
			availableDecks = await r.json();
			selectedDecks = new Set(availableDecks.map(d => d.id));
		} catch { /* non-fatal */ }
	}

	async function drawCard() {
		if (drawing || $streaming || pendingCard) return;
		drawing = true;
		try {
			const params = new URLSearchParams();
			if (selectedDecks.size > 0 && selectedDecks.size < availableDecks.length) {
				params.set('decks', Array.from(selectedDecks).join(','));
			}
			const r = await fetch(`${BASE_URL}/draw?${params}`);
			if (!r.ok) return;
			const { cards } = await r.json();
			if (!cards?.length) return;
			const raw = cards[0];
			const deckMeta = availableDecks.find(d => d.id === raw.deck);
			const card: CardData = {
				id: raw.id,
				deck: raw.deck,
				deckLabel: deckMeta?.meta?.name ?? raw.deck,
				title: raw.title,
				keywords: raw.keywords ?? [],
				body: raw.body ?? '',
			};
			messages.update(m => [...m, { role: 'card', content: '', card, interpreted: false }]);
		} catch (e) {
			console.error('draw failed:', e);
		} finally {
			drawing = false;
		}
	}

	function interpret(card: CardData) {
		// Mark the card as interpreted
		messages.update(m => m.map(msg =>
			msg.role === 'card' && msg.card?.id === card.id && !msg.interpreted
				? { ...msg, interpreted: true }
				: msg
		));
		const text = `I drew a card — **${card.title}** from the ${card.deckLabel}.\n\nKeywords: ${card.keywords.join(' · ')}\n\n${card.body}\n\nPlease interpret this for me.`;
		send(text, 'interpret');
	}

	// The last uninterpreted card — gates input
	const pendingCard = $derived(
		$messages.slice().reverse().find(m => m.role === 'card' && !m.interpreted)?.card ?? null
	);

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
	$effect(() => {
		if ($messages && msgList) {
			setTimeout(() => msgList.scrollTo({ top: msgList.scrollHeight, behavior: 'smooth' }), 50);
		}
	});

	async function send(text: string, mode?: string) {
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
				} else if (event.type === 'draw' && event.card) {
					// Clea triggered a contextual card draw server-side
					const raw = event.card as any;
					const deckMeta = availableDecks.find(d => d.id === raw.deck);
					const cardData: CardData = {
						id: raw.id,
						deck: raw.deck,
						deckLabel: raw.deckLabel ?? deckMeta?.meta?.name ?? raw.deck,
						title: raw.title,
						keywords: raw.keywords ?? [],
						body: raw.body ?? '',
					};
					messages.update(m => [...m, { role: 'card', content: '', card: cardData, interpreted: false }]);
				}
			}, mode)) { /* yield */ }
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
		window.addEventListener('keydown', handleGlobalKey);
		window.addEventListener('keyup', handleGlobalKey);
		if (guestMode) {
			await ensureGuestToken();
			audioQueue = createAudioQueue((t) => tts(t, guestToken ?? '', get(ttsVoice)));
		} else if ($authed && $creds) {
			const c = $creds as Credentials;
			audioQueue = createAudioQueue((t) => tts(t, c.access_token, get(ttsVoice)));
			totemSession = new TotemSession(c.access_token, c.seeker_id);
			totemSession.load().catch(() => {}); // non-blocking, non-fatal
		}
		fetchDecks();
		send('');
	});

	onDestroy(() => {
		window.removeEventListener('keydown', handleGlobalKey);
		window.removeEventListener('keyup', handleGlobalKey);
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
			if (text) {
				if (!pttSeen) {
					pttSeen = true;
					localStorage.setItem(PTT_SEEN_KEY, '1');
				}
				send(text);
			}
		} catch (e) {
			console.error('STT failed:', e);
			voiceState.set('idle');
		}
	}

	// ── PTT keyboard shortcut (Space, held) ───────────────────────────────────
	function handleGlobalKey(e: KeyboardEvent) {
		// Only when textarea is not focused
		if (document.activeElement?.tagName === 'TEXTAREA') return;
		if (e.code === 'Space' && !e.repeat) {
			e.preventDefault();
			if (e.type === 'keydown') startListening();
			else stopListening();
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
			{#if msg.role === 'card' && msg.card}
				<div class="msg card-msg">
					<span class="label card-label">◈ {msg.card.deckLabel}</span>
					<div class="card-body">
						<div class="card-title">{msg.card.title}</div>
						{#if msg.card.keywords.length}
							<div class="card-keywords">{msg.card.keywords.join(' · ')}</div>
						{/if}
						<pre class="card-text">{msg.card.body}</pre>
						{#if !msg.interpreted}
							<button class="card-interpret" onclick={() => interpret(msg.card!)}>
								interpret
							</button>
						{/if}
					</div>
				</div>
			{:else if msg.role !== 'system' && msg.role !== 'card'}
				<div class="msg {msg.role}">
					<span class="label">{msg.role === 'user' ? 'you' : 'clea'}</span>
					<div class="prose">{@html renderMarkdown(msg.content)}</div>
				</div>
			{/if}
		{/each}
		{#if $streaming}
			<div class="thinking">▋</div>
		{/if}

	</div>

	<!-- floating divination widget — absolute bottom-right, above the bar -->
	<div class="divination-float">
		{#if deckPickerOpen}
			<div class="deck-picker">
				<div class="deck-picker-header">
					<button onclick={() => { selectedDecks = new Set(availableDecks.map(d => d.id)); }}>all</button>
					<span class="deck-picker-sep">·</span>
					<button onclick={() => { selectedDecks = new Set(); }}>none</button>
				</div>
				<div class="deck-list">
					{#each availableDecks as deck}
						<label class="deck-item">
							<input
								type="checkbox"
								checked={selectedDecks.has(deck.id)}
								onchange={(e) => {
									const next = new Set(selectedDecks);
									if ((e.target as HTMLInputElement).checked) next.add(deck.id);
									else next.delete(deck.id);
									selectedDecks = next;
								}}
							/>
							<span>{deck.meta?.name ?? deck.id}</span>
							<span class="deck-count">{deck.count}</span>
						</label>
					{/each}
				</div>
			</div>
		{/if}
		<div class="divination-actions">
			<button
				class="deck-toggle"
				class:open={deckPickerOpen}
				onclick={() => { deckPickerOpen = !deckPickerOpen; }}
				title="choose decks"
			>Divination Decks ▾</button>
			<button
				class="draw-btn"
				class:drawing
				onclick={drawCard}
				disabled={drawing || $streaming || !!pendingCard || selectedDecks.size === 0}
			>draw card</button>
		</div>
	</div>

	<!-- input bar -->
	<div class="bar">
		<div class="bar-leading">
			<div class="ptt-wrap">
				<button
					class="ptt"
					class:active={$voiceState === 'listening'}
					class:transcribing={$voiceState === 'transcribing'}
					onpointerdown={startListening}
					onpointerup={stopListening}
					aria-label="hold to speak"
				>
					{$voiceState === 'listening' ? '◉' : $voiceState === 'transcribing' ? '…' : '◎'}
				</button>
				{#if !pttSeen || $voiceState !== 'idle'}
					<div class="ptt-hint-pop" class:listening={$voiceState === 'listening'} class:transcribing={$voiceState === 'transcribing'}>
						{#if $voiceState === 'listening'}listening…
						{:else if $voiceState === 'transcribing'}transcribing…
						{:else}hold to speak · space{/if}
					</div>
				{/if}
			</div>
		</div>

		<textarea
			bind:value={input}
			onkeydown={handleKey}
			placeholder={pendingCard ? '— card drawn —' : 'Type to speak…'}
			rows="1"
			disabled={$streaming || !!pendingCard}
		></textarea>

		<div class="bar-trailing">
			<label class="tts-toggle" title={$ttsEnabled ? 'mute Clea\'s voice' : 'enable Clea\'s voice'}>
				<input type="checkbox" bind:checked={$ttsEnabled} />
				<span>〲</span>
			</label>
			<select
				class="voice-select"
				value={$ttsVoice}
				onchange={(e) => ttsVoice.set((e.target as HTMLSelectElement).value as TtsVoice)}
				aria-label="Clea's voice"
				title="Clea's voice"
			>
				<option value="elf">Elf</option>
				<option value="poet">Poet</option>
				<option value="alien">Alien</option>
				<option value="president">President</option>
			</select>
		</div>
	</div>
</div>

<style>
.shell {
	height: 100%;
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
	padding: 2rem 1.5rem 5rem; /* bottom padding leaves room for float widget */
	display: flex;
	flex-direction: column;
	gap: 1.5rem;
	scroll-behavior: smooth;
}

/* ── Floating divination widget ─────────────────────────────────────────── */
.divination-float {
	position: absolute;
	bottom: 5.5rem;  /* clears the bar */
	right: 1.25rem;
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	gap: 0;
	z-index: 5;
}

.divination-actions {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.25rem;
	background: color-mix(in srgb, var(--bg) 85%, transparent);
	backdrop-filter: blur(10px);
	-webkit-backdrop-filter: blur(10px);
	border: 1px solid var(--border);
	border-radius: var(--radius);
	box-shadow: 0 2px 8px rgba(0,0,0,0.18);
	padding: 0.5rem 0.75rem;
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
	gap: 1rem;
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

.ptt-wrap {
	position: relative;
	display: flex;
	align-items: center;
	flex-shrink: 0;
}

.ptt-hint-pop {
	position: absolute;
	bottom: calc(100% + 0.5rem);
	left: 0;
	background: var(--surface);
	border: 1px solid var(--border);
	border-radius: var(--radius);
	color: var(--muted);
	font-family: var(--font-sans, system-ui, sans-serif);
	font-size: 0.6rem;
	letter-spacing: 0.08em;
	text-transform: uppercase;
	white-space: nowrap;
	padding: 0.3rem 0.6rem;
	pointer-events: none;
	opacity: 0.8;
	transition: color 0.15s, opacity 0.15s;
}
.ptt-hint-pop::after {
	content: '';
	position: absolute;
	top: 100%;
	left: 1rem;
	border: 4px solid transparent;
	border-top-color: var(--border);
}
.ptt-hint-pop.listening {
	color: var(--accent);
	border-color: var(--accent);
	opacity: 1;
}
.ptt-hint-pop.listening::after { border-top-color: var(--accent); }
.ptt-hint-pop.transcribing { opacity: 0.5; }

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
	transition: all 0.15s;
	touch-action: none;
	user-select: none;
}

.ptt.active {
	background: hsl(var(--hue), 55%, 18%);
	border-color: var(--accent);
	color: var(--accent);
	box-shadow: 0 0 0 4px hsl(var(--hue), 60%, 65%, 0.25), 0 0 16px hsl(var(--hue), 60%, 65%, 0.3);
	transform: scale(1.15);
}

.ptt.transcribing {
	border-color: var(--muted);
	color: var(--muted);
	opacity: 0.7;
}

.voice-select {
	appearance: none;
	background: none;
	border: none;
	color: var(--muted);
	cursor: pointer;
	font-family: var(--font-mono);
	font-size: 0.65rem;
	letter-spacing: 0.08em;
	padding: 0;
	transition: color 0.15s;
}
.voice-select:hover, .voice-select:focus { color: var(--accent); outline: none; }
.voice-select option { background: var(--bg); color: var(--text); }

.bar-leading {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	flex-shrink: 0;
}

.bar-trailing {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	flex-shrink: 0;
}

.tts-toggle {
	background: var(--surface);
	border: 1px solid var(--border);
	border-radius: 50%;
	color: var(--muted);
	cursor: pointer;
	font-size: 1.1rem;
	height: 2.5rem;
	width: 2.5rem;
	display: grid;
	place-items: center;
	opacity: 0.4;
	transition: all 0.15s;
	flex-shrink: 0;
}
.tts-toggle input { display: none; }
.tts-toggle:has(input:checked) {
	border-color: var(--accent);
	color: var(--accent);
	opacity: 1;
}

/* ── Draw controls ─────────────────────────────────────────────────────── */

.draw-btn {
	background: var(--surface);
	border: 1px solid var(--border);
	border-radius: var(--radius);
	color: var(--muted);
	cursor: pointer;
	font-family: var(--font-mono);
	font-size: 0.75rem;
	letter-spacing: 0.08em;
	padding: 0.4rem 0.75rem;
	transition: border-color 0.15s, color 0.15s;
	white-space: nowrap;
}
.draw-btn:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.draw-btn:disabled { opacity: 0.35; cursor: default; }
.draw-btn.drawing { animation: pulse 0.8s ease-in-out infinite; }

.deck-toggle {
	background: none;
	border: none;
	color: var(--muted);
	cursor: pointer;
	font-family: var(--font-mono);
	font-size: 0.6rem;
	letter-spacing: 0.06em;
	line-height: 1;
	padding: 0;
	opacity: 0.45;
	transition: opacity 0.15s, color 0.15s;
	white-space: nowrap;
}
.deck-toggle:hover, .deck-toggle.open { opacity: 1; color: var(--accent); }

.deck-picker {
	position: absolute;
	bottom: calc(100% + 0.4rem);
	right: 0;
	background: color-mix(in srgb, var(--surface) 95%, transparent);
	backdrop-filter: blur(8px);
	-webkit-backdrop-filter: blur(8px);
	border: 1px solid var(--border);
	border-radius: var(--radius);
	min-width: 200px;
	max-height: 260px;
	overflow-y: auto;
	z-index: 20;
	box-shadow: 0 4px 20px rgba(0,0,0,0.4);
}

.deck-picker-header {
	display: flex;
	align-items: center;
	gap: 0.4rem;
	padding: 0.5rem 0.75rem;
	border-bottom: 1px solid var(--border);
}
.deck-picker-header button {
	background: none;
	border: none;
	color: var(--muted);
	cursor: pointer;
	font-family: var(--font-mono);
	font-size: 0.7rem;
	letter-spacing: 0.08em;
	padding: 0;
	transition: color 0.15s;
}
.deck-picker-header button:hover { color: var(--accent); }
.deck-picker-sep { color: var(--border); }

.deck-list { padding: 0.25rem 0; }

.deck-item {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.35rem 0.75rem;
	cursor: pointer;
	font-size: 0.75rem;
	color: var(--muted);
	transition: background 0.1s, color 0.1s;
}
.deck-item:hover { background: rgba(255,255,255,0.03); color: var(--text); }
.deck-item input { accent-color: var(--accent); cursor: pointer; }
.deck-item span:nth-child(2) { flex: 1; }
.deck-count {
	font-size: 0.65rem;
	opacity: 0.4;
}

/* ── Card message ──────────────────────────────────────────────────────── */
.card-msg { max-width: 480px; }

.card-label {
	color: var(--accent) !important;
	letter-spacing: 0.12em;
}

.card-body {
	border: 1px solid var(--border);
	border-radius: var(--radius);
	padding: 1rem 1.25rem;
	display: flex;
	flex-direction: column;
	gap: 0.6rem;
	background: rgba(255,255,255,0.02);
}

.card-title {
	font-size: 1rem;
	font-weight: 600;
	color: var(--text);
	letter-spacing: 0.05em;
}

.card-keywords {
	font-size: 0.72rem;
	color: var(--muted);
	letter-spacing: 0.1em;
}

.card-text {
	font-family: var(--font-mono);
	font-size: 0.82rem;
	line-height: 1.7;
	color: var(--text);
	opacity: 0.85;
	white-space: pre-wrap;
	margin: 0;
}

.card-interpret {
	align-self: flex-start;
	background: none;
	border: 1px solid var(--border);
	border-radius: var(--radius);
	color: var(--accent);
	cursor: pointer;
	font-family: var(--font-mono);
	font-size: 0.75rem;
	letter-spacing: 0.1em;
	margin-top: 0.25rem;
	padding: 0.35rem 0.75rem;
	transition: border-color 0.15s, background 0.15s;
}
.card-interpret:hover {
	background: rgba(255,255,255,0.04);
	border-color: var(--accent);
}

@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
</style>
