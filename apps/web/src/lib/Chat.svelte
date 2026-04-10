<script lang="ts">
import { onMount, onDestroy } from 'svelte';
import { get } from 'svelte/store';
import { browser } from '$app/environment';
import { creds, authed, messages, streaming, voiceState, waveform, guestTurns, ttsEnabled, ttsVoice, activeRite, activeCard, pendingRite, needsCovenant, covenantReady, continueOffered, seekerState, covenantAcceptedTick, covenantPromptArmed } from './stores';
import type { CardData, RiteData, VagalInfo, BeliefInfo, QualityInfo, Message } from './stores';
import { enquire, stt } from './api';
import { webSpeech, cancelWebSpeech, DEFAULT_VOICE } from './tts-client';
import Breath from './Breath.svelte';
import SeekerPanel from './SeekerPanel.svelte';
import type { Credentials } from './stores';
import { incrementGuestTurns, getGuestTurns, GUEST_LIMIT } from './guestSession';
import { TotemSession } from './totemSession';
import { renderMarkdown } from './markdown';
import { createAudioQueue, type AudioQueue } from './audio';
import { storageMonitor } from './storage-monitor';

	let {
		guestMode = false,
		guestLocked = false,
		freshStart = false,
		onsignin,
		onfreshhandled = () => {},
	}: {
		guestMode?: boolean;
		guestLocked?: boolean;
		freshStart?: boolean;
		onsignin?: () => void;
		onfreshhandled?: () => void;
	} = $props();

	let audioQueue: AudioQueue | null = null;
	let sessionId: string | null = null;
	let input = $state('');
	let msgList: HTMLElement;
	let audioCtx: AudioContext;
	let mediaRecorder: MediaRecorder | null = null;
	let chunks: Blob[] = [];
	let returningGuest = $state(false);

	let guestToken: string | null = null;
	let handle: string | null = null;
	let totemSession: TotemSession | null = null;
	// Fish Audio tracking: server sends sentence_audio events (base64 MP3) when configured.
	// If none arrive during a turn, we fall back to Web Speech at completion time.
	let serverAudioReceived = false;
	let fallbackSentences: string[] = [];
	// Guard: only save messages to localStorage after onMount has restored them.
	// Without this, the initial $effect run (with messages = []) would wipe any saved
	// conversation before onMount has a chance to read it back — e.g. after iOS tab discard.
	let didRestore = $state(false);

	// ── Deck / Oracle Panel ───────────────────────────────────────────────────
	type DeckMeta = { id: string; meta: { name?: string; description?: string }; count: number };
	let availableDecks = $state<DeckMeta[]>([]);
	let selectedDecks = $state<Set<string>>(new Set());
	let drawing = $state(false);
	let inputEl: HTMLDivElement | undefined;
	let pendingPracticeContext: string | null = null;
	let pendingAuthContext: string | null = null;
	let railCollapsed = $state(false);
	let freshHandled = $state(false);
	let lastSeenCovenantAcceptedTick = $state(0);
	const covenantPending = $derived($authed && $covenantPromptArmed);

	function buildAuthTranscriptContext(history: Message[]): string | null {
		const transcript = history
			.filter((msg) => msg.role === 'user' || msg.role === 'assistant' || msg.role === 'card')
			.map((msg) => {
				if (msg.role === 'card' && msg.card) {
					return `card: ${msg.card.title} (${msg.card.deckLabel})${msg.card.body ? `\n${msg.card.body}` : ''}`;
				}
				return `${msg.role === 'user' ? 'seeker' : 'priestess'}: ${msg.content}`;
			})
			.filter(Boolean)
			.slice(-8);

		if (transcript.length === 0) return null;
		return [
			'[Prior guest conversation context]',
			'The seeker has just signed up after this guest exchange. Continue naturally from here rather than restarting.',
			...transcript
		].join('\n');
	}

	function resetConversationState() {
		messages.set([]);
		activeCard.set(null);
		activeRite.set(null);
		pendingRite.set(null);
		continueOffered.set(false);
		sessionId = null;
		if (browser) {
			localStorage.removeItem('clea_messages');
			localStorage.removeItem('clea_session_id');
			localStorage.removeItem('clea_pending_rite');
		}
		if ($authed && $creds) {
			seekerState.reset();
			seekerState.setPartial({ handle: $creds.handle ?? null });
		}
	}

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
		if ($pendingRite) {
			pendingRite.set({ ...$pendingRite, stage: 'received' });
		}
		// Seeker accepted — send an acknowledgement into the conversation
		send('I accept this rite.');
	}

	function handleDiscussPractice(card: CardData) {
		// Mark the card as interpreted so input is unblocked
		messages.update(m => m.map(msg =>
			msg.role === 'card' && msg.card?.id === card.id && !msg.interpreted
				? { ...msg, interpreted: true }
				: msg
		));
		// Stash practice markdown to inject as context on the seeker's first message
		if (card.markdown) {
			pendingPracticeContext = `[Practice: ${card.title}]\n${card.markdown}`;
		}
		// Focus the input — seeker decides what to ask
		setTimeout(() => inputEl?.focus(), 50);
	}

	// ── PTT hint ──────────────────────────────────────────────────────────────
	// Hide the "hold to speak" hint after first successful transcription
	const PTT_SEEN_KEY = 'clea_ptt_seen';
	let pttSeen = $state(typeof localStorage !== 'undefined' && !!localStorage.getItem(PTT_SEEN_KEY));

	const BASE_URL = import.meta.env.VITE_OURACLE_BASE_URL ?? 'https://api.ouracle.kerry.ink';


	// ── iOS PWA Stability: Global streaming flag ────────────────────────────────
	// Expose streaming state to pwa.ts so service worker updates can be deferred
	// during active LLM conversations, preventing reload race conditions.
	$effect(() => {
		if (!browser) return;
		(window as any).__ouracleStreaming = $streaming;
		return () => { (window as any).__ouracleStreaming = false; };
	});

	// Persist conversation to localStorage — gated on didRestore to prevent the initial
	// $effect run (with messages=[]) from wiping a saved conversation before onMount restores it.
	$effect(() => {
	  if (!didRestore || !browser) return;
	  try {
	    localStorage.setItem('clea_messages', JSON.stringify($messages));
	    // Also save a timestamp for recovery validation
	    localStorage.setItem('clea_messages_timestamp', Date.now().toString());
	  } catch (e) {
	    console.error('Failed to save messages:', e);
	  }
	});

	async function fetchDecks() {
		try {
			const token = guestMode
				? (guestToken ?? '')
				: ($creds as { access_token?: string } | null)?.access_token ?? '';
			const headers: Record<string, string> = {};
			if (token) headers['Authorization'] = `Bearer ${token}`;
			const r = await fetch(`${BASE_URL}/decks`, { headers });
			if (!r.ok) return;
			availableDecks = await r.json();


			const deckName = (deck: any) => deck.meta?.name ?? deck.id;

			// Put Rites first, preserve original order otherwise
			availableDecks.sort((a, b) => {
				const aIsRites = deckName(a) === 'Ouracle Rites';
				const bIsRites = deckName(b) === 'Ouracle Rites';

				if (aIsRites && !bIsRites) return -1;
				if (bIsRites && !aIsRites) return 1;
				return 0;
			});

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
				markdown: raw.markdown,
				fields: raw.fields,
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
		if ($streaming || guestLocked || covenantPending) return;
		let skipTag = false;
		let messageHasTokens = false; // true once token events arrive for current message
		const sentenceTexts = new Map<number, string>();
		const spokenSentenceSeqs = new Set<number>();

		function enqueueMissingSentences(beforeSeq = Number.POSITIVE_INFINITY) {
			if (!$ttsEnabled || !audioQueue) return;
			for (const [seq, sentence] of sentenceTexts) {
				if (seq >= beforeSeq) continue;
				if (spokenSentenceSeqs.has(seq)) continue;
				if (!sentence.trim()) continue;
				spokenSentenceSeqs.add(seq);
				audioQueue.enqueue(sentence);
			}
		}

		// Snapshot and clear practice context — injected into API call only, not the thread
		const practiceCtx = pendingPracticeContext;
		const authCtx = !sessionId ? pendingAuthContext : null;
		pendingPracticeContext = null;
		pendingAuthContext = null;

		// Fuzzy covenant readiness detection
		if ($needsCovenant && !$covenantReady && text.trim()) {
			const readyPattern = /^(yes|ready|sure|let'?s go|absolutely|of course|okay|ok|yeah|yep|i'?m ready|i accept|let'?s do it|let'?s begin|please|go ahead)/i;
			if (readyPattern.test(text.trim())) {
				covenantReady.set(true);
				return;
			}
		}

		audioQueue?.prime();
		cancelWebSpeech();
		serverAudioReceived = false;
		fallbackSentences = [];
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
			const contextParts = [authCtx, practiceCtx].filter((part): part is string => !!part);
			const apiText = contextParts.length > 0 && text.trim()
				? `${contextParts.join('\n\n')}\n\n${text}`
				: text;
		for await (const _ of enquire(token, apiText, sessionId, (event) => {
				if (event.type === 'session') {
					sessionId = event.session_id as string;
					if (browser) localStorage.setItem('clea_session_id', sessionId);
					needsCovenant.set(!!event.needs_covenant);
					continueOffered.set(false);
            } else if (event.type === 'token') {
                const tokenText = event.text as string;
                messageHasTokens = true;
                if (skipTag) {
                    // We're inside a multi-token [tag] — wait for the closing bracket
                    if (tokenText.includes(']')) {
                        skipTag = false;
                        // Strip the closing bracket and anything before it; keep any remainder
                        const after = tokenText.slice(tokenText.indexOf(']') + 1);
                        if (after) {
                            messages.update(m => {
                                const last = m[m.length - 1];
                                last.content += after;
                                return [...m];
                            });
                        }
                    }
                } else {
                    // Strip any complete [tag] spans inline, then check for an unclosed opener
                    let cleaned = tokenText.replace(/\[[^\]]*\]/g, '');
                    if (cleaned.includes('[')) {
                        // Unclosed tag started — drop from [ onward, set skip mode
                        cleaned = cleaned.slice(0, cleaned.lastIndexOf('['));
                        skipTag = true;
                    }
                    if (cleaned) {
                        messages.update(m => {
                            const last = m[m.length - 1];
                            last.content += cleaned;
                            return [...m];
                        });
                    }
                }
            } else if (event.type === 'sentence_text') {
                // Complete sentence — render if no token events (static content like greetings),
                // and collect for Web Speech fallback in case Fish Audio isn't available.
                const sentence = event.text as string;
                const sequence = typeof event.sequence === 'number' ? event.sequence : sentenceTexts.size;
                const cleanSentence = sentence.replace(/\[[^\]]*\]/g, '').trim();
                if (!messageHasTokens) {
                    messages.update(m => {
                        const last = m[m.length - 1];
                        if (last?.role === 'assistant') {
                            last.content += (last.content ? ' ' : '') + sentence;
                        }
                        return [...m];
                    });
                }
                if ($ttsEnabled && cleanSentence) {
                    sentenceTexts.set(sequence, cleanSentence);
                }
            } else if (event.type === 'sentence_audio') {
                // Server pre-fetched this sentence via Fish Audio — decode base64 MP3 and play.
                if ($ttsEnabled && audioQueue && event.audio) {
                    const sequence = typeof event.sequence === 'number' ? event.sequence : 0;
                    enqueueMissingSentences(sequence);
                    spokenSentenceSeqs.add(sequence);
                    serverAudioReceived = true;
                    cancelWebSpeech();
                    const binary = atob(event.audio as string);
                    const bytes = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
                    audioQueue.enqueueBuffer(bytes.buffer);
                }
            } else if (event.type === 'sentence_audio_missing') {
                const sequence = typeof event.sequence === 'number' ? event.sequence : -1;
                if ($ttsEnabled && audioQueue && sequence >= 0) {
                    enqueueMissingSentences(sequence + 1);
                }
            } else if (event.type === 'break') {
                // Start a fresh assistant message block
        // Always add a fresh empty assistant message for the next turn
        messages.update(m => [...m, { role: 'assistant', content: '' }]);
        skipTag = false;
        messageHasTokens = false;
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
						markdown: raw.markdown,
						fields: raw.fields,
					};
					messages.update(m => [...m, { role: 'card', content: '', card: cardData, interpreted: false }]);
				} else if (event.type === 'rite' && event.rite) {
					activeRite.set(event.rite as RiteData);
					pendingRite.set({ rite: event.rite as RiteData, stage: 'offered' });
				} else if (event.type === 'complete') {
					const stage = (event as { type: string; stage?: string }).stage;
					if (stage === 'complete' || stage === 'reintegration_complete') {
						// Only clear the pending rite on reintegration — a plain 'complete' means the
						// session where the rite was prescribed ended; the rite is still in motion.
						if (stage === 'reintegration_complete') pendingRite.set(null);
						const completedSessionId = (event as { session_id?: string }).session_id ?? sessionId;
						if (totemSession && completedSessionId) {
							totemSession.distillAndSave(completedSessionId).catch(() => {});
						}
					}
					enqueueMissingSentences();
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
	}, mode, $ttsEnabled, get(ttsVoice))) { /* yield */ }
		} catch (e: unknown) {
			const status = (e as { status?: number }).status;
			const msg = e instanceof Error ? e.message : String(e);
			if (msg.includes('guest_limit')) {
				guestTurns.set(GUEST_LIMIT);
			} else if (status === 401 || status === 403) {
				creds.logout();
				if (text.trim()) {
					// Expired mid-conversation — tell the seeker
					messages.update(m => [...m, { role: 'assistant', content: '*The priestess has slipped out. Please sign in again to continue.*' }]);
				} else {
					// Expired on bootstrap call (empty text) — silently re-init as guest
					// so the user sees the normal guest greeting instead of an error.
					setTimeout(async () => {
						try { await ensureGuestToken(); send(''); } catch { /* non-fatal */ }
					}, 50);
				}
			}
		} finally {
			// Remove any trailing empty assistant message
			messages.update(m => m.filter((msg, i) => !(msg.role === 'assistant' && msg.content === '' && i === m.length - 1)));
			streaming.set(false);
		}
	}

	// When a guest signs in, clear the guest conversation and bootstrap a fresh authed session.
	// Without this, the first user message after sign-in goes to the API without a session_id,
	// which creates a new session and returns the opening question — ignoring the user's message.
	let initiallyAuthed = $state(get(authed));
	$effect(() => {
		if (!initiallyAuthed && $authed && !guestMode && !$streaming) {
			initiallyAuthed = true;
			if ($covenantPromptArmed) {
				pendingAuthContext = buildAuthTranscriptContext(get(messages));
				sessionId = null;
				if (browser) {
					localStorage.removeItem('clea_session_id');
					localStorage.removeItem('clea_guest_token');
				}
			} else {
				// Returning sign-in gets a fresh authed surface.
				messages.set([]);
				sessionId = null;
				if (browser) {
					localStorage.removeItem('clea_session_id');
					localStorage.removeItem('clea_guest_token');
				}
				send('');
			}
		}
		if ($authed) {
			returningGuest = false;
		} else {
			initiallyAuthed = false; // reset on logout so next sign-in is detected
		}
	});

	// Open session on mount — /enquire with no session_id bootstraps it
	onMount(async () => {
		// Restore saved messages, cleaning up any trailing empty assistant message
		// left by interrupted streaming (tab was killed before the finally block ran).
		if (browser && !freshStart) {
		  try {
		    const saved = localStorage.getItem('clea_messages');
		    if (saved) {
		      const parsed: Message[] = JSON.parse(saved);
		      const cleaned = parsed.filter((m, i) =>
		        !(m.role === 'assistant' && !m.content.trim() && i === parsed.length - 1)
		      );
		      messages.set(cleaned);
		      // Detect returning guest: prior conversation exists but not signed in
		      if (guestMode && cleaned.length > 0) returningGuest = true;
		    }
		    // Restore session ID so continued conversations keep their server-side context
		    sessionId = localStorage.getItem('clea_session_id') ?? null;
		  } catch (e) {
		    console.error('Failed to load saved messages:', e);
		  }
		  // Unlock the messages save $effect now that localStorage has been read.
		  // This must happen AFTER the restore so the effect never writes [] over saved data.
		  didRestore = true;
		} else {
			resetConversationState();
			didRestore = true;
			if (freshStart) {
				freshHandled = true;
				onfreshhandled();
			}
		}
		window.addEventListener('keydown', handleGlobalKey);
		window.addEventListener('keyup', handleGlobalKey);
		window.addEventListener('visibilitychange', handleVisibilityChange);
		// AudioQueue fetch function is Web Speech fallback only — primary audio
		// arrives as sentence_audio SSE events (Fish Audio, pre-fetched on server).
		audioQueue = createAudioQueue((t) => webSpeech(t).then(() => null));
		if (guestMode) {
			await ensureGuestToken();
		} else if ($authed && $creds) {
			const c = $creds as Credentials;
			totemSession = new TotemSession(c.access_token, c.seeker_id);
			totemSession.load().catch(() => {}); // non-blocking, non-fatal
			// Initialize seeker handle
			seekerState.setPartial({ handle: c.handle ?? null });
		}
		fetchDecks();
		// Only send initial greeting if no conversation history restored
		if (get(messages).length === 0) {
		  send('');
		}
	});

	$effect(() => {
		if (!freshStart) {
			freshHandled = false;
			return;
		}
		if (freshHandled || $streaming) return;
		resetConversationState();
		freshHandled = true;
		onfreshhandled();
		send('');
	});

	$effect(() => {
		if ($covenantAcceptedTick === 0) {
			lastSeenCovenantAcceptedTick = 0;
			return;
		}
		if ($covenantAcceptedTick === lastSeenCovenantAcceptedTick) return;
		if ($streaming) return;
		lastSeenCovenantAcceptedTick = $covenantAcceptedTick;
		send('I accept the covenant.');
	});

	onDestroy(() => {
		cancelWebSpeech();
		window.removeEventListener('keydown', handleGlobalKey);
		window.removeEventListener('keyup', handleGlobalKey);
		window.removeEventListener('visibilitychange', handleVisibilityChange);
		audioQueue?.flush();
		audioQueue = null;
	});

	function handleInput(e: Event) {
		const el = e.target as HTMLElement;
		const raw = el.innerText ?? '';
		// iOS can leave a lone '\n' in an "empty" contenteditable
		input = raw === '\n' ? '' : raw;
	}

	function handlePaste(e: ClipboardEvent) {
		e.preventDefault();
		const text = e.clipboardData?.getData('text/plain') ?? '';
		document.execCommand('insertText', false, text);
	}

	function handleSend() {
		if ($streaming || guestLocked || covenantPending) return;
		const text = input.trim();
		if (!text) return;
		input = '';
		if (inputEl) inputEl.innerText = '';
		send(text);
	}

	function handleKey(e: KeyboardEvent) {
		if (guestLocked || covenantPending) return;
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	}

	// ── PTT voice ─────────────────────────────────────────────────────────────
	async function startListening() {
		if (guestLocked || covenantPending) return;
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
		if (guestLocked || covenantPending) return;
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

	// ── iOS tab-restore guard ─────────────────────────────────────────────────
	// iOS kills background tabs under memory pressure. When the user returns, the page
	// reloads from scratch. If messages are somehow empty after becoming visible
	// (e.g. the effect flush raced with onMount), re-read from localStorage as a fallback.
	function handleVisibilityChange() {
		if (document.visibilityState !== 'visible' || !browser) return;
		if (get(messages).length > 0) return; // state intact — nothing to do
		try {
			const saved = localStorage.getItem('clea_messages');
			if (!saved) return;
			const parsed: Message[] = JSON.parse(saved);
			const cleaned = parsed.filter((m, i) =>
				!(m.role === 'assistant' && !m.content.trim() && i === parsed.length - 1)
			);
			if (cleaned.length === 0) return;
			messages.set(cleaned);
			sessionId = localStorage.getItem('clea_session_id') ?? sessionId;
		} catch { /* non-fatal */ }
	}

	// ── PTT keyboard shortcut (Space, held) ───────────────────────────────────
	function handleGlobalKey(e: KeyboardEvent) {
		if (guestLocked || covenantPending) return;
		// Don't intercept Space while the user is typing in any editable element
		const el = document.activeElement;
		if (
			el?.tagName === 'TEXTAREA' ||
			el?.tagName === 'INPUT' ||
			(el as HTMLElement)?.isContentEditable
		) return;
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
	<div class="msgs" class:rail-collapsed={railCollapsed} bind:this={msgList}>
		{#each $messages as msg}
			{#if msg.role !== 'system' && msg.role !== 'card'}
				<div class="msg {msg.role}" class:covenant-reminder={msg.isCovenantReminder}>
					{#if !msg.isCovenantReminder}
						<span class="label">{msg.role === 'user' ? 'you' : guestMode ? 'Phemonoe' : 'Clea'}</span>
					{/if}
					<div class="prose">{@html renderMarkdown(msg.content)}</div>
				</div>
			{/if}
		{/each}
		{#if $streaming}
			<div class="thinking">▋</div>
		{/if}

		</div>

	<div class="panel-wrap" class:collapsed={railCollapsed}>
		<SeekerPanel
			{availableDecks}
			{selectedDecks}
			onDeckToggle={handleDeckToggle}
			onDrawCard={drawCard}
			onInterpretCard={handleInterpretCard}
			onAcceptRite={handleAcceptRite}
			onDiscussPractice={handleDiscussPractice}
			{drawing}
			streaming={$streaming}
			onCollapseChange={(next) => (railCollapsed = next)}
		/>
	</div>

		{#if !$authed && (guestLocked || returningGuest) && onsignin}
			<div class="guest-lock-banner">
				<div class="guest-lock-copy">
					{#if guestLocked}
						Clea awaits you.
					{:else}
						Phemonoe greets you.
					{/if}
				</div>
				<div class="guest-lock-actions">
					<button class="guest-lock-cta" onclick={onsignin}>
						<span>Sign in</span>
						{#if guestLocked}
							<span>to continue</span>
						{/if}
					</button>
					{#if returningGuest && !guestLocked}
						<button class="guest-dismiss" onclick={() => returningGuest = false}>or remain a guest</button>
					{/if}
				</div>
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
					disabled={guestLocked || covenantPending}
				>
					{$voiceState === 'listening' ? '◉' : $voiceState === 'transcribing' ? '…' : '◎'}
				</button>
				{#if !pttSeen || $voiceState !== 'idle'}
					<div class="ptt-hint-pop" class:listening={$voiceState === 'listening'} class:transcribing={$voiceState === 'transcribing'}>
						{#if $voiceState === 'listening'}listening…
						{:else if $voiceState === 'transcribing'}transcribing…
						{:else}hold [space] to speak{/if}
					</div>
				{/if}
			</div>
		</div>

		<div class="input-wrap">
			<!-- svelte-ignore a11y_interactive_supports_focus -->
			<div
				class="chat-input"
				class:empty={!input}
				role="textbox"
				aria-multiline="true"
				aria-label="Type to speak…"
				data-placeholder={guestLocked ? 'Sign in to continue…' : covenantPending ? 'Enter the covenant to continue…' : 'Type to speak…'}
				contenteditable={$streaming || guestLocked || covenantPending ? 'false' : 'true'}
				enterkeyhint="send"
				autocapitalize="sentences"
				spellcheck="true"
				autocomplete="off"
				autocorrect="off"
				data-form-type="other"
				bind:this={inputEl}
				oninput={handleInput}
				onkeydown={handleKey}
				onpaste={handlePaste}
			></div>
			<button
				class="send-inline"
				onclick={handleSend}
				aria-label="Send"
				disabled={!input.trim() || $streaming || guestLocked || covenantPending}
			>ꜛ</button>
		</div>

	</div>
</div>

<style>
.shell {
	height: 100%;
	display: flex;
	flex-direction: column;
	position: relative;
	isolation: isolate;
}

.shell::before {
	content: '';
	position: absolute;
	inset: 0;
	pointer-events: none;
	background:
		linear-gradient(180deg, color-mix(in srgb, var(--glass-bg) 82%, transparent), transparent 24%),
		radial-gradient(circle at 50% 100%, color-mix(in srgb, var(--accent) 12%, transparent), transparent 46%);
	z-index: 0;
}

.breath-layer {
	position: absolute;
	inset: 0;
	pointer-events: none;
	opacity: calc(var(--ambience, 1) * 0.6);
	z-index: 0;
}

.msgs {
	position: relative;
	flex: 1;
	overflow-y: auto;
	padding: 2rem 1.5rem 5rem; /* bottom padding leaves room for float widget */
	display: flex;
	flex-direction: column;
	justify-content: flex-end;
	gap: 1.5rem;
	scroll-behavior: smooth;
	z-index: 1;
}

/* ── Oracle Panel wrapper ───────────────────────────────────────────────── */
.panel-wrap {
	position: fixed;
	top: var(--topbar-h, 2.5rem);
	right: 0.5em;
	z-index: 20;
	bottom: calc(var(--input-bar-h) + env(safe-area-inset-bottom, 0px) + 1rem);
	display: flex;
	width: max(20rem, 38.2dvw);
	max-width: calc(100vw - 2rem);
	overflow: visible;
	transition: width 0.24s ease, opacity 0.18s ease;
}

.panel-wrap.collapsed {
	width: 1rem;
}
@media (max-width: 640px) {
	.panel-wrap {
		right: 0.5rem;
		left: 0.5rem;
		bottom: calc(var(--input-bar-h) + env(safe-area-inset-bottom, 0px) + 1rem);
		width: auto;
		max-width: none;
	}

	.panel-wrap.collapsed {
		left: auto;
		width: calc(1.25rem + 0.5ch);
	}
}

/* ── Main content padding when side panels are visible ─────────────────────── */
@media (min-width: 1025px) {
	.msgs {
		padding-right: calc(max(20rem, 38.2dvw) + 1.75rem);
	}

	.msgs.rail-collapsed {
		padding-right: 2.75rem;
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
	letter-spacing: 0.06em;
	color: var(--muted);
	font-family: var(--font-mono);
	text-transform: uppercase;
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

.guest-lock-banner {
	display: flex;
	align-items: center;
	justify-content: center;
	flex-wrap: wrap;
	gap: 0.75rem;
	padding: 0.75rem 1rem;
	color: var(--muted);
	font-size: 0.72rem;
	font-family: var(--font-mono);
	letter-spacing: 0.06em;
}

.guest-lock-copy {
	text-align: center;
}

.guest-lock-actions {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.75rem;
	flex-wrap: wrap;
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

.guest-dismiss {
	background: transparent;
	border: none;
	color: var(--muted);
	cursor: pointer;
	font-family: var(--font-mono);
	font-size: 0.72rem;
	letter-spacing: 0.06em;
	padding: 0.45rem 0.5rem;
	text-decoration: underline;
	text-decoration-style: dotted;
	text-underline-offset: 3px;
	text-transform: lowercase;
}
.guest-dismiss:hover { color: var(--text); text-decoration-style: solid; }

.guest-lock-cta:hover {
	border-color: var(--accent);
}

@media (max-width: 720px) {
	.guest-lock-banner {
		flex-direction: column;
	}

	.guest-lock-actions {
		width: 100%;
	}
}

.bar {
	display: flex;
	align-items: center;
	gap: 0.85rem;
	padding: 0.45rem 1rem;
	padding-bottom: max(0.45rem, env(safe-area-inset-bottom, 0px));
	border-top: 1px solid var(--glass-border);
	background: var(--glass-wash), color-mix(in srgb, var(--glass-bg-strong) 94%, transparent);
	backdrop-filter: blur(calc(var(--glass-blur) + 2px)) saturate(var(--glass-saturate));
	-webkit-backdrop-filter: blur(calc(var(--glass-blur) + 2px)) saturate(var(--glass-saturate));
	position: sticky;
	bottom: 0;
	z-index: 2;
	min-height: var(--input-bar-h);
	/* iOS keyboard handling: prevent layout shift */
	flex-shrink: 0;
}

.input-wrap {
	flex: 1;
	position: relative;
	display: flex;
	align-items: center;
}

.chat-input {
	flex: 1;
	background: color-mix(in srgb, var(--glass-bg-strong) 92%, transparent);
	border: 1px solid var(--glass-border);
	border-radius: var(--radius);
	color: var(--text);
	font-family: var(--font-mono);
	font-size: 0.9rem;
	line-height: 1.5;
	padding: 0.45rem 2.4rem 0.45rem 0.75rem; /* right padding reserves space for send-inline */
	outline: none;
	transition: border-color 0.15s;
	max-height: 8rem;
	min-height: calc(1.5em + 0.9rem);
	overflow-y: auto;
	white-space: pre-wrap;
	word-break: break-word;
	-webkit-user-select: text;
	user-select: text;
	cursor: text;
}

.chat-input:focus { border-color: var(--accent); }

.chat-input[contenteditable="false"] {
	opacity: 0.6;
	cursor: not-allowed;
	pointer-events: none;
}

/* placeholder via pseudo-element (avoids native placeholder behaviour on non-input) */
.chat-input.empty::before {
	content: attr(data-placeholder);
	color: var(--muted);
	pointer-events: none;
}

.send-inline {
	position: absolute;
	right: 0.35rem;
	bottom: 0.35rem;
	background: none;
	border: none;
	color: var(--muted);
	cursor: pointer;
	font-size: 1.1rem;
	line-height: 1;
	padding: 0.2rem 0.3rem;
	transition: color 0.15s, opacity 0.15s;
	opacity: 0.5;
}

.send-inline:not(:disabled):hover,
.send-inline:not(:disabled):active {
	color: var(--accent);
	opacity: 1;
}

.send-inline:disabled {
	opacity: 0.2;
	cursor: default;
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
	font-family: var(--font-mono);
	font-size: 0.6rem;
	letter-spacing: 0.05em;
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
	background: color-mix(in srgb, var(--glass-bg-strong) 88%, transparent);
	border: 1px solid var(--glass-border);
	border-radius: 50%;
	color: var(--muted);
	cursor: pointer;
	font-size: 1.2rem;
	height: 2.5rem;
	width: 2.5rem;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 0;
	line-height: 1;
	font-family: var(--font-mono);
	transition: all 0.15s;
	touch-action: none;
	user-select: none;
	transform: translateY(-2px);
}

.ptt.active {
	/* Light tint of accent color for active state */
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

.bar-leading {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	flex-shrink: 0;
}

@media (max-width: 640px) {
	.bar {
		gap: 0.6rem;
		padding: 0.5rem 0.75rem;
		padding-bottom: calc(0.5rem + env(safe-area-inset-bottom, 0px));
		min-height: calc(var(--input-bar-h) + env(safe-area-inset-bottom, 0px));
	}

	.input-wrap {
		min-height: 2.5rem;
	}

	.chat-input {
		border-radius: 1.25rem;
		font-size: 1rem;
		min-height: 2.5rem;
		padding: 0.55rem 2.85rem 0.55rem 0.9rem;
	}

	.send-inline {
		right: 0.45rem;
		top: 50%;
		bottom: auto;
		transform: translateY(-50%);
		width: 2rem;
		height: 2rem;
		border-radius: 999px;
		display: grid;
		place-items: center;
		padding: 0;
		background: color-mix(in srgb, var(--accent) 18%, transparent);
		border: 1px solid color-mix(in srgb, var(--accent) 40%, var(--glass-border));
		font-size: 1rem;
		opacity: 0.85;
	}

	.send-inline:disabled {
		background: color-mix(in srgb, var(--glass-bg-strong) 60%, transparent);
		border-color: var(--glass-border);
		opacity: 0.45;
	}

	.ptt {
		width: 2.35rem;
		height: 2.35rem;
		transform: none;
	}
}

/* ── Card message ──────────────────────────────────────────────────────── */
.card-msg { max-width: 480px; }

.card-label {
	color: var(--accent) !important;
	letter-spacing: 0.06em;
	font-family: var(--font-mono);
	text-transform: uppercase;
}

.card-body {
	border: 1px solid var(--glass-border);
	border-radius: var(--radius);
	padding: 1rem 1.25rem;
	display: flex;
	flex-direction: column;
	gap: 0.6rem;
	background: color-mix(in srgb, var(--glass-bg) 80%, transparent);
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

</style>
