<script lang="ts">
	import { seekerState } from './stores';
	import type { VagalInfo, BeliefInfo, QualityInfo, AffectInfo } from './stores';

	// Color helpers
	const confidenceColor = (c: 'low' | 'medium' | 'high' | null) => {
		if (c === 'high') return 'var(--accent)';
		if (c === 'medium') return 'var(--muted)';
		return 'var(--border)';
	};

	const vagalColor = (v: VagalInfo['probable']) => {
		switch (v) {
			case 'ventral': return '#2ecc71'; // green
			case 'sympathetic': return '#e74c3c'; // red
			case 'dorsal': return '#3498db'; // blue
			case 'mixed': return '#f39c12'; // orange
			default: return 'var(--border)';
		}
	};

	// Compute position for circumplex dot: valence (x), arousal (y)
	function getDotX(): number {
		const v = $seekerState.affect.valence;
		return v !== null ? 50 + v * 45 : 50; // map [-1,1] to [5%,95%]
	}
	function getDotY(): number {
		const a = $seekerState.affect.arousal;
		return a !== null ? 50 + a * 45 : 50; // map [-1,1] to [5%,95%]
	}

	// Tooltip for dot
	function getDotTitle(): string {
		const { valence, arousal, gloss, confidence } = $seekerState.affect;
		if (valence === null || arousal === null) return 'No affect data';
		return `Valence: ${valence.toFixed(2)}, Arousal: ${arousal.toFixed(2)}\nGloss: ${gloss ?? 'n/a'}\nConfidence: ${confidence ?? 'n/a'}`;
	}
</script>

<div class="seeker-status" class:has-data={$seekerState.affect.valence !== null}>
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
			<span class="badge-label">vagus</span>
			<span class="badge-value" style="color: {vagalColor($seekerState.vagal.probable)}">
				{$seekerState.vagal.probable ?? '_'}
			</span>
			<span class="badge-confidence" style="color: {confidenceColor($seekerState.vagal.confidence)}">
				({$seekerState.vagal.confidence ?? '?'})
			</span>
		</div>
		<div class="badge-row">
			<span class="badge-label">belief</span>
			<span class="badge-value">{$seekerState.belief.pattern ?? '_'}</span>
			<span class="badge-confidence" style="color: {confidenceColor($seekerState.belief.confidence)}">
				({$seekerState.belief.confidence ?? '?'})
			</span>
		</div>
		<div class="badge-row">
			<span class="badge-label">quality</span>
			<span class="badge-value">{$seekerState.quality.quality ?? '_'}</span>
			<span class="badge-confidence" style="color: {confidenceColor($seekerState.quality.confidence)}">
				({$seekerState.quality.confidence ?? '?'})
			</span>
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
		min-width: 3rem;
		text-align: right;
		margin-right: 1ch;
	}
	.badge-value {
		font-weight: 600;
		text-transform: lowercase;
	}
	.badge-confidence {
		font-size: 0.6rem;
		opacity: 0.7;
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
