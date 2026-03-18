<script lang="ts">
  import '../app.css';
  import { inject } from '@vercel/analytics';
  import { page } from '$app/stores';
  import type { Snippet } from 'svelte';
  import TopBar from '$lib/TopBar.svelte';
  import AmbientControls from '$lib/AmbientControls.svelte';
  import { ttsEnabled, ttsVoice, creds, authed } from '$lib/stores';
  import type { Credentials, TtsVoice } from '$lib/stores';
  import { signOut } from '$lib/auth';

  inject();

  let { children }: { children: Snippet } = $props();
  const isChat = $derived($page.url.pathname.startsWith('/chat'));

  let drawerOpen = $state(false);
  function toggleDrawer() { drawerOpen = !drawerOpen; }
  function closeDrawer() { drawerOpen = false; }

  async function leave() {
    await signOut({ fetchOptions: { onSuccess: () => creds.logout() } });
    creds.logout();
    closeDrawer();
  }
</script>

<div class="app">
  <TopBar {drawerOpen} ontoggle={toggleDrawer} />

  <!-- Drawer backdrop -->
  {#if drawerOpen}
    <div
      class="backdrop"
      role="presentation"
      onclick={closeDrawer}
      onkeydown={(e) => e.key === 'Escape' && closeDrawer()}
    ></div>
  {/if}

  <!-- Left drawer -->
  <div class="drawer" class:open={drawerOpen} aria-hidden={!drawerOpen}>
    <div class="drawer-header">
      <a href="/" class="drawer-wordmark" onclick={closeDrawer}>Ouracle</a>
      <button class="drawer-close" onclick={closeDrawer} aria-label="Close menu">✕</button>
    </div>

    <nav class="drawer-nav">
      <a href="/clea" onclick={closeDrawer}>
        <span class="drawer-icon">⌬</span>
        <span>Clea</span>
      </a>
      <a href="/ripl" onclick={closeDrawer}>
        <span class="drawer-icon">◎</span>
        <span>ripl</span>
      </a>
      <a href="/diy" onclick={closeDrawer}>
        <span class="drawer-icon">◈</span>
        <span>D.I.Y.</span>
      </a>
    </nav>

    <!-- Mobile-only controls: TTS, voice, ambient, identity -->
    <div class="drawer-mobile">
      <hr class="drawer-divider" />

      <div class="drawer-mobile-row">
        <label class="dm-tts-toggle" title={$ttsEnabled ? "mute Clea's voice" : "enable Clea's voice"}>
          <input type="checkbox" bind:checked={$ttsEnabled} />
          <span class="dm-tts-icon">〲</span>
          <span class="dm-label">voice</span>
        </label>
        <select
          class="dm-voice-select"
          value={$ttsVoice}
          onchange={(e) => ttsVoice.set((e.target as HTMLSelectElement).value as TtsVoice)}
          aria-label="Clea's voice"
        >
          <option value="elf">Elf</option>
          <option value="poet">Poet</option>
          <option value="alien">Alien</option>
          <option value="president">President</option>
        </select>
      </div>

      <div class="drawer-mobile-row">
        <AmbientControls />
      </div>

      {#if $authed && $creds}
        <div class="drawer-mobile-row dm-identity">
          {#if ($creds as Credentials | null)?.handle}
            <span class="dm-handle">{($creds as Credentials | null)?.handle}</span>
          {/if}
          <button class="dm-leave" onclick={leave} title="leave">⌁ sign out</button>
        </div>
      {/if}
    </div>

    <div class="drawer-footer">
      <a href="/chat" class="drawer-enter" onclick={closeDrawer}>enter the temple</a>
    </div>
  </div>

  <main class="app-content">
    {@render children()}
  </main>

  {#if !isChat}
    <footer>
      <span>© 2026 <a href="https://kerry.ink">Kerry Alan Snyder</a></span>
    </footer>
    <webring-widget
      data-source="https://kerry.ink/widgets/webring/webring.json"
      mode="compact"
      theme="auto"
      style="position: fixed; bottom: 2rem; right: 2rem; max-width: 320px; z-index: 1000;"
    ></webring-widget>
  {/if}
</div>

<style>
/* ── App shell ────────────────────────────────────────────────────────── */
.app {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  overflow: hidden;
}

.app-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

/* ── Drawer backdrop ──────────────────────────────────────────────────── */
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 38;
  background: hsl(0 0% 0% / 0.5);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
}

/* ── Left drawer ──────────────────────────────────────────────────────── */
.drawer {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: min(76vw, 300px);
  background: var(--surface);
  border-right: 1px solid var(--border);
  z-index: 39;
  display: flex;
  flex-direction: column;
  transform: translateX(-100%);
  transition: transform 0.30s cubic-bezier(0.4, 0, 0.2, 1);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.drawer.open { transform: translateX(0); }

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.25rem 1rem;
  border-bottom: 1px solid var(--border);
  padding-top: max(1.25rem, calc(1.25rem + env(safe-area-inset-top, 0px)));
}

.drawer-wordmark {
  font-family: var(--font-display);
  font-size: 1.1rem;
  letter-spacing: 0.22em;
  color: var(--accent);
  text-decoration: none;
}

.drawer-close {
  background: none;
  border: none;
  color: var(--muted);
  cursor: pointer;
  font-size: 0.9rem;
  min-width: 36px;
  min-height: 36px;
  display: grid;
  place-items: center;
  transition: color 0.15s;
}
.drawer-close:hover { color: var(--text); }

.drawer-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0.75rem 0;
  overflow-y: auto;
}

.drawer-nav a {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.85rem 1.5rem;
  font-family: var(--font-display);
  font-size: 1.05rem;
  letter-spacing: 0.06em;
  color: var(--muted);
  text-decoration: none;
  transition: background 0.12s, color 0.12s;
  min-height: 48px;
}
.drawer-nav a:hover,
.drawer-nav a:focus-visible {
  background: color-mix(in srgb, var(--accent) 6%, transparent);
  color: var(--text);
  outline: none;
}

.drawer-icon {
  font-size: 0.9rem;
  color: var(--accent);
  opacity: 0.7;
  width: 1.2rem;
  text-align: center;
  flex-shrink: 0;
}

.drawer-footer {
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--border);
}

.drawer-enter {
  border: 1px solid var(--accent);
  border-radius: var(--radius);
  color: var(--accent);
  font-family: var(--font-sans);
  font-size: 0.85rem;
  letter-spacing: 0.18em;
  padding: 0.65rem;
  text-decoration: none;
  transition: background 0.15s, color 0.15s;
  min-height: 48px;
  display: grid;
  place-items: center;
}
.drawer-enter:hover { background: var(--accent); color: var(--bg); }

/* ── Drawer mobile controls ───────────────────────────────────────────── */
.drawer-mobile {
  display: none; /* hidden on desktop */
  flex-direction: column;
  gap: 0.5rem;
  padding: 0 1.25rem 0.75rem;
}

@media (max-width: 767px) {
  .drawer-mobile { display: flex; }
}

.drawer-divider {
  border: none;
  border-top: 1px solid var(--border);
  margin: 0.25rem 0;
}

.drawer-mobile-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 40px;
}

.dm-tts-toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  color: var(--muted);
  transition: color 0.15s;
}
.dm-tts-toggle input { display: none; }
.dm-tts-toggle:has(input:checked) { color: var(--accent); }

.dm-tts-icon {
  font-size: 1rem;
  line-height: 1;
}

.dm-label {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  letter-spacing: 0.08em;
}

.dm-voice-select {
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
.dm-voice-select:hover, .dm-voice-select:focus { color: var(--accent); outline: none; }
.dm-voice-select option { background: var(--bg); color: var(--text); }

.dm-identity {
  justify-content: space-between;
}

.dm-handle {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  color: var(--muted);
}

.dm-leave {
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius);
  color: var(--muted);
  cursor: pointer;
  font-family: var(--font-sans);
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  padding: 0.3rem 0.6rem;
  transition: border-color 0.15s, color 0.15s;
  min-height: 32px;
}
.dm-leave:hover { border-color: var(--border); color: var(--text); }

/* ── Footer ───────────────────────────────────────────────────────────── */
footer {
  display: flex;
  justify-content: space-between;
  padding: var(--space-md);
  font-size: 0.75rem;
  color: var(--muted);
  border-top: 1px solid var(--border);
  flex-shrink: 0;
}
footer a { color: var(--muted); }
</style>
