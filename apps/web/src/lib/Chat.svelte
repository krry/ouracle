<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { creds, authed, messages, streaming, voiceState, waveform, guestTurns, ttsEnabled, ttsVoice, activeRite, activeCard, pendingRite, needsCovenant, covenantReady, continueOffered, seekerState } from './stores';
	import type { CardData, RiteData, TtsVoice, VagalInfo, BeliefInfo, QualityInfo } from './stores';
	import { enquire, tts, stt } from './api';
	import Breath from './Breath.svelte';
	import OraclePanel from './OraclePanel.svelte';
	import SeekerStatusPanel from './SeekerStatusPanel.svelte';
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

	// ── Deck / Oracle Panel ───────────────────────────────────────────────────
	type DeckMeta = { id: string; meta: { name?: string; description?: string }; count: number };
	let availableDecks = $state<DeckMeta[]>([]);
	let selectedDecks = $state<Set<string>>(new Set());
	let drawing = $state(false);

	function handleDeckToggle(id: string, checked: boolean) {
		const next = new Set(selectedDecks);
		if (checked) next.add(id); else next.delete(id);
		selectedDecks = next;
	}

	function handleInterpretCard(card: CardData) {
		messages.update(m => m.map(msg =>
			msg.role === 'card' && msg.card?.id === card.id && !msg.interpreted
				? { ...msg, interpreted: true }
				: msg
		));
		const text = `I drew a card — **${card.title}** from the ${card.deckLabel}.\n\nKeywords: ${card.keywords.join(' · ')}\n\n${card.body}\n\nPlease interpret this for me.`;
		send(text, 'interpret');
	}

	function handleAcceptRite(_rite: RiteData) {
		// Seeker accepted — send an acknowledgement into the conversation
		send('I accept this rite.');
	}

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
		if (drawing || $streaming) return;
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
			activeCard.set(card);
			messages.update(m => [...m, { role: 'card', content: '', card, interpreted: false }]);
		} catch (e) {
			console.error('draw failed:', e);
		} finally {
			drawing = false;
		}
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

		// Fuzzy covenant readiness detection
		if ($needsCovenant && !$covenantReady && text.trim()) {
			const readyPattern = /^(yes|ready|sure|let'?s go|absolutely|of course|okay|ok|yeah|yep|i'?m ready|i accept|let'?s do it|let'?s begin|please|go ahead)/i;
			if (readyPattern.test(text.trim())) {
				covenantReady.set(true);
				return;
			}
		}

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
			for await (const _ of enquire(token, text, sessionId, (event) => {
				if (event.type === 'session') {
					sessionId = event.session_id as string;
					needsCovenant.set(!!event.needs_covenant);
					continueOffered.set(false);
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
					// Append covenant reminder for non-covenanted seekers (client-side, after LLM breaks)
					if (get(needsCovenant) && !get(covenantReady)) {
						messages.update(m => [...m, { role: 'assistant', content: 'But, before we enter the temple, I must ask that we enter a covenant. Are you ready?', isCovenantReminder: true }]);
					} else {
						messages.update(m => [...m, { role: 'assistant', content: '' }]);
					}
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
				} else if (event.type === 'rite' && event.rite) {
					activeRite.set(event.rite as RiteData);
					pendingRite.set({ rite: event.rite as RiteData, stage: 'prescribed' });
				} else if (event.type === 'complete') {
					const stage = (event as { type: string; stage?: string }).stage;
					if (stage === 'complete' || stage === 'reintegration_complete') {
						pendingRite.set(null);
					}
} else if (event.type === 'continue_offered') {
			continueOffered.set(true);
		} else if (event.type === 'affect') {
			seekerState.setPartial({
				affect: {
					valence: event.valence as number | null,
					arousal: event.arousal as number | null,
					gloss: event.gloss as string | null,
					confidence: event.confidence as 'low' | 'medium' | 'high' | null,
				}
			});
		} else if (event.type === 'vagal') {
			seekerState.setPartial({
				vagal: {
					probable: event.probable as VagalInfo['probable'],
					confidence: event.confidence as VagalInfo['confidence'],
					reasoning: event.reasoning as string | undefined,
				}
			});
		} else if (event.type === 'belief') {
			seekerState.setPartial({
				belief: {
					pattern: event.pattern as BeliefInfo['pattern'],
					confidence: event.confidence as BeliefInfo['confidence'],
					reasoning: event.reasoning as string | undefined,
				}
			});
		} else if (event.type === 'quality') {
			seekerState.setPartial({
				quality: {
					quality: event.quality as QualityInfo['quality'],
					confidence: event.confidence as QualityInfo['confidence'],
					is_shock: event.is_shock as boolean,
					reasoning: event.reasoning as string | undefined,
				}
			});
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

	// Open session on mount — /enquire with no session_id bootstraps it
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
			// Initialize seeker handle
			seekerState.setPartial({ handle: c.handle ?? null });
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
					</div>
				</div>
			{:else if msg.role !== 'system' && msg.role !== 'card'}
				<div class="msg {msg.role}" class:covenant-reminder={msg.isCovenantReminder}>
					{#if !msg.isCovenantReminder}
						<span class="label">{msg.role === 'user' ? 'you' : 'clea'}</span>
					{/if}
					<div class="prose">{@html renderMarkdown(msg.content)}</div>
				</div>
			{/if}
		{/each}
		{#if $streaming}
			<div class="thinking">▋</div>
		{/if}

		</div>

	<!-- Left: seeker status panel (desktop) -->
	{#if $authed}
	<div class="seeker-panel-wrap">
		<SeekerStatusPanel />
	</div>
	{/if}

	<!-- Right: oracle panel -->
	<div class="panel-wrap">
		<OraclePanel
			{availableDecks}
			{selectedDecks}
			onDeckToggle={handleDeckToggle}
			onDrawCard={drawCard}
			onInterpretCard={handleInterpretCard}
			onAcceptRite={handleAcceptRite}
			{drawing}
			streaming={$streaming}
		/>
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
			placeholder="Type to speak…"
			rows="1"
			disabled={$streaming}
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
	justify-content: flex-end;
	gap: 1.5rem;
	scroll-behavior: smooth;
}

/* ── Oracle Panel wrapper ───────────────────────────────────────────────── */
.panel-wrap {
	position: fixed;
	top: var(--topbar-h, 57px);
	right: 1.25rem;
	z-index: 20;
	width: 300px;
}
@media (max-width: 640px) {
	.panel-wrap {
		right: 0;
		left: 0;
		width: 100%;
	}
}

/* ── Seeker Status Panel wrapper (desktop left) ───────────────────────────── */
.seeker-panel-wrap {
	position: fixed;
	top: var(--topbar-h, 57px);
	left: 1.25rem;
	z-index: 20;
	width: 260px; /* slightly narrower, fits the status panel */
}
@media (max-width: 1024px) {
	.seeker-panel-wrap {
		display: none;
	}
}

/* ── Main content padding when side panels are visible ─────────────────────── */
@media (min-width: 1025px) {
	.msgs {
		padding-left: 280px;  /* space for left panel + gap */
		padding-right: 320px; /* space for right panel + gap */
	}
}

.msg { display: flex; flex-direction: column; gap: 0.25rem; }

.covenant-reminder {
	opacity: 0.65;
	margin-top: 0.5rem;
}
.covenant-reminder .prose {
	font-size: 0.82rem;
	font-style: italic;
	color: var(--muted);
}

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

@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

@media (max-width: 767px) {
	.bar-trailing { display: none; }
}
</style>
