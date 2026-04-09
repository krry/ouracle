<script lang="ts">
  import { controlPanelRouteById } from '$lib/ControlPanel.svelte';
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

<div class="home-shell">
  <section class="hero thin-material">
    <div class="hero-copy">
      <p class="hero-kicker">A vital one-a-day</p>
      <h1>Contemplation in Motion</h1>
      <p class="hero-text">
        Enter, enquire, question and answer, the priestess will listen, the ouracle speaks. You complete the rite and return again.
      </p>
    </div>
    <a href={controlPanelRouteById.draw.href} class="enter"><span class="enter-label">enter</span></a>
  </section>

  <section class="about">
    <div class="prose thin-material">
    <h2>A space, not an app</h2>
    <p>
      Ouracle is a ritual space for reflection. Clea — named for the priestess of the Oracle at Delphi — is not here to tell you what you want to hear. She listens for the meaning beneath what you say, reflects what you already know, and responds with what you need to hear and what you need to do next. Nothing scripted. No two sessions alike.
    </p>
    </div>
    <div class="prose thin-material">
    <h2>A question. A rite. Return.</h2>
    <p>
      Think of it as a daily game: bring a question, leave with a rite to enact. Speak or type — Clea prefers your voice. Free to begin, no account needed. <button class="install-link" onclick={() => showInstall = true}>Add to your home screen</button> and treat it like a practice.
    </p>
    </div>
    <div class="prose thin-material">
    <h2>From here to the next octave</h2>
    <p>
      For when advice isn't enough. For when you already know the answer but haven't said it aloud yet. Clea draws on healing modalities and wisdom traditions worldwide — including dozens of divination decks by <a href="https://howstrangeitistobeanythingatall.com" target="_blank" rel="noopener">Alan Botts</a>. She guides you one rite at a time, and keeps an encrypted record of the journey in your Totem.
    </p>
    </div>
    <div class="prose thin-material">
    <h2>Drawn from everywhere. Bound to nothing.</h2>
    <p>
      Ouracle draws from wisdom traditions across cultures and throughout human history and modernity. It is not a faith, not therapy, not a diagnosis. It's a safe ritual frame that meets you exactly where you are — and asks only: what is the next right thing?
    </p>
    </div>
  </section>
</div>

{#if showInstall}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="install-backdrop" role="dialog" aria-modal="true" tabindex="-1" onclick={() => showInstall = false} onkeydown={(e) => e.key === 'Escape' && (showInstall = false)}>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="install-modal" role="document" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.stopPropagation()}>
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
.home-shell {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  padding: clamp(1rem, 2vw, 1.5rem);
  padding-bottom: calc(var(--space-lg) + 3rem);
}
.hero {
  position: relative;
  min-height: calc(100dvh - var(--topbar-h, 57px) - 1.5rem);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: clamp(2rem, 6vw, 6rem);
  overflow: hidden;
  border-radius: 28px;
  padding: clamp(2rem, 5vw, 4rem);
}
.hero-copy {
  display: flex;
  flex-direction: column;
  order: 2;
  gap: 1rem;
  max-width: 32rem;
}
.hero-kicker {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.26em;
  text-transform: uppercase;
  color: var(--accent);
}
.hero h1 {
  font-family: var(--font-display);
  font-size: clamp(2.326rem, 7vw, 5.6rem);
  font-weight: 500;
  line-height: 0.96;
  letter-spacing: -0.03em;
  max-width: 12ch;
}
.hero-text {
  max-width: 26rem;
  font-size: clamp(1rem, 1.8vw, 1.2rem);
  line-height: 1.7;
  color: color-mix(in srgb, var(--text) 72%, var(--muted));
}
.enter {
  order: 1;
  display: grid;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
  border-radius: 100%;
  color: var(--accent);
  font-family: var(--font-display);
  font-weight: 600;
  font-size: clamp(3rem, 9vw, 6rem);
  letter-spacing: 0.2em;
  padding: 0 2.25rem 0.2em;
  text-decoration: none;
  background: color-mix(in srgb, var(--glass-bg-strong) 85%, transparent);
  min-width: clamp(12rem, 28vw, 18rem);
  aspect-ratio: 1;
  line-height: 1;
  box-shadow: inset 0 1px 0 hsl(0 0% 100% / 0.18);
  transition: color 300ms ease-in-out, background 300ms ease-in-out, backdrop-filter 300ms ease-in-out, transform 300ms ease-in-out;
  animation: enter-pulse 2.5s ease-in-out infinite;
  backdrop-filter: blur(calc(var(--glass-blur) + 2px)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(calc(var(--glass-blur) + 2px)) saturate(var(--glass-saturate));
}
.enter:hover {
  animation: none;
  transform: translateY(-2px) scale(1.02);
  color: var(--text);
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
  max-width: min(1120px, 100%);
  margin: 0 auto;
}
@media (max-width: 960px)  { .about { grid-template-columns: 1fr; } }
@media (max-width: 540px)  { .about { grid-template-columns: 1fr; } }
.prose {
  border-radius: 24px;
  padding: clamp(1.25rem, 2vw, 1.75rem);
}
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
  background: var(--glass-wash), var(--glass-bg-strong);
  border: 1px solid var(--glass-border);
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
.prose a { color: var(--accent); }

@media (max-width: 820px) {
  .hero {
    min-height: auto;
    flex-direction: column;
    align-items: flex-start;
  }

  .enter {
    min-width: 11rem;
    align-self: center;
  }
}
</style>
