<script lang="ts">
  import { startAmbient, stopAmbient, ambientRunning, ambientScene, SCENES, binauralBeat } from './ambientEngine';
  import type { SceneId } from './ambientEngine';

  // Beat frequency presets: [label, hz]
  const BEATS: [string, number][] = [
    ['δ 1', 1], ['δ 4', 4], ['θ 6', 6], ['θ 8', 8],
    ['α 10', 10], ['α 13', 13], ['β 20', 20], ['β 30', 30],
  ];

  function setBeat(hz: number) {
    binauralBeat.set(hz);
    if ($ambientRunning && $ambientScene === 'binaural') startAmbient('binaural', 0.75);
  }

  function toggle() {
    if ($ambientRunning) stopAmbient();
    else startAmbient($ambientScene, 0.75);
  }

  function switchScene(scene: SceneId) {
    ambientScene.set(scene);
    if ($ambientRunning) startAmbient(scene, 0.75);
  }
</script>

<div class="ambient">
  <button
    class="toggle"
    class:on={$ambientRunning}
    onclick={toggle}
    title={$ambientRunning ? 'stop' : 'ambient'}
  >♪</button>

  <select
    class="scene"
    value={$ambientScene}
    onchange={(e) => switchScene((e.target as HTMLSelectElement).value as SceneId)}
    aria-label="ambient scene"
  >
    {#each SCENES as s}
      <option value={s.id}>{s.label}</option>
    {/each}
  </select>

  {#if $ambientScene === 'binaural'}
    <select
      class="scene beat"
      value={$binauralBeat}
      onchange={(e) => setBeat(Number((e.target as HTMLSelectElement).value))}
      aria-label="binaural beat frequency"
      title="beat frequency"
    >
      {#each BEATS as [label, hz]}
        <option value={hz}>{label} Hz</option>
      {/each}
    </select>
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
</style>
