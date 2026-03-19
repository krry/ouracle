<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { get } from 'svelte/store';
	import { fly } from 'svelte/transition';
	import { browser } from '$app/environment';
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
	import { createAudioManager, type AudioManager, type AudioSegment } from './audio-manager';

	let {
		guestMode = false,
		guestLocked = false,
		onsignin,
	}: {
		guestMode?: boolean;
		guestLocked?: boolean;
		onsignin?: () => void;
	} = $props();

\tlet audioManager: AudioManager | null = null;
\tlet serverAudioActive = false; // whether current response uses server-side TTS streaming
\tlet sessionId: string | null = null;
\tlet input = $state('');
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
		send('I accept this rite.');
	}

	// ── PTT hint ──────────────────────────────────────────────────────────────
	const PTT_SEEN_KEY = 'clea_ptt_seen';
	let pttSeen = $state(typeof localStorage !== 'undefined' && !!localStorage.getItem(PTT_SEEN_KEY));

	const BASE_URL = import.meta.env.VITE_OURACLE_BASE_URL ?? 'https://api.ouracle.kerry.ink';

	// ── Audio playback state ───────────────────────────────────────────────────
	let currentSegment = $state<AudioSegment | null>(null);
	let isSkipped = $state(false);
	let showReplayHistory = $state(false);
	let replayHistory = $state<AudioSegment[]>([]);
	let currentPlayingText = $state('');
	let typewriterIndex = $state(0);
	let isTypewriting = $state(false);
	let typeInterval: ReturnType<typeof setInterval> | null = null;

	// ── TTS Sync Effect ────────────────────────────────────────────────────────
	$effect(() => {
		if (audioManager) {
			if ($ttsEnabled) {
				audioManager.unmute();
			} else {
				audioManager.mute();
			}
		}
	});

	// ── Persist conversation to localStorage ───────────────────────────────────
	$effect(() => {
	  if (browser) {
		try {
		  localStorage.setItem('clea_messages', JSON.stringify($messages));
		} catch (e) {
		  console.error('Failed to save messages:', e);
		}
	  }
	});

	async function fetchDecks() {
		try {
			const token=***
				? (guestToken ?? '')
				: ($creds as { access_token?: string } | null)?.access_token ?? '';
			const headers: Record<string, string> = {};
			if (token) headers['Authorization'] = `Bearer ${token}`;
			const r = await fetch(`${BASE_URL}/decks`, { headers });
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

	const pendingCard = $derived(
		$messages.slice().reverse().find(m => m.role === 'card' && !m.interpreted)?.card ?? null
	);

	async function ensureGuestToken(): Promise<void> {
		const stored = localStorage.getItem('clea_guest_token');
		if (stored && stored !== 'undefined') { guestToken=*** return; }
		localStorage.removeItem('clea_guest_token');
		const BASE = import.meta.env.VITE_OURACLE_BASE_URL ?? 'https://api.ouracle.kerry.ink';
		const res = await fetch(`${BASE}/aspire`, { method: 'POST' });
		if (!res.ok) throw new Error(`/aspire failed: ${res.status}`);
		const { guest_token } = await res.json();
		localStorage.setItem('clea_guest_token', guest_token);
		guestToken=***
	}

	// ── Typewriter Effect ───────────────────────────────────────────────────────
	function startTypewriter(text: string) {
		if (typeInterval) clearInterval(typeInterval);
		currentPlayingText = '';
		typewriterIndex = 0;
		isTypewriting = true;

		typeInterval = setInterval(() => {
			if (typewriterIndex < text.length) {
				currentPlayingText += text[typewriterIndex];
				typewriterIndex++;
			} else {
				clearInterval(typeInterval!);
				typeInterval = null;
				isTypewriting = false;
			}
		}, 40);
	}

	$effect(() => {
		if (currentSegment && !isTypewriting && $ttsEnabled) {
			startTypewriter(currentSegment.text);
		}
	});

	// ── Audio Control Functions ───────────────────────────────────────────────
	function handleSkip() {
		if (audioManager) {
			audioManager.skip();
		}
	}

	function handleMuteToggle() {
		$ttsEnabled = !$ttsEnabled;
	}

	async function loadReplayHistory() {
		if (audioManager) {
			replayHistory = await audioManager.getReplayHistory();
			showReplayHistory = !showReplayHistory;
		}
	}

	async function handleReplaySegment(segment: AudioSegment) {
		if (audioManager) {
			await audioManager.replaySegment(segment);
			isSkipped = false;
			showReplayHistory = false;
		}
	}

	// AudioManager event listener
	function setupAudioEvents() {
		if (!audioManager) return;
		audioManager.onEvent((event) => {
			if (event.type === 'playing') {
				currentSegment = event.segment;
				isSkipped = false;
				$voiceState = 'speaking';
			} else if (event.type === 'skipped') {
				isSkipped = true;
				if (typeInterval) {
					clearInterval(typeInterval);
					typeInterval = null;
					isTypewriting = false;
				}
			} else if (event.type === 'ended') {
				currentSegment = null;
				currentPlayingText = '';
				if (typeInterval) {
					clearInterval(typeInterval);
					typeInterval = null;
				}
				isTypewriting = false;
				$voiceState = 'idle';
			} else if (event.type === 'mute') {
				$voiceState = 'idle';
				if (typeInterval) {
					clearInterval(typeInterval);
					typeInterval = null;
					isTypewriting = false;
				}
			} else if (event.type === 'unmute') {
				// Will be handled by effect syncing with $ttsEnabled
			} else if (event.type === 'queue-update') {
				// Optional: update UI based on queue length
			}
		});
	}

	// scroll to bottom on new messages
	$effect(() => {
		if ($messages && msgList) {
			setTimeout(() => msgList.scrollTo({ top: msgList.scrollHeight, behavior: 'smooth' }), 50);
		}
	});

	async function send(text: string, mode?: string) {
		if ($streaming || guestLocked) return;
		let skipTag = false;

		if ($needsCovenant && !$covenantReady && text.trim()) {
			const readyPattern = /^(yes|ready|sure|let'?s go|absolutely|of course|okay|ok|yeah|yep|i'?m ready|i accept|let'?s do it|let'?s begin|please|go ahead)/i;
			if (readyPattern.test(text.trim())) {
				covenantReady.set(true);
				return;
			}
		}

		audioManager?.prime();
		const token=*** ? ($creds as Credentials | null)?.access_token ?? '' : guestToken ?? '';
		if (text.trim()) {
			messages.update(m => [...m, { role: 'user', content: text }]);
			if (guestMode) {
				incrementGuestTurns();
				guestTurns.set(getGuestTurns());
			}
		}
		messages.update(m => [...m, { role: 'assistant', content: '' }]);
		streaming.set(true);

\t\ttry {
\t\t\tconst ttsEnabledVal = get(ttsEnabled);
\t\t\tconst ttsVoiceVal = get(ttsVoice);
\t\t\tfor await (const _ of enquire(token, text, sessionId, (event) => {
\t\t\t\tif (event.type === 'session') {
\t\t\t\t\tsessionId = event.session_id as string;
\t\t\t\t\tneedsCovenant.set(!!event.needs_covenant);
\t\t\t\t\tcontinueOffered.set(false);
\t\t\t\t\tserverAudioActive = false; // reset for new response
                } else if (event.type === 'token') {
                    const tokenText=*** as string;
                    if (skipTag) {
                        if (tokenText.includes(']')) {
                            skipTag = false;
                        }
                    } else {
                        const currentMsgs = get(messages);
                        const lastMsg = currentMsgs[currentMsgs.length - 1];
                        if (lastMsg.role === 'assistant' && lastMsg.content === '' && tokenText.startsWith('[')) {
                            if (!tokenText.includes(']')) {
                                skipTag = true;
                            }
                        } else {
                            messages.update(m => {
                                const last = m[m.length - 1];
                                last.content += tokenText;
                                return [...m];
                            });
                        }
                    }
                }else if (event.type === 'break') {
					if ($ttsEnabled && audioManager) {
						const msgs = get(messages);
						const last = msgs.at(-1);
						if (last?.role === 'assistant' && last.content) {
							audioManager.enqueue(last.content);
						}
					}
                messages.update(m => [...m, { role: 'assistant', content: '' }]);
                skipTag = false;
				} else if (event.type === 'draw' && event.card) {
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
				messages.update(m => m.filter((msg, i) => !(msg.role === 'assistant' && msg.content === '' && i === m.length - 1)));
				if ($ttsEnabled && audioManager) {
					const msgs = get(messages);
					const last = msgs.at(-1);
					if (last?.role === 'assistant' && last.content) {
						audioManager.enqueue(last.content);
					}
				}
				streaming.set(false);
			}
	}

	onMount(async () => {
		if (browser) {
		  try {
			const saved = localStorage.getItem('clea_messages');
			if (saved) {
			  messages.set(JSON.parse(saved));
			}
		  } catch (e) {
			console.error('Failed to load saved messages:', e);
		  }
		}
		window.addEventListener('keydown', handleGlobalKey);
		window.addEventListener('keyup', handleGlobalKey);
		if (guestMode) {
			await ensureGuestToken();
			audioManager = createAudioManager((t) => tts(t, guestToken ?? '', get(ttsVoice)));
		} else if ($authed && $creds) {
			const c = $creds as Credentials;
			audioManager = createAudioManager((t) => tts(t, c.access_token, get(ttsVoice)));
			totemSession = new TotemSession(c.access_token, c.seeker_id);
			totemSession.load().catch(() => {});
			seekerState.setPartial({ handle: c.handle ?? null });
		}
		fetchDecks();
		setupAudioEvents();
		if (get(messages).length === 0) {
		  send('');
		}
	});

	onDestroy(() => {
		window.removeEventListener('keydown', handleGlobalKey);
		window.removeEventListener('keyup', handleGlobalKey);
		audioManager?.flush();
		audioManager = null;
		if (totemSession && sessionId) {
			totemSession.distillAndSave(sessionId).catch(() => {});
		}
	});

	function handleKey(e: KeyboardEvent) {
		if (guestLocked) return;
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			const text = input.trim();
			input = '';
			send(text);
		}
	}

	// ── PTT voice ─────────────────────────────────────────────────────────────
	async function startListening() {
		if (guestLocked) return;
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
		audioManager?.prime();
		voiceState.set('listening');
		tick();
	}

	async function stopListening() {
		if (guestLocked) return;
		if (!mediaRecorder) return;
		voiceState.set('transcribing');
		mediaRecorder.stop();
		const token=*** ? (guestToken ?? '') : (($creds as Credentials | null)?.access_token ?? '');
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
		if (guestLocked) return;
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
			{#if msg.role !== 'system' && msg.role !== 'card'}
				<div class="msg {msg.role}" class:covenant-reminder={msg.isCovenantReminder}>
					{#if !msg.isCovenantReminder}
						<span class="label">{msg.role === 'user' ? 'you' : 'clea'}</span>
					{/if}
					<div class="prose">
						{@html renderMarkdown(
							msg.role === 'assistant' && currentSegment && !isSkipped
								? currentPlayingText
								: msg.content
						)}
					</div>
				</div>
			{/if}
		{/each}
		{#if $streaming}
			<div class="thinking">▋</div>
		{/if}

	</div>

	<!-- Audio Controls Widget -->
	{#if currentSegment && $ttsEnabled && !isSkipped}
		<div class="audio-controls" transition:fly={{ y: 20, duration: 200 }}>
			<button class="control-btn skip" onclick={handleSkip} title="Skip">
				⏭
			</button>
			<div class="typewriter-indicator">
				<span class="typewriter-text">{currentPlayingText}</span>
				{#if isTypewriting}
					<span class="cursor">|</span>
				{/if}
			</div>
			<button class="control-btn mute" onclick={handleMuteToggle} title="Mute">
				{$ttsEnabled ? '🔊' : '🔇'}
			</button>
			<button class="control-btn history" onclick={loadReplayHistory} title="Replay History">
				🕐
			</button>
		</div>
	{/if}

	<!-- Replay History Panel -->
	{#if showReplayHistory && replayHistory.length > 0}
		<div class="replay-panel" transition:fly={{ y: 20, duration: 200 }}>
			<div class="replay-header">
				<h4>Replay History</h4>
				<button class="close-btn" onclick={() => showReplayHistory = false}>×</button>
			</div>
			<div class="replay-list">
				{#each replayHistory as segment}
					<button class="replay-item" onclick={() => handleReplaySegment(segment)}>
						<span class="replay-text">{segment.text.slice(0, 60)}...</span>
						<span class="replay-time">{new Date(segment.timestamp).toLocaleTimeString()}</span>
					</button>
				{/each}
				<button class="clear-history" onclick={() => { audioManager?.clearHistory(); replayHistory = []; }}>
					Clear History
				</button>
			</div>
		</div>
	{/if}

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

	{#if guestLocked && onsignin}
		<div class="guest-lock-banner">
			Priestess Clea awaits you in the temple.
			<button class="guest-lock-cta" onclick={onsignin}>sign in to continue</button>
		</div>
	{/if}

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
					disabled={guestLocked}
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
			placeholder={guestLocked ? 'sign in to continue…' : 'Type to speak…'}
			rows="1"
			disabled={$streaming || guestLocked}
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
  /* Existing styles plus new ones - reusing the same style block from previous */
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
    position: relative;
    flex: 1;
    overflow-y: auto;
    padding: 2rem 1.5rem 5rem;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 1.5rem;
    scroll-behavior: smooth;
  }

  /* ── Audio Controls Widget ─────────────────────────────────────────────── */
  .audio-controls {
    position: fixed;
    bottom: 7rem;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.6rem 1rem;
    background: rgba(0, 0, 0, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 2rem;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    z-index: 100;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    will-change: transform, opacity;
    contain: layout;
    transform-origin: center bottom;
  }

  .audio-controls:hover {
    transform: translateX(-50%) translateY(-2px);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  }

  .control-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    border: none;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    will-change: transform;
    user-select: none;
    touch-action: manipulation;
  }

  .control-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(1.1);
  }

  .control-btn:active {
    transform: scale(0.95);
  }

  .control-btn.skip {
    background: rgba(255, 193, 7, 0.2);
    border: 1px solid rgba(255, 193, 7, 0.3);
  }

  .control-btn.skip:hover {
    background: rgba(255, 193, 7, 0.3);
  }

  .control-btn.mute {
    width: 2rem;
    height: 2rem;
    font-size: 0.9rem;
  }

  .control-btn.history {
    background: rgba(33, 150, 243, 0.2);
    border: 1px solid rgba(33, 150, 243, 0.3);
  }

  .typewriter-indicator {
    flex: 1;
    min-width: 200px;
    max-width: 400px;
    padding: 0.4rem 0.8rem;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 0.5rem;
    font-size: 0.85rem;
    color: rgba(255, 255, 255, 0.9);
    line-height: 1.4;
    font-family: var(--font-mono);
  }

  .typewriter-text {
    display: inline;
    animation: fadeIn 0.1s ease-in;
  }

  .cursor {
    animation: blink 0.8s step-end infinite;
    color: rgba(255, 255, 255, 0.7);
    margin-left: 2px;
  }

  @keyframes blink {
    50% { opacity: 0; }
  }

  /* ── Replay History Panel ───────────────────────────────────────────────── */
  .replay-panel {
    position: fixed;
    bottom: 9rem;
    right: 1.5rem;
    width: 320px;
    max-height: 400px;
    background: rgba(0, 0, 0, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 1rem;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    z-index: 99;
    overflow: hidden;
    transform-origin: bottom right;
    animation: slideUp 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  }

  .replay-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .replay-header h4 {
    margin: 0;
    color: rgba(255, 255, 255, 0.9);
    font-size: 0.85rem;
    font-weight: 500;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .close-btn {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    font-size: 1.5rem;
    cursor: pointer;
    padding: 0;
    line-height: 1;
    transition: color 0.2s;
  }

  .close-btn:hover {
    color: rgba(255, 255, 255, 0.9);
  }

  .replay-list {
    max-height: 300px;
    overflow-y: auto;
    padding: 0.5rem;
  }

  .replay-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 0.6rem 0.8rem;
    background: rgba(255, 255, 255, 0.05);
    border: none;
    border-radius: 0.5rem;
    margin-bottom: 0.4rem;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.8);
    font-size: 0.8rem;
    text-align: left;
    transition: all 0.2s;
    will-change: background, transform;
    contain: layout;
  }

  .replay-item:hover {
    background: rgba(255, 255, 255, 0.1);
    transform: translateX(4px);
  }

  .replay-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--font-mono);
  }

  .replay-time {
    margin-left: 0.75rem;
    font-size: 0.7rem;
    color: rgba(255, 255, 255, 0.5);
    font-family: var(--font-mono);
  }

  .clear-history {
    width: 100%;
    padding: 0.6rem;
    background: rgba(255, 0, 0, 0.1);
    border: 1px solid rgba(255, 0, 0, 0.2);
    border-radius: 0.5rem;
    color: rgba(255, 100, 100, 0.9);
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .clear-history:hover {
    background: rgba(255, 0, 0, 0.2);
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: scale(0.95) translateY(20px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  @media (max-width: 640px) {
    .audio-controls {
      left: 1rem;
      right: 1rem;
      transform: none;
      max-width: calc(100% - 2rem);
    }
    .audio-controls:hover {
      transform: none;
    }
    .replay-panel {
      left: 1rem;
      right: 1rem;
      width: auto;
      bottom: 8rem;
      max-width: none;
    }
  }

  .panel-wrap {
    position: fixed;
    top: var(--topbar-h, 2.5rem);
    right: 1.25rem;
    z-index: 20;
    width: 300px;
    backdrop-filter: blur(1rem);
    -webkit-backdrop-filter: blur(1rem);
  }
  @media (max-width: 640px) {
    .panel-wrap {
      right: 0;
      left: 0;
      width: 100%;
    }
  }

  .seeker-panel-wrap {
    position: absolute;
    bottom: 5rem;
    right: 1.25rem;
    z-index: 20;
    width: 260px;
  }
  @media (max-width: 1024px) {
    .seeker-panel-wrap { display: none; }
  }

  @media (min-width: 1025px) {
    .msgs {
      padding-left: 280px;
      padding-right: 320px;
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

  .guest-lock-banner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    color: var(--muted);
    font-size: 0.72rem;
    font-family: var(--font-mono);
    letter-spacing: 0.06em;
    text-transform: lowercase;
  }

  .guest-lock-cta {
    background: transparent;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--accent);
    cursor: pointer;
    font-family: var(--font-mono);
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    padding: 0.45rem 0.7rem;
    text-transform: lowercase;
  }

  .guest-lock-cta:hover {
    border-color: var(--accent);
  }

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

  textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

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

  .ptt:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

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
    background: color-mix(in srgb, var(--accent) 20%, white);
    border-color: var(--accent);
    color: hsl(var(--hue), 70%, 20%);
    box-shadow:
      0 0 0 4px hsl(var(--hue), 60%, 65%, 0.2),
      0 4px 12px rgba(0, 0, 0, 0.1);
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