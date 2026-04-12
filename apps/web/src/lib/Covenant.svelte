<script lang="ts">
  import { onMount } from 'svelte';
  import { creds } from './stores';

  const { onaccept }: { onaccept: () => void } = $props();

  const BASE = import.meta.env.VITE_OURACLE_BASE_URL ?? 'https://api.ouracle.kerry.ink';

  let lines = $state<string[]>([]);
  let busy = $state(false);
  let error = $state('');

  onMount(async () => {
    const r = await fetch(`${BASE}/covenant/current`);
    if (r.ok) {
      const data = await r.json();
      lines = data.text ?? [];
    }
  });

  async function accept() {
    busy = true;
    error = '';
    try {
      const token = $creds?.access_token;
      const r = await fetch(`${BASE}/covenant`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!r.ok) { error = 'Could not record acceptance — try again.'; return; }
      // Update stored stage so the gate doesn't re-show
      if ($creds) creds.login({ ...$creds, stage: 'covenanted' });
      onaccept();
    } catch {
      error = 'Network error — try again.';
    } finally {
      busy = false;
    }
  }
</script>

<div class="overlay">
  <div class="modal">
    <h2>The Covenant</h2>
    <div class="text">
      {#each lines as line}
        <p>{line}</p>
      {/each}
    </div>
    {#if error}<p class="error">{error}</p>{/if}
    <div class="actions">
      <button class="accept" onclick={accept} disabled={busy || lines.length === 0}>
        {busy ? '…' : 'I accept'}
      </button>
    </div>
  </div>
</div>

<style>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: hsl(0 0% 0% / 0.72);
  backdrop-filter: var(--glass-backdrop);
  -webkit-backdrop-filter: var(--glass-backdrop);
  display: grid;
  place-items: center;
  padding: 1.5rem;
}

.modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 2rem;
  max-width: min(30rem, 92vw);
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

h2 {
  font-family: var(--font-display);
  font-size: 1.1rem;
  letter-spacing: 0.2em;
  color: var(--accent);
  text-align: center;
  margin: 0;
}

.text {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  max-width: 42ch;
  margin: 0 auto;
}

.text p {
  font-family: var(--font-display);
  font-size: clamp(0.9rem, 0.84rem + 0.12vw, 1rem);
  line-height: 1.55;
  color: var(--text);
  margin: 0;
  text-wrap: pretty;
}

.actions {
  display: flex;
  justify-content: center;
}

.accept {
  background: var(--accent);
  border: none;
  border-radius: var(--radius);
  color: var(--bg);
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 0.9rem;
  letter-spacing: 0.15em;
  padding: 0.7rem 2.5rem;
  transition: opacity 0.15s;
}
.accept:disabled { opacity: 0.4; cursor: default; }
.error { color: hsl(0, 60%, 65%); font-size: 0.8rem; text-align: center; margin: 0; }
</style>
