<script lang="ts">
  import { startAmbient, stopAmbient, ambientRunning, ambientScene, binauralBeat, updateBinauralBeat } from './ambientEngine';


  const MIN_HZ = 0.5;
  const MAX_HZ = 100;
  const LOG_RANGE = Math.log(MAX_HZ / MIN_HZ);

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

  const sliderPos  = $derived(hzToSlider($binauralBeat));
  const beatLabel  = $derived(`${band($binauralBeat)} · ${$binauralBeat < 10 ? $binauralBeat.toFixed(1) : Math.round($binauralBeat)} Hz`);

  function onSlide(e: Event) {
    const hz = Math.round(sliderToHz(Number((e.target as HTMLInputElement).value)) * 10) / 10;
    if ($ambientRunning && $ambientScene === 'binaural') {
      updateBinauralBeat(hz);
    } else {
      binauralBeat.set(hz);
    }
  }

  function toggle() {
    if ($ambientRunning) stopAmbient();
    else startAmbient($ambientScene, 0.75);
  }


</script>

<div class="ambient">
  <button
    class="toggle beat-label"
    class:on={$ambientRunning}
    onclick={toggle}
    title={$ambientRunning ? 'stop' : 'ambient'}
  ><span class="tones-icon">♪</span> tones</button>

  {#if $ambientScene === 'binaural'}
    <div class="beat-ctrl">
      <span class="beat-label">{beatLabel}</span>
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
</div>

<style>
.ambient {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.toggle {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0.1rem 0.2rem;
  transition: color 0.15s;
}
.toggle.on { color: var(--accent); }

.scene {
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
.scene:hover, .scene:focus { color: var(--accent); outline: none; }
.scene option { background: var(--bg); color: var(--text); }

.beat-ctrl {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.2rem;
  width: 96px;
}

.beat-slider {
  appearance: none;
  background: var(--border);
  border-radius: 2px;
  height: 2px;
  width: 100%;
  cursor: pointer;
}
.beat-slider::-webkit-slider-thumb {
  appearance: none;
  background: var(--accent);
  border-radius: 50%;
  height: 10px;
  width: 10px;
}

.tones-icon {
  font-size: 1rem;
  line-height: 1;
}

.beat-label {
  font-family: var(--font-mono);
  letter-spacing: 0.08em;
  font-size: 0.65em;
  color: var(--muted);
  margin-right: 1ch;
}

.beat-ctrl .beat-label {
  font-size: 0.6rem;
  letter-spacing: 0.06em;
  white-space: nowrap;
}
</style>
