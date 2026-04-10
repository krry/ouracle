<script lang="ts">
  import {
    startAmbient, stopAmbient, ambientRunning, ambientScene, binauralBeat, updateBinauralBeat,
    startScene, stopScene, ambientSceneFile,
    startBowls, stopBowls, skipBowl, bowlsActive,
    startFeature, stopFeature, chimesActive, birdsongActive,
  } from './ambientEngine';

  const MIN_HZ = 0.5;
  const MAX_HZ = 100;
  const LOG_RANGE = Math.log(MAX_HZ / MIN_HZ);

  // φ-derived preset frequencies — tapping the label cycles through these
  const PRESETS = [
    { hz: 1.618,  label: '1.618 Hz δ' },
    { hz: 4.236,  label: '4.236 Hz θ' },
    { hz: 6.180,  label: '6.180 Hz α' },
    { hz: 16.180, label: '16.18 Hz β' },
    { hz: 61.803, label: '61.80 Hz γ' },
  ] as const;

  function sliderToHz(pos: number): number {
    return MIN_HZ * Math.exp((pos / 1000) * LOG_RANGE);
  }

  function hzToSlider(hz: number): number {
    return Math.log(hz / MIN_HZ) / LOG_RANGE * 1000;
  }

  function band(hz: number): string {
    if (hz < 4)  return 'δ';
    if (hz < 8)  return 'θ';
    if (hz < 13) return 'α';
    if (hz < 30) return 'β';
    return 'γ';
  }

  const sliderPos = $derived(hzToSlider($binauralBeat));

  const beatLabel = $derived(() => {
    const preset = PRESETS.find(p => Math.abs(p.hz - $binauralBeat) < 0.01);
    return preset?.label ?? `${band($binauralBeat)} · ${$binauralBeat < 10 ? $binauralBeat.toFixed(1) : Math.round($binauralBeat)} Hz`;
  });

  function cyclePreset() {
    const idx = PRESETS.findIndex(p => Math.abs(p.hz - $binauralBeat) < 0.01);
    const next = PRESETS[(idx + 1) % PRESETS.length];
    if ($ambientRunning && $ambientScene === 'binaural') {
      updateBinauralBeat(next.hz);
    } else {
      binauralBeat.set(next.hz);
    }
  }

  function onSlide(e: Event) {
    const hz = Math.round(sliderToHz(Number((e.target as HTMLInputElement).value)) * 10) / 10;
    if ($ambientRunning && $ambientScene === 'binaural') {
      updateBinauralBeat(hz);
    } else {
      binauralBeat.set(hz);
    }
  }

  function toggleTones() {
    if ($ambientRunning) stopAmbient();
    else startAmbient($ambientScene, 0.75);
  }

  const SCENE_OPTIONS = [
    { id: '',                label: 'no scene' },
    { id: 'scene-forest',   label: 'forest' },
    { id: 'scene-night',    label: 'night' },
    { id: 'scene-jungle',   label: 'jungle' },
    { id: 'scene-storm',    label: 'storm' },
    { id: 'scene-deluge',   label: 'deluge' },
    { id: 'scene-meadow',   label: 'meadow' },
    { id: 'scene-spring',   label: 'spring' },
    { id: 'scene-cuckoo',   label: 'cuckoo' },
    { id: 'scene-starlings', label: 'starlings' },
    { id: 'scene-ravens',   label: 'ravens' },
    { id: 'scene-sonora',    label: 'sonora' },
    { id: 'scene-zegenwerp', label: 'zegenwerp' },
  ];

  function onSceneChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value;
    if (!val) stopScene();
    else startScene(val);
  }

  function shuffleScene() {
    const options = SCENE_OPTIONS.filter(o => o.id !== '');
    const pick = options[Math.floor(Math.random() * options.length)];
    startScene(pick.id);
  }

  function toggleBowls() {
    if ($bowlsActive) stopBowls();
    else startBowls();
  }

  function toggleChimes() {
    if ($chimesActive) stopFeature('chimes');
    else startFeature('chimes');
  }

  function toggleBirdsong() {
    if ($birdsongActive) stopFeature('birdsong');
    else startFeature('birdsong');
  }
</script>

<div class="ambient">
  <button class="al-row" class:on={$ambientRunning} onclick={toggleTones}>
    <span class="al-icon">♩</span>
    <span class="al-label">tones</span>
  </button>

  {#if $ambientRunning && $ambientScene === 'binaural'}
    <div class="beat-sub">
      <button class="beat-cycle" onclick={cyclePreset}>{beatLabel()}</button>
      <input
        type="range"
        class="beat-slider"
        min="0" max="1000" step="1"
        value={sliderPos}
        oninput={onSlide}
        aria-label="binaural beat frequency"
      />
    </div>
  {/if}

  <div class="al-row" class:on={!!$ambientSceneFile}>
    <span class="al-icon">∿</span>
    <select
      class="al-select"
      value={$ambientSceneFile ?? ''}
      onchange={onSceneChange}
      aria-label="ambient scene"
    >
      {#each SCENE_OPTIONS as opt}
        <option value={opt.id}>{opt.label}</option>
      {/each}
    </select>
    <button class="al-skip" onclick={shuffleScene} title="random scene">⇄</button>
  </div>

  <div class="al-row" class:on={$bowlsActive}>
    <button class="al-row-btn" onclick={toggleBowls}>
      <span class="al-icon">◯</span>
      <span class="al-label">bowls</span>
    </button>
    {#if $bowlsActive}
      <button class="al-skip" onclick={skipBowl} title="next bowl">›</button>
    {/if}
  </div>

  <div class="al-features">
    <button class="al-row" class:on={$chimesActive} onclick={toggleChimes}>
      <span class="al-icon">⌁</span>
      <span class="al-label">chimes</span>
    </button>
    <button class="al-row" class:on={$birdsongActive} onclick={toggleBirdsong}>
      <span class="al-icon">♭</span>
      <span class="al-label">birds</span>
    </button>
  </div>
</div>

<style>
/* ── shared row system ─────────────────────────────────────────────── */
.ambient {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

/* used as both <button> and <div> — keep non-interactive defaults neutral */
.al-row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  background: none;
  border: none;
  padding: 0.15rem 0.4rem;
  margin: 0 -0.4rem;
  cursor: pointer;
  color: var(--muted);
  text-align: left;
  transition: color 0.15s;
  width: calc(100% + 0.8rem);
  border-radius: 999px;
}
.al-row:hover { color: color-mix(in srgb, var(--muted) 60%, var(--accent)); }
.al-row.on    { color: var(--accent); }

/* fixed-width icon slot — all icons rendered at same size */
.al-icon {
  width: 1.1rem;
  flex-shrink: 0;
  text-align: center;
  font-size: 0.8rem;
  line-height: 1;
}

.al-label {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  font-weight: 500;
  text-transform: lowercase;
}

/* scene select inherits row color so on/off state cascades */
.al-select {
  appearance: none;
  -webkit-appearance: none;
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  font-weight: 500;
  text-transform: lowercase;
  color: inherit;
  border-radius: 999px;
  outline-offset: 3px;
}
.al-select option { background: var(--bg); color: var(--text); }

/* inner toggle button inside a non-button al-row (bowls) */
.al-row-btn {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  cursor: pointer;
  color: inherit;
  text-align: left;
  border-radius: 999px;
}

.al-skip {
  background: none;
  border: none;
  padding: 0 0.1rem;
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 0.85rem;
  line-height: 1;
  color: color-mix(in srgb, var(--accent) 55%, transparent);
  transition: color 0.15s;
  border-radius: 999px;
}
.al-skip:hover { color: var(--accent); }

/* features row: two buttons side by side with a separator gap */
.al-features {
  display: flex;
  gap: 1rem;
}
.al-features .al-row { width: auto; }

/* ── binaural sub-row ──────────────────────────────────────────────── */
.beat-sub {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-left: 1.65rem; /* aligns with .al-label column */
  margin-bottom: 0.1rem;
}

.beat-cycle {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 0.6rem;
  letter-spacing: 0.06em;
  color: var(--muted);
  white-space: nowrap;
  transition: color 0.15s;
}
.beat-cycle:hover { color: var(--accent); }

.beat-slider {
  appearance: none;
  background: var(--border);
  border-radius: 2px;
  height: 2px;
  flex: 1;
  cursor: pointer;
}
.beat-slider::-webkit-slider-thumb {
  appearance: none;
  background: var(--accent);
  border-radius: 50%;
  height: 10px;
  width: 10px;
}
</style>
