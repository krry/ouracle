<script lang="ts">
  import { randomQuip } from './guestSession';

  let { onsignin }: { onsignin: () => void } = $props();
  const quip = randomQuip();

  function handleClose() {
    onsignin();
  }
</script>

<div class="veil" role="dialog" aria-modal="true" aria-label="guest limit reached">
  <div class="inner">
    <button class="close-btn" onclick={handleClose} aria-label="Sign in">✕</button>
    <p class="quip">{quip}</p>
    <button onclick={onsignin}>enter the temple</button>
    <p class="sub">or close this tab and carry the questions with you</p>
  </div>
</div>

<style>
.veil {
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--bg) 15%, transparent);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  animation: fadein-unblur 0.6s ease both;
}

@keyframes fadein-unblur {
  from {
    opacity: 0;
    backdrop-filter: blur(40px) saturate(180%);
    -webkit-backdrop-filter: blur(40px) saturate(180%);
  }
  to {
    opacity: 1;
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
  }
}

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
