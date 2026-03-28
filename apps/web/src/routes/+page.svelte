<script lang="ts">
  import Nebula from '$lib/Nebula.svelte';

  let showInstall = $state(false);

  // Detect platform for install instructions
  const platform = (() => {
    if (typeof navigator === 'undefined') return 'desktop';
    const ua = navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
    if (/android/i.test(ua)) return 'android';
    return 'desktop';
  })();

</script>

<div class="hero">
  <Nebula />
  <a href="/enquire" class="enter"><span class="enter-label">enter</span></a>
</div>

<section class="about">
  <div class="prose">
    <h2>A space, not an app</h2>
    <p>
      Ouracle is a ritual space for reflection. Clea — named for the priestess
      of the Oracle at Delphi — is not here to tell you what you want to hear.
      She listens for the meaning beneath what you say, reflects what you already
      know, and responds with what you need to hear and what you need to do next.
      Nothing scripted. No two sessions alike.
    </p>
  </div>
  <div class="prose">
    <h2>A question. A rite. Return.</h2>
    <p>
      Think of it as a daily game: bring a question, leave with a rite to enact.
      Speak or type — Clea prefers your voice. Free to begin, no account needed.
      <button class="install-link" onclick={() => showInstall = true}>Add to your home screen</button>
      and treat it like a practice.
    </p>
  </div>
  <div class="prose">
    <h2>From here to the next octave</h2>
    <p>
      For when advice isn't enough. For when you already know the answer but haven't
      said it aloud yet. Clea draws on healing modalities and wisdom traditions
      worldwide — including dozens of divination decks by <a href="https://howstrangeitistobeanythingatall.com" target="_blank" rel="noopener">Alan Botts</a>. She guides you
      one rite at a time, and keeps an encrypted record of the journey in your Totem.
    </p>
  </div>
  <div class="prose">
    <h2>Drawn from everywhere. Bound to nothing.</h2>
    <p>
      Ouracle draws from wisdom traditions across cultures and throughout human
      history. It is not a faith, not therapy, not a diagnosis. It's a safe ritual
      frame that meets you exactly where you are — and asks only: what is the next
      right thing?
    </p>
  </div>
</section>

{#if showInstall}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="install-backdrop" role="dialog" aria-modal="true" onclick={() => showInstall = false} onkeydown={(e) => e.key === 'Escape' && (showInstall = false)}>
    <div class="install-modal" onclick={(e) => e.stopPropagation()}>
      <button class="install-close" onclick={() => showInstall = false} aria-label="Close">✕</button>
      <h3>Add Ouracle to your home screen</h3>

      {#if platform === 'ios'}
        <ol>
          <li>Tap the <strong>Share</strong> button <span class="key">⬆︎</span> at the bottom of Safari</li>
          <li>Tap <strong>Add to Home Screen</strong> in the list</li>
          <li>Tap <strong>Add</strong> to confirm</li>
        </ol>
        <p class="install-note">Safari only — Chrome and Firefox on iOS cannot install PWAs.</p>
      {:else if platform === 'android'}
        <ol>
          <li>Tap the <strong>menu</strong> <span class="key">⋮</span> in Chrome</li>
          <li>Tap <strong>Add to Home screen</strong> or <strong>Install app</strong></li>
          <li>Tap <strong>Add</strong> to confirm</li>
        </ol>
      {:else}
        <ol>
          <li>Look for the <strong>install icon</strong> <span class="key">⊕</span> in the address bar</li>
          <li>Or open the browser menu and select <strong>Install Ouracle</strong></li>
          <li>Click <strong>Install</strong> to confirm</li>
        </ol>
        <p class="install-note">Supported in Chrome, Edge, and Arc. Firefox does not support PWA install.</p>
      {/if}
    </div>
  </div>
{/if}

<style>
.hero {
  position: relative;
  height: calc(100dvh - 57px);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  /* Fallback for mobile — Three.js nebula is skipped on touch devices */
  background: var(--bg);
}
/* CSS nebula fallback: visible on touch devices where WebGL is skipped */
@media (pointer: coarse) {
  .hero::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 60% 55% at 52% 48%, hsl(185, 45%, 12%) 0%, transparent 65%),
      radial-gradient(ellipse 40% 40% at 38% 60%, hsl(295, 30%, 10%) 0%, transparent 60%),
      radial-gradient(ellipse 30% 35% at 65% 35%, hsl(38, 40%, 9%) 0%, transparent 55%);
    pointer-events: none;
  }
}
.wordmark {
  font-family: var(--font-display);
  font-size: clamp(3rem, 10vw, 5rem);
  font-weight: 600;
  letter-spacing: 0.3em;
  color: var(--accent);
  line-height: 1;
  /* Soft glow ties the wordmark into the nebula */
  text-shadow: 0 0 48px color-mix(in srgb, var(--accent) 55%, transparent);
}
.tagline {
  font-family: var(--font-display);
  font-size: 1.2rem;
  font-style: italic;
  color: var(--text);
  letter-spacing: 0.1em;
}
.body {
  font-size: 0.95rem;
  line-height: var(--leading);
  color: var(--muted);
  max-width: 420px;
}
.enter {
  display: block;
  border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
  border-radius: 100%;
  color: var(--accent);
  font-family: var(--font-display);
  font-weight: 600;
  font-size: 12vh;
  letter-spacing: 0.2em;
  padding: 0em 2.25rem 0.25em;
  text-decoration: none;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  width: content-fit;
  height: content-fit;
  line-height: 4;
  transition: color 300ms ease-in-out, background 300ms ease-in-out, backdrop-filter 300ms ease-in-out;
  animation: enter-pulse 2.5s ease-in-out infinite;
  mix-blend-mode: color-burn;
  @media (prefers-color-scheme: light) {
      mix-blend-mode: color-dodge;
  }
}
.enter:hover {
  animation: none;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  color: var(--bg);
  border-color: var(--accent);
}
@keyframes enter-pulse {
  0%, 100% {
    transform: scale(1);
    box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 20%, transparent),
                inset 0 0 12px color-mix(in srgb, var(--accent) 8%, transparent);
    border-color: color-mix(in srgb, var(--accent) 55%, transparent);
  }
  50% {
    transform: scale(1.04);
    box-shadow: 0 0 48px color-mix(in srgb, var(--accent) 55%, transparent),
                inset 0 0 24px color-mix(in srgb, var(--accent) 18%, transparent);
    border-color: var(--accent);
  }
}
.about {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-md);
  max-width: var(--max-wide);
  margin: 0 auto;
  padding: var(--space-xl) var(--space-md);
}
@media (max-width: 960px)  { .about { grid-template-columns: 1fr 1fr; } }
@media (max-width: 540px)  { .about { grid-template-columns: 1fr; } }
.install-link {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  padding: 0;
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 3px;
}
.install-link:hover { text-decoration-style: solid; }

.install-backdrop {
  position: fixed;
  inset: 0;
  background: color-mix(in srgb, var(--bg) 60%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.install-modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: calc(var(--radius) * 3);
  max-width: 380px;
  width: 100%;
  padding: 2rem;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.install-close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0.25rem 0.4rem;
  line-height: 1;
  transition: color 0.15s;
}
.install-close:hover { color: var(--text); }

.install-modal h3 {
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 400;
  letter-spacing: 0.06em;
  color: var(--text);
}

.install-modal ol {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding-left: 1.4rem;
}

.install-modal li {
  font-size: 0.88rem;
  line-height: 1.5;
  color: var(--muted);
}

.install-modal li strong { color: var(--text); }

.key {
  display: inline-block;
  background: var(--border);
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 0.75em;
  padding: 0.1em 0.4em;
  color: var(--text);
}

.install-note {
  font-size: 0.72rem;
  color: var(--muted);
  opacity: 0.7;
  font-style: italic;
  margin: 0;
}

.prose h2 {
  font-family: var(--font-display);
  font-size: 1.4rem;
  font-weight: 400;
  margin-bottom: var(--space-sm);
  color: var(--text);
}
.prose p { font-size: 0.95rem; line-height: 1.8; color: var(--muted); }
</style>
