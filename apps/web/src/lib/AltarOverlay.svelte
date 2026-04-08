<script lang="ts">
  import { randomQuip } from './guestSession';

  let { onsignin, ondismiss }: { onsignin: () => void; ondismiss: () => void } = $props();
  const quip = randomQuip();
</script>

<div class="inner">
  <button class="close-btn" onclick={ondismiss} aria-label="Close">✕</button>
  <p class="quip">{quip}</p>
  <button onclick={onsignin}>sign in to continue</button>
  <p class="sub">or back away and carry the mystery with you</p>
</div>

<style>
.inner {
  max-width: 380px;
  padding: 2.5rem 2rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  position: relative;
}

.close-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 1.2rem;
  line-height: 1;
  padding: 0.3rem;
  transition: color 0.15s;
}
.close-btn:hover { color: var(--text); }

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
  letter-spacing: 0.05em;
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
