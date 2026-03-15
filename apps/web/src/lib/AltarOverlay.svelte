<script lang="ts">
  import { randomQuip } from './guestSession';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher<{ signin: void }>();
  const quip = randomQuip();
</script>

<div class="veil" role="dialog" aria-modal="true" aria-label="session ended">
  <div class="inner">
    <p class="quip">{quip}</p>
    <button onclick={() => dispatch('signin')}>enter your name</button>
    <p class="sub">or close this tab and carry the questions with you</p>
  </div>
</div>

<style>
.veil {
  position: fixed;
  inset: 0;
  background: hsla(217, 12%, 5%, 0.88);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  animation: fadein 0.6s ease both;
}

@keyframes fadein { from { opacity: 0 } to { opacity: 1 } }

.inner {
  max-width: 380px;
  padding: 2.5rem 2rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.quip {
  color: var(--text);
  font-size: 1rem;
  line-height: 1.7;
  font-style: italic;
}

button {
  background: var(--accent);
  border: none;
  border-radius: var(--radius);
  color: var(--bg);
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 0.9rem;
  letter-spacing: 0.1em;
  padding: 0.75rem 1.5rem;
  transition: opacity 0.15s;
}

button:hover { opacity: 0.85; }

.sub {
  color: var(--muted);
  font-size: 0.75rem;
  line-height: 1.5;
}
</style>
