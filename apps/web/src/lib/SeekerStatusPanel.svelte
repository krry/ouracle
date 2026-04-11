<script lang="ts">
	import { seekerState } from './stores';
	import type { VagalInfo, BeliefInfo, QualityInfo, AffectInfo } from './stores';
	let { variant = 'compact' }: { variant?: 'compact' | 'expanded' } = $props();

	// Confidence → opacity: low=0.5, medium=0.75, high=1.0
	const confidenceOpacity = (c: 'low' | 'medium' | 'high' | null): number => {
		if (c === 'high') return 1.0;
		if (c === 'medium') return 0.75;
		if (c === 'low') return 0.5;
		return 0.4;
	};

	// Vagal: sympathetic=warm red-orange, dorsal=cold blue, ventral=neutral rich green
	const vagalColor = (v: VagalInfo['probable']) => {
		switch (v) {
			case 'ventral':    return 'hsl(145, 52%, 40%)';  // rich green
			case 'sympathetic':return 'hsl(18,  82%, 54%)';  // warm red-orange
			case 'dorsal':     return 'hsl(210, 68%, 52%)';  // cold blue
			case 'mixed':      return 'hsl(38,  75%, 52%)';  // amber
			default:           return 'var(--border)';
		}
	};

	// Chakra palette — root→crown, plus transitional steps
	const CHAKRA_COLORS: Record<string, string> = {
		root:    'hsl(0,   68%, 52%)',   // red
		sacral:  'hsl(25,  82%, 54%)',   // orange
		solar:   'hsl(48,  88%, 46%)',   // gold
		heart:   'hsl(140, 52%, 40%)',   // green
		throat:  'hsl(190, 62%, 46%)',   // cyan
		brow:    'hsl(240, 52%, 58%)',   // indigo
		crown:   'hsl(275, 52%, 58%)',   // violet
	};

	// Belief pattern → chakra color
	const beliefColor = (pattern: BeliefInfo['pattern']): string => {
		const map: Record<string, string> = {
			scarcity:     CHAKRA_COLORS.root,
			unworthiness: CHAKRA_COLORS.sacral,
			control:      CHAKRA_COLORS.solar,
			isolation:    CHAKRA_COLORS.heart,
			silence:      CHAKRA_COLORS.throat,
			blindness:    CHAKRA_COLORS.brow,
			separation:   CHAKRA_COLORS.crown,
		};
		return pattern ? (map[pattern] ?? 'var(--muted)') : 'var(--muted)';
	};

	// OCTAVE quality → chakra color (via engine's quality↔chakra correspondence)
	const qualityColor = (q: string | null): string => {
		const map: Record<string, string> = {
			entity:    CHAKRA_COLORS.root,
			affinity:  CHAKRA_COLORS.sacral,
			activity:  CHAKRA_COLORS.solar,
			capacity:  CHAKRA_COLORS.heart,
			causality: CHAKRA_COLORS.throat,
			eternity:  CHAKRA_COLORS.brow,
			unity:     CHAKRA_COLORS.crown,
			// transitional steps — no fixed chakra anchor
			pity:      'hsl(75,  62%, 40%)',  // yellow-green (air shock)
			calamity:  'hsl(340, 65%, 46%)',  // crimson (collapse)
			cyclicity: 'hsl(200, 38%, 56%)',  // muted teal (all/return)
		};
		return q ? (map[q] ?? 'var(--muted)') : 'var(--muted)';
	};

	// Compute position for circumplex dot: valence (x), arousal (y)
	function getDotX(): number {
		const v = $seekerState.affect.valence;
		return v !== null ? 50 + v * 45 : 50; // map [-1,1] to [5%,95%]
	}
	function getDotY(): number {
		const a = $seekerState.affect.arousal;
		return a !== null ? 50 - a * 45 : 50; // map [-1,1] to [95%,5%]
	}

	// Tooltip for dot
	function getDotTitle(): string {
		const { valence, arousal, gloss, confidence } = $seekerState.affect;
		if (valence === null || arousal === null) return 'No affect data';
		return `Valence: ${valence.toFixed(2)}, Arousal: ${arousal.toFixed(2)}\nGloss: ${gloss ?? 'n/a'}\nConfidence: ${confidence ?? 'n/a'}`;
	}
</script>

<div class="seeker-status" class:has-data={$seekerState.affect.valence !== null} class:expanded={variant === 'expanded'}>
	<div class="ss-header">
		<div class="ss-identity">
			<span class="ss-label">Seeker</span>
			<span class="ss-handle">{$seekerState.handle ?? 'guest'}</span>
		</div>
	</div>

	<!-- Circumplex affect plot -->
	<div class="ss-affect-plot" title={getDotTitle()}>
		<svg viewBox="0 0 100 100" class="circumplex">
			<!-- Axes -->
			<line x1="0" y1="50" x2="100" y2="50" class="axis" />
			<line x1="50" y1="0" x2="50" y2="100" class="axis" />
		<!-- Axis labels and +/- markers -->
		<!-- X-axis: Valence -->
		<text x="5" y="54" class="axis-label valence-label">-</text>
		<text x="98" y="54" class="axis-label valence-label">+</text>
		<text x="50" y="96" class="axis-label valence-label">Valence</text>

		<!-- Y-axis: Arousal (rotated vertical) -->
		<text x="54" y="8" class="axis-label arousal-label">+</text>
		<text x="54" y="98" class="axis-label arousal-label">-</text>
		<text x="92" y="50" class="axis-label arousal-label">Arousal</text>
			<!-- Data point -->
			<circle cx={getDotX()} cy={getDotY()} r="4" class="affect-dot" />
		</svg>
		<!-- Gloss temporarily commented out until we understand its purpose
		{#if $seekerState.affect.gloss}
			<div class="ss-affect-gloss">{$seekerState.affect.gloss}</div>
		{/if}
		-->
	</div>

	<!-- Inference badges -->
	<div class="ss-badges">
		<div class="badge-row">
			<span class="badge-label">vagality</span>
			<span
				class="badge-value"
				style="color: {vagalColor($seekerState.vagal.probable)}; opacity: {confidenceOpacity($seekerState.vagal.confidence)}"
			>{$seekerState.vagal.probable ?? '_'}</span>
		</div>
		<div class="badge-row">
			<span class="badge-label">credulity</span>
			<span
				class="badge-value"
				style="color: {beliefColor($seekerState.belief.pattern)}; opacity: {confidenceOpacity($seekerState.belief.confidence)}"
			>{$seekerState.belief.pattern ?? '_'}</span>
		</div>
		<div class="badge-row">
			<span class="badge-label">quality</span>
			<span
				class="badge-value"
				style="color: {qualityColor($seekerState.quality.quality)}; opacity: {confidenceOpacity($seekerState.quality.confidence)}"
			>{$seekerState.quality.quality ?? '_'}</span>
		</div>
	</div>
</div>

<style>
	.seeker-status {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.6rem 0.75rem;
		background: color-mix(in srgb, var(--surface) 90%, transparent);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-family: var(--font-mono);
		color: var(--text);
		opacity: 0.9;
	}
	.seeker-status.has-data {
		/* subtle glow when we have active data */
		box-shadow: 0 0 12px hsl(0 0% 0% / 0.2);
	}

	.ss-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.ss-identity {
		display: flex;
		flex-direction: row;
		align-items: baseline;
		gap: 1ch;
	}
	.ss-handle {
		font-size: 0.75rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		color: var(--accent);
	}
	.ss-label {
		font-size: 0.55rem;
		text-transform: uppercase;
		letter-spacing: 0.12em;
		color: var(--muted);
		min-width: 3rem;
		text-align: right;
	}

	/* Circumplex plot */
	.ss-affect-plot {
		position: relative;
		width: 100%;
		aspect-ratio: 1;
		max-width: 120px;
		margin: 0 auto;
	}
	.circumplex {
		width: 100%;
		height: 100%;
	}
	.axis {
		stroke: var(--border);
		stroke-width: 0.5;
	}
	.axis-label {
		font-size: 4px;
		text-anchor: middle;
		fill: var(--muted);
		opacity: 0.6;
		font-weight: 500;
	}
	.valence-label {
		font-size: 5px;
	}
	.arousal-label {
		font-size: 5px;
		transform: rotate(-90deg);
		transform-origin: center;
	}
	.affect-dot {
		fill: var(--accent);
		filter: drop-shadow(0 0 4px var(--accent));
		transition: cx 0.3s ease, cy 0.3s ease;
	}
	.ss-affect-gloss {
		font-size: 0.65rem;
		text-align: center;
		color: var(--muted);
		margin-top: 0.25rem;
		line-height: 1.3;
	}

	/* Badges */
	.ss-badges {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.badge-row {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.65rem;
	}
	.badge-label {
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		min-width: 4rem;
		text-align: right;
		margin-right: 1ch;
	}
	.badge-value {
		font-weight: 600;
		text-transform: lowercase;
		transition: color 0.4s ease, opacity 0.4s ease;
	}

	.seeker-status.expanded {
		padding: 1rem;
		gap: 0.8rem;
	}
	.seeker-status.expanded .ss-header {
		padding-bottom: 0.2rem;
		border-bottom: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
	}
	.seeker-status.expanded .ss-handle {
		font-size: 1rem;
	}
	.seeker-status.expanded .ss-label {
		font-size: 0.6rem;
	}
	.seeker-status.expanded .ss-affect-plot {
		max-width: 180px;
	}
	.seeker-status.expanded .badge-row {
		font-size: 0.72rem;
	}
	.seeker-status.expanded .badge-label {
		min-width: 4.5rem;
	}

	/* Compact variant for drawer (stacked, no plot? Actually drawer is narrow, we may keep plot small) */
	@media (max-width: 767px) {
		.seeker-status {
			width: 100%;
			padding: 0.5rem 0.6rem;
		}
		.ss-affect-plot {
			max-width: 80px;
		}
		.axis-label {
			font-size: 3px;
		}
		.badge-row {
			font-size: 0.6rem;
		}
	}
</style>
