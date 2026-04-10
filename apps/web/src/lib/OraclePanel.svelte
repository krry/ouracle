<script lang="ts">
	import { derived } from 'svelte/store'
	import { goto } from '$app/navigation';
	import { activeRite, activeCard, pendingRite } from './stores';
	import type { CardData, RiteData } from './stores';
	import { controlPanelRouteById } from './ControlPanel.svelte';

	let {
		availableDecks = [],
		selectedDecks = new Set<string>(),
		onDeckToggle,
		onDrawCard,
		onInterpretCard,
		onAcceptRite,
		onDiscussPractice,
		drawing = false,
		streaming = false,
	}: {
		availableDecks: { id: string; meta: { name?: string; description?: string }; count: number }[];
		selectedDecks: Set<string>;
		onDeckToggle: (id: string, checked: boolean) => void;
		onDrawCard: () => void;
		onInterpretCard: (card: CardData) => void;
		onAcceptRite: (rite: RiteData) => void;
		onDiscussPractice: (card: CardData) => void;
		drawing?: boolean;
		streaming?: boolean;
	} = $props();

	let deckPickerOpen = $state(true);
	let showPractice = $state(false);
	let expandPracticeCard = $state(false);

	const mode = $derived(
		$activeRite                 ? 'rite'     :
		showPractice && $activeCard ? 'practice' :
		$activeCard                 ? 'card'     :
		$pendingRite                ? 'pending'  :
		'idle'
	);

  const isOgham = derived(activeCard, ($activeCard) => {
    // handle null / undefined and ensure string
    const label = $activeCard?.deckLabel ?? '';
    return label.toLowerCase().includes('ogham');
  });
  
	const STAGES: Array<'offered' | 'received' | 'enacted'> = ['offered', 'received', 'enacted'];

	function dismissCard() {
		showPractice = false;
		expandPracticeCard = false;
		activeCard.set(null);
	}
	function dismissRite() { activeRite.set(null); }

	function handleInterpret() {
		if (!$activeCard) return;
		if ($activeCard.deck === 'rites') {
			showPractice = true;
		} else {
			onInterpretCard($activeCard);
			activeCard.set(null);
		}
	}

	function backFromPractice() {
		showPractice = false;
	}

	function handleDiscuss() {
		if (!$activeCard) return;
		onDiscussPractice($activeCard);
		showPractice = false;
		expandPracticeCard = false;
		activeCard.set(null);
	}

	function handleAccept() {
		if ($activeRite) {
			onAcceptRite($activeRite);
			activeRite.set(null);
		}
	}

	function handleDrawAgain() {
		showPractice = false;
		expandPracticeCard = false;
		activeCard.set(null);
		activeRite.set(null);
		onDrawCard();
	}

	// Helper to read practice fields safely
	function field<T>(key: string, fallback: T): T {
		return ($activeCard?.fields?.[key] as T) ?? fallback;
	}

	function togglePracticeCardExpansion() {
		expandPracticeCard = !expandPracticeCard;
	}

	function startFreshSession() {
		goto(`${controlPanelRouteById.oracle.href}?fresh=1`);
	}

	// Check all decks
	function selectAll() {
		availableDecks.forEach(d => onDeckToggle(d.id, true));
	}

	// Check no decks
	function selectNone() {
		availableDecks.forEach(d => onDeckToggle(d.id, false));
	}

	// Helper: get a random integer in [min, max], inclusive
	function randInt(min: number, max: number) {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	// Choose a random count, then check that many random distinct decks
	function selectSome() {
		if (!availableDecks.length) return;

		// First clear any existing selection
		selectNone();

		// Choose a random number between 1 and availableDecks.length
		const count = randInt(1, availableDecks.length);

		// Make a shallow copy so we can shuffle without mutating the original ordering
		const pool = [...availableDecks];

		// Fisher–Yates shuffle
		for (let i = pool.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[pool[i], pool[j]] = [pool[j], pool[i]];
		}

		// Take the first `count` decks from the shuffled pool
		for (let i = 0; i < count; i++) {
			const deck = pool[i];
			onDeckToggle(deck.id, true);
		}
	}

	// Check exactly one random deck from the current list
	function selectOne() {
		if (!availableDecks.length) return;

		selectNone();

		const idx = Math.floor(Math.random() * availableDecks.length);
		const chosen = availableDecks[idx];

		onDeckToggle(chosen.id, true);
	}
</script>

<aside class="oracle-panel" class:has-content={mode !== 'idle'}>
	{#if mode === 'idle'}
		<!-- ── Idle: deck selector + draw ── -->
		<div class="panel-section deck-section">
			<div class="deck-header">
				<button
					class="deck-toggle"
					class:open={deckPickerOpen}
					onclick={() => { deckPickerOpen = !deckPickerOpen; }}
				>Decks {deckPickerOpen ? '▴' : '▾'}</button>
				<div class="deck-quick">
					<button class="deck-all" onclick={selectAll}>all</button>
					<span class="sep">·</span>
					<button class="deck-all" onclick={selectSome}>some</button>
					<span class="sep">·</span>
					<button class="deck-all" onclick={selectOne}>one</button>
					<span class="sep">·</span>
					<button class="deck-all" onclick={selectNone}>none</button>
				</div>
			</div>

			{#if deckPickerOpen}
				<div class="deck-list">
					{#each availableDecks as deck}
						<label class="deck-item">
							<input
								type="checkbox"
								checked={selectedDecks.has(deck.id)}
								onchange={(e) => onDeckToggle(deck.id, (e.target as HTMLInputElement).checked)}
							/>
							<span class="deck-name">{deck.meta?.name ?? deck.id}</span>
							<span class="deck-count">{deck.count}</span>
						</label>
					{/each}
				</div>
			{/if}

			<button
				class="draw-btn"
				class:drawing
				onclick={onDrawCard}
				disabled={drawing || streaming || selectedDecks.size === 0}
			>
				{drawing ? '…' : 'draw card'}
			</button>

			{#if $pendingRite && selectedDecks.has('rites')}
				<button class="rite-nudge" onclick={startFreshSession}>
					<span class="rite-nudge-pip">◬</span>
					<span class="rite-nudge-text">
						<span class="rite-nudge-name">{$pendingRite.rite.rite_name}</span>
						<span class="rite-nudge-cta">rite in motion · new rite →</span>
					</span>
				</button>
			{/if}
		</div>

	{:else if mode === 'card' && $activeCard}
		<!-- ── Card active ── -->
		<div class="panel-section card-section">
			<div class="panel-header">
				<span class="panel-label">◈ {$activeCard.deckLabel}</span>
				<button class="dismiss-btn" onclick={dismissCard} aria-label="Dismiss card">✕</button>
			</div>
			<div class="card-content" class:ogham={$isOgham}>
				{#if $activeCard.imageUrl}
					<div class="card-image-wrap">
						<img class="card-image" src={$activeCard.imageUrl} alt={$activeCard.title} loading="lazy" />
					</div>
				{/if}
				<div class="card-title">{$activeCard.title}</div>
				{#if $activeCard.keywords.length}
					<div class="card-keywords">{$activeCard.keywords.join(' · ')}</div>
				{/if}
				{#if $activeCard.deck === 'rites'}
					{#if field('summary', '') || field('description', '') || $activeCard.body}
						<p class="card-summary">{field('summary', '') || field('description', '') || $activeCard.body}</p>
					{/if}

					<div class="practice-meta">
						{#if field('duration', '')}
							<span class="practice-chip">{field('duration', '')}</span>
						{/if}
						{#if field('movement', '') && (field('movement', '') as string) !== 'none'}
							<span class="practice-chip">movement: {field('movement', '')}</span>
						{/if}
						{#if field('voice', '') && (field('voice', '') as string) !== 'none'}
							<span class="practice-chip">voice: {field('voice', '')}</span>
						{/if}
					</div>

					{#if expandPracticeCard}
						{#if field('act', '')}
							<div class="card-detail-block">
								<div class="card-detail-label">Act</div>
								<div class="rite-act">{field('act', '')}</div>
							</div>
						{/if}

						{#if field('source', '')}
							<div class="card-detail-block">
								<div class="card-detail-label">Source</div>
								<div class="card-source">{field('source', '')}</div>
							</div>
						{/if}

						{#if field('invocation', '')}
							<div class="card-detail-block">
								<div class="card-detail-label">Invocation</div>
								<div class="rite-invocation">{field('invocation', '')}</div>
							</div>
						{/if}

						{#if (field('textures', []) as string[]).length}
							<div class="card-detail-block">
								<div class="card-detail-label">Textures</div>
								<ul class="rite-textures">
									{#each field('textures', []) as string[] as t}
										<li>{t}</li>
									{/each}
								</ul>
							</div>
						{/if}
					{/if}
				{:else}
					<pre class="card-body">{$activeCard.body}</pre>
				{/if}
			</div>

			<div class="panel-actions">
				{#if $activeCard.deck === 'rites' && (field('act', '') || field('source', '') || field('invocation', ''))}
					<button class="action-secondary" onclick={togglePracticeCardExpansion}>
						{expandPracticeCard ? 'Show Less' : 'Show More'}
					</button>
				{/if}
				<button class="action-primary" onclick={handleInterpret} disabled={streaming}>
					Interpret
				</button>
				<button class="action-secondary" onclick={handleDrawAgain} disabled={drawing || streaming}>
					Draw Again
				</button>
			</div>
		</div>

	{:else if mode === 'practice' && $activeCard}
		<!-- ── Full practice view (rites) ── -->
		<div class="panel-section practice-section">
			<div class="panel-header">
				<span class="panel-label">◈ rites</span>
				<button class="dismiss-btn" onclick={backFromPractice} aria-label="Back to card">←</button>
			</div>

			<div class="practice-content">
				<div class="rite-name">{$activeCard.title}</div>

				{#if field('description', '')}
					<div class="rite-description">{field('description', '')}</div>
				{/if}

				{#if field('act', '')}
					<div class="rite-act">{field('act', '')}</div>
				{/if}

				{#if field('source', '')}
					<div class="card-detail-block">
						<div class="card-detail-label">Source</div>
						<div class="card-source">{field('source', '')}</div>
					</div>
				{/if}

				{#if field('invocation', '')}
					<div class="card-detail-block">
						<div class="card-detail-label">Invocation</div>
						<div class="rite-invocation">{field('invocation', '')}</div>
					</div>
				{/if}

				{#if (field('vagalStates', []) as string[]).length}
					<div class="practice-meta">
						{#each field('vagalStates', []) as string[] as state}
							<span class="practice-chip">{state}</span>
						{/each}
					</div>
				{/if}

				{#if (field('textures', []) as string[]).length}
					<ul class="rite-textures">
						{#each field('textures', []) as string[] as t}
							<li>{t}</li>
						{/each}
					</ul>
				{/if}

				<div class="practice-meta">
					{#if field('duration', '')}
						<span class="practice-chip">{field('duration', '')}</span>
					{/if}
					{#if field('movement', '') && (field('movement', '') as string) !== 'none'}
						<span class="practice-chip">movement: {field('movement', '')}</span>
					{/if}
					{#if field('voice', '') && (field('voice', '') as string) !== 'none'}
						<span class="practice-chip">voice: {field('voice', '')}</span>
					{/if}
				</div>
			</div>

			<div class="panel-actions">
				<button class="action-primary" onclick={handleDiscuss} disabled={streaming}>
					Discuss
				</button>
				<button class="action-secondary" onclick={backFromPractice}>
					← Back
				</button>
			</div>
		</div>

	{:else if mode === 'rite' && $activeRite}
		<!-- ── Rite active ── -->
		<div class="panel-section rite-section">
			<div class="panel-header">
				<span class="panel-label">◬ rite</span>
				<button class="dismiss-btn" onclick={dismissRite} aria-label="Dismiss rite">✕</button>
			</div>

			<div class="rite-content">
				<div class="rite-name">{$activeRite.rite_name}</div>
				<div class="rite-act">{$activeRite.act}</div>
				{#if $activeRite.invocation}
					<div class="rite-invocation">"{$activeRite.invocation}"</div>
				{/if}
				{#if $activeRite.textures?.length}
					<ul class="rite-textures">
						{#each $activeRite.textures as t}
							<li>{t}</li>
						{/each}
					</ul>
				{/if}
				{#if $activeRite.context}
					<div class="rite-context">{$activeRite.context}</div>
				{/if}
				{#if $activeRite.duration}
					<div class="rite-duration">{$activeRite.duration}</div>
				{/if}
			</div>

			<div class="panel-actions">
				<button class="action-primary" onclick={handleAccept} disabled={streaming}>
					I Accept
				</button>
				<button class="action-secondary" onclick={handleDrawAgain} disabled={drawing || streaming}>
					Draw Again
				</button>
			</div>
		</div>

	{:else if mode === 'pending' && $pendingRite}
		<!-- ── Pending rite (prior session) ── -->
		<div class="panel-section pending-section">
			<div class="panel-header">
				<span class="panel-label">◬ rite · in motion</span>
			</div>

			<div class="rite-content">
				<div class="rite-name">{$pendingRite.rite.rite_name}</div>
				{#if $pendingRite.rite.act}
					<div class="rite-act">{$pendingRite.rite.act}</div>
				{/if}
			</div>

			<div class="progress-bar">
				{#each STAGES as s}
					<div class="progress-seg" class:active={s === $pendingRite.stage}>
						<div class="progress-fill"></div>
						<span class="progress-label">{s}</span>
					</div>
				{/each}
			</div>

			<p class="pending-prompt">Clea is waiting to hear what happened.</p>

			<div class="panel-actions">
				<button class="action-primary" onclick={startFreshSession}>
					Tell Clea
				</button>
			</div>
		</div>
	{/if}
</aside>

<style>
/* ── Panel shell ────────────────────────────────────────────────────────── */
.oracle-panel {
	display: flex;
	flex-direction: column;
	background: var(--glass-wash), color-mix(in srgb, var(--glass-bg-strong) 92%, transparent);
	border: 1px solid var(--glass-border);
	border-radius: 18px;
	box-shadow: var(--glass-shadow);
	backdrop-filter: blur(calc(var(--glass-blur) + 2px)) saturate(var(--glass-saturate));
	-webkit-backdrop-filter: blur(calc(var(--glass-blur) + 2px)) saturate(var(--glass-saturate));
	overflow: hidden;
	width: 100%;
	height: 100%;
	max-height: none;
	--panel-measure: min(100%, clamp(36ch, 92%, 72ch));
	--panel-copy-size: clamp(0.78rem, 0.72rem + 0.14vw, 0.94rem);
}

.panel-section {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
	padding: 1rem;
	min-height: 0;
	flex: 1 1 auto;
}

.card-content,
.practice-content,
.rite-content,
.deck-section,
.pending-section {
	width: 100%;
}

/* ── Header row (card / rite) ───────────────────────────────────────────── */
.panel-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	max-width: 39rem;
	width: 100%;
	margin: 0 auto;
}

.panel-label {
	font-family: var(--font-mono);
	font-size: 0.62rem;
	letter-spacing: 0.04em;
	color: var(--accent);
	text-transform: uppercase;
	font-weight: 300;
}

.dismiss-btn {
	background: none;
	border: none;
	color: var(--muted);
	cursor: pointer;
	font-size: 0.75rem;
	line-height: 1;
	padding: 0.2rem 0.35rem;
	transition: color 0.15s;
}
.dismiss-btn:hover { color: var(--text); }

/* ── Deck section ───────────────────────────────────────────────────────── */
.deck-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.deck-toggle {
	background: none;
	border: none;
	color: var(--muted);
	cursor: pointer;
	font-family: var(--font-mono);
	font-size: 0.67rem;
	letter-spacing: 0.08em;
	padding: 0;
	transition: color 0.15s;
	text-transform: lowercase;
	font-weight: 500;
}
.deck-toggle:hover, .deck-toggle.open { color: var(--accent); }

.deck-quick {
	display: flex;
	align-items: center;
	gap: 0.25rem;
}
.deck-all {
	background: none;
	border: none;
	color: var(--muted);
	cursor: pointer;
	font-family: var(--font-mono);
	font-size: 0.62rem;
	letter-spacing: 0.08em;
	padding: 0;
	transition: color 0.15s;
	text-transform: lowercase;
	font-weight: 500;
}
.deck-all:hover { color: var(--accent); }
.sep { color: var(--border); font-size: 0.6rem; }

.deck-list {
	display: flex;
	flex-direction: column;
	gap: 0;
	border: 1px solid var(--border);
	border-radius: var(--radius);
	overflow-y: auto;
	overflow-x: hidden;
}

.deck-item {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.3rem 0.6rem;
	cursor: pointer;
	font-size: 0.72rem;
	font-family: var(--font-mono);
	letter-spacing: 0.03em;
	color: var(--muted);
	transition: background 0.1s, color 0.1s;
}
.deck-item:hover { background: rgba(255,255,255,0.03); color: var(--text); }
.deck-item input { accent-color: var(--accent); cursor: pointer; flex-shrink: 0; }
.deck-name { flex: 1; }
.deck-count { font-size: 0.6rem; opacity: 0.4; }

/* ── Card section ───────────────────────────────────────────────────────── */
.card-content {
	display: flex;
	flex-direction: column;
	gap: 0.4rem;
	flex: 1 1 auto;
	min-height: 0;
	overflow-y: auto;
	padding-right: 0.2rem;
	max-width: var(--panel-measure);
	margin: 0 auto;
}

.card-image-wrap {
	width: 100%;
	aspect-ratio: 2 / 3;
	max-height: 22rem;
	border-radius: 8px;
	overflow: hidden;
	margin-bottom: 0.2rem;
	background: color-mix(in srgb, var(--surface) 60%, transparent);
}

.card-image {
	width: 100%;
	height: 100%;
	object-fit: cover;
	display: block;
}

.card-title {
	font-size: 0.96rem;
	font-weight: 600;
	color: var(--text);
	letter-spacing: 0.01em;
}

.card-keywords {
	font-size: 0.62rem;
	color: var(--muted);
	letter-spacing: 0.04em;
	font-family: var(--font-mono);
	text-transform: uppercase;
	font-weight: 300;
}

.card-body {
	font-family: var(--font-mono);
	font-size: 0.78rem;
	line-height: 1.65;
	color: var(--text);
	opacity: 0.85;
	white-space: pre-wrap;
	margin: 0;
	overflow-y: auto;
}

.ogham .card-body:first-letter {
	font-size: 4em;
}

.card-summary,
.rite-description {
	font-size: var(--panel-copy-size);
	line-height: 1.55;
	color: var(--text);
	opacity: 0.88;
	margin: 0;
}

.card-detail-block {
	display: flex;
	flex-direction: column;
	gap: 0.2rem;
}

.card-detail-label {
	font-family: var(--font-mono);
	font-size: 0.58rem;
	letter-spacing: 0.04em;
	color: var(--muted);
	text-transform: uppercase;
	font-weight: 300;
}

.card-source {
	font-size: 0.78rem;
	line-height: 1.45;
	color: var(--muted);
}

/* ── Practice section ───────────────────────────────────────────────────── */
.practice-content {
	display: flex;
	flex-direction: column;
	gap: 0.6rem;
	flex: 1 1 auto;
	min-height: 0;
	overflow-y: auto;
	padding-right: 0.2rem;
	max-width: var(--panel-measure);
	margin: 0 auto;
}

.practice-meta {
	display: flex;
	flex-wrap: wrap;
	gap: 0.3rem;
}

.practice-chip {
	font-family: var(--font-mono);
	font-size: 0.6rem;
	letter-spacing: 0.04em;
	color: var(--muted);
	border: 1px solid var(--border);
	border-radius: 2px;
	padding: 0.15rem 0.4rem;
	opacity: 0.75;
	font-weight: 300;
	text-transform: uppercase;
}

/* ── Rite section ───────────────────────────────────────────────────────── */
.rite-content {
	display: flex;
	flex-direction: column;
	gap: 0.6rem;
	flex: 1 1 auto;
	min-height: 0;
	overflow-y: auto;
	padding-right: 0.2rem;
	max-width: var(--panel-measure);
	margin: 0 auto;
}

.rite-name {
	font-family: var(--font-display);
	font-size: 1rem;
	color: var(--text);
	letter-spacing: 0.01em;
}

.rite-act {
	font-size: var(--panel-copy-size);
	line-height: 1.55;
	color: var(--text);
	opacity: 0.9;
}

.rite-invocation {
	font-style: italic;
	font-size: 0.82rem;
	color: var(--accent);
	opacity: 0.85;
}

.rite-textures {
	margin: 0;
	padding-left: 1.1rem;
	display: flex;
	flex-direction: column;
	gap: 0.2rem;
}
.rite-textures li {
	font-size: var(--panel-copy-size);
	color: var(--muted);
	line-height: 1.4;
}

.rite-context {
	font-size: 0.75rem;
	color: var(--muted);
	font-style: italic;
}

.rite-duration {
	font-family: var(--font-mono);
	font-size: 0.65rem;
	color: var(--muted);
	letter-spacing: 0.05em;
	opacity: 0.6;
}

/* ── Pending section ────────────────────────────────────────────────────── */
.progress-bar {
	display: flex;
	gap: 0.3rem;
	align-items: stretch;
}

.progress-seg {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 0.3rem;
	align-items: center;
}

.progress-fill {
	height: 3px;
	width: 100%;
	border-radius: 2px;
	background: var(--border);
	transition: background 0.3s;
}

.progress-seg.active .progress-fill {
	background: var(--accent);
}

.progress-label {
	font-family: var(--font-mono);
	font-size: 0.55rem;
	letter-spacing: 0.06em;
	color: var(--muted);
	text-transform: uppercase;
}

.progress-seg.active .progress-label {
	color: var(--accent);
}

.pending-prompt {
	font-style: italic;
	font-size: 0.75rem;
	color: var(--muted);
	opacity: 0.65;
	margin: 0;
	text-align: center;
	line-height: 1.5;
}

/* ── Actions ────────────────────────────────────────────────────────────── */
.panel-actions {
	display: flex;
	flex-direction: column;
	gap: 0.4rem;
	margin-top: auto;
	max-width: var(--panel-measure);
	width: 100%;
	margin-left: auto;
	margin-right: auto;
}

.draw-btn,
.action-primary,
.action-secondary {
	border-radius: var(--radius);
	cursor: pointer;
	font-family: var(--font-mono);
	font-size: 0.66rem;
	letter-spacing: 0.08em;
	padding: 0.5rem 0.75rem;
	text-align: center;
	transition: all 0.15s;
	width: 100%;
	text-transform: lowercase;
	font-weight: 500;
}

.draw-btn,
.action-secondary {
	background: none;
	border: 1px solid var(--border);
	color: var(--muted);
}
.draw-btn:hover:not(:disabled),
.action-secondary:hover:not(:disabled) {
	border-color: var(--accent);
	color: var(--accent);
}

.action-primary {
	background: color-mix(in srgb, var(--accent) 12%, transparent);
	border: 1px solid var(--accent);
	color: var(--accent);
}
.action-primary:hover:not(:disabled) {
	background: color-mix(in srgb, var(--accent) 22%, transparent);
}

.draw-btn:disabled,
.action-primary:disabled,
.action-secondary:disabled {
	opacity: 0.3;
	cursor: default;
}

.draw-btn.drawing {
	animation: pulse 0.8s ease-in-out infinite;
}

@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }

/* ── Rite nudge (idle mode, rites deck selected) ────────────────────────── */
.rite-nudge {
	display: flex;
	align-items: center;
	gap: 0.6rem;
	width: 100%;
	padding: 0.5rem 0.75rem;
	background: none;
	border: 1px dashed color-mix(in srgb, var(--accent) 30%, var(--border));
	border-radius: var(--radius);
	cursor: pointer;
	text-align: left;
	opacity: 0.6;
	transition: opacity 0.15s, border-color 0.15s;
}
.rite-nudge:hover {
	opacity: 1;
	border-color: color-mix(in srgb, var(--accent) 55%, var(--border));
}
.rite-nudge-pip {
	font-size: 0.75rem;
	color: var(--accent);
	flex-shrink: 0;
}
.rite-nudge-text {
	display: flex;
	flex-direction: column;
	gap: 0.1rem;
	min-width: 0;
}
.rite-nudge-name {
	font-family: var(--font-mono);
	font-size: 0.65rem;
	font-weight: 500;
	letter-spacing: 0.03em;
	color: var(--text);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}
.rite-nudge-cta {
	font-family: var(--font-mono);
	font-size: 0.58rem;
	letter-spacing: 0.06em;
	color: var(--accent);
	text-transform: lowercase;
	font-weight: 300;
}
</style>
