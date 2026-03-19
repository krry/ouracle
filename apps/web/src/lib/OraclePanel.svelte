<script lang="ts">
	import { activeRite, activeCard, pendingRite } from './stores';
	import type { CardData, RiteData } from './stores';

	let {
		availableDecks = [],
		selectedDecks = new Set<string>(),
		onDeckToggle,
		onDrawCard,
		onInterpretCard,
		onAcceptRite,
		drawing = false,
		streaming = false,
	}: {
		availableDecks: { id: string; meta: { name?: string; description?: string }; count: number }[];
		selectedDecks: Set<string>;
		onDeckToggle: (id: string, checked: boolean) => void;
		onDrawCard: () => void;
		onInterpretCard: (card: CardData) => void;
		onAcceptRite: (rite: RiteData) => void;
		drawing?: boolean;
		streaming?: boolean;
	} = $props();

	let deckPickerOpen = $state(false);

	const mode = $derived(
		$activeRite   ? 'rite'    :
		$activeCard   ? 'card'    :
		$pendingRite  ? 'pending' :
		'idle'
	);

	const STAGES: Array<'offered' | 'prescribed' | 'completed'> = ['offered', 'prescribed', 'completed'];

	function dismissCard() { activeCard.set(null); }
	function dismissRite() { activeRite.set(null); }

	function handleInterpret() {
		if ($activeCard) {
			onInterpretCard($activeCard);
			activeCard.set(null);
		}
	}

	function handleAccept() {
		if ($activeRite) {
			onAcceptRite($activeRite);
			activeRite.set(null);
		}
	}

	function handleDrawAgain() {
		activeCard.set(null);
		activeRite.set(null);
		onDrawCard();
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
					<button class="deck-all" onclick={() => availableDecks.forEach(d => onDeckToggle(d.id, true))}>all</button>
					<span class="sep">·</span>
					<button class="deck-all" onclick={() => availableDecks.forEach(d => onDeckToggle(d.id, false))}>none</button>
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
		</div>

	{:else if mode === 'card' && $activeCard}
		<!-- ── Card active ── -->
		<div class="panel-section card-section">
			<div class="panel-header">
				<span class="panel-label">◈ {$activeCard.deckLabel}</span>
				<button class="dismiss-btn" onclick={dismissCard} aria-label="Dismiss card">✕</button>
			</div>

			<div class="card-content">
				<div class="card-title">{$activeCard.title}</div>
				{#if $activeCard.keywords.length}
					<div class="card-keywords">{$activeCard.keywords.join(' · ')}</div>
				{/if}
				<pre class="card-body">{$activeCard.body}</pre>
			</div>

			<div class="panel-actions">
				<button class="action-primary" onclick={handleInterpret} disabled={streaming}>
					Interpret
				</button>
				<button class="action-secondary" onclick={handleDrawAgain} disabled={drawing || streaming}>
					Draw Again
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
				<span class="panel-label">◬ rite · pending</span>
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
		</div>
	{/if}
</aside>

<style>
/* ── Panel shell ────────────────────────────────────────────────────────── */
.oracle-panel {
	/* Overlay — positioned by the parent (chat/+page.svelte) */
	display: flex;
	flex-direction: column;
	background: color-mix(in srgb, var(--bg) 85%, transparent);
	backdrop-filter: blur(20px) saturate(180%);
	-webkit-backdrop-filter: blur(20px) saturate(180%);
	border: 1px solid rgba(255, 255, 255, 0.15);
	border-radius: var(--radius);
	box-shadow:
		0 1px 3px rgba(0, 0, 0, 0.08),
		0 8px 24px rgba(0, 0, 0, 0.1),
		inset 0 1px 0 rgba(255, 255, 255, 0.1);
	overflow: hidden;
	width: 100%;
}

.panel-section {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
	padding: 1rem;
}

/* ── Header row (card / rite) ───────────────────────────────────────────── */
.panel-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.panel-label {
	font-family: var(--font-mono);
	font-size: 0.62rem;
	letter-spacing: 0.15em;
	color: var(--accent);
	text-transform: uppercase;
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
	font-size: 0.65rem;
	letter-spacing: 0.1em;
	padding: 0;
	transition: color 0.15s;
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
	font-size: 0.6rem;
	letter-spacing: 0.08em;
	padding: 0;
	transition: color 0.15s;
}
.deck-all:hover { color: var(--accent); }
.sep { color: var(--border); font-size: 0.6rem; }

.deck-list {
	display: flex;
	flex-direction: column;
	gap: 0;
	border: 1px solid var(--border);
	border-radius: var(--radius);
	overflow: hidden;
}

.deck-item {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.3rem 0.6rem;
	cursor: pointer;
	font-size: 0.72rem;
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
}

.card-title {
	font-size: 1rem;
	font-weight: 600;
	color: var(--text);
	letter-spacing: 0.04em;
}

.card-keywords {
	font-size: 0.68rem;
	color: var(--muted);
	letter-spacing: 0.1em;
}

.card-body {
	font-family: var(--font-mono);
	font-size: 0.78rem;
	line-height: 1.65;
	color: var(--text);
	opacity: 0.85;
	white-space: pre-wrap;
	margin: 0;
	max-height: 220px;
	overflow-y: auto;
}

/* ── Rite section ───────────────────────────────────────────────────────── */
.rite-content {
	display: flex;
	flex-direction: column;
	gap: 0.6rem;
}

.rite-name {
	font-family: var(--font-display);
	font-size: 1.05rem;
	color: var(--text);
	letter-spacing: 0.06em;
}

.rite-act {
	font-size: 0.88rem;
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
	font-size: 0.78rem;
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
	letter-spacing: 0.08em;
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
	letter-spacing: 0.1em;
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
	margin-top: 0.25rem;
}

.draw-btn,
.action-primary,
.action-secondary {
	border-radius: var(--radius);
	cursor: pointer;
	font-family: var(--font-mono);
	font-size: 0.75rem;
	letter-spacing: 0.1em;
	padding: 0.5rem 0.75rem;
	text-align: center;
	transition: all 0.15s;
	width: 100%;
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
</style>
