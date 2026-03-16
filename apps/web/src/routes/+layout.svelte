<script lang="ts">
  import '../app.css';
  import { inject } from '@vercel/analytics';
  import { page } from '$app/stores';
  import type { Snippet } from 'svelte';
  import AmbientControls from '$lib/AmbientControls.svelte';

  inject();

  let { children }: { children: Snippet } = $props();
  const isChat = $derived($page.url.pathname.startsWith('/chat'));

  let drawerOpen = $state(false);
  function openDrawer()  { drawerOpen = true; }
  function closeDrawer() { drawerOpen = false; }
</script>

{#if !isChat}
  <nav>
    <button class="menu-btn" onclick={openDrawer} aria-label="Open menu" aria-expanded={drawerOpen}>
      <span></span>
      <span></span>
      <span></span>
    </button>

    <a href="/" class="wordmark" onclick={closeDrawer}>Ouracle</a>

    <div class="nav-trail">
      <AmbientControls />
      <a href="/chat" class="enter">enter</a>
    </div>
  </nav>
{/if}

<!-- Drawer backdrop -->
{#if drawerOpen}
  <div
    class="backdrop"
    role="presentation"
    onclick={closeDrawer}
    onkeydown={(e) => e.key === 'Escape' && closeDrawer()}
  ></div>
{/if}

<!-- Left drawer — slides from left on all widths -->
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

  <div class="drawer-footer">
    <a href="/chat" class="drawer-enter" onclick={closeDrawer}>enter</a>
  </div>
</div>

{@render children()}

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

<style>
/* ── Top nav ──────────────────────────────────────────────────────────── */
nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  background: var(--bg);
  z-index: 30;
}

.menu-btn {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
}
.menu-btn span {
  display: block;
  width: 100%;
  height: 1px;
  background: var(--muted);
  transition: background 0.15s;
}
.menu-btn:hover span { background: var(--text); }

.wordmark {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  font-family: var(--font-display);
  font-size: 1.1rem;
  letter-spacing: 0.22em;
  color: var(--accent);
  text-decoration: none;
  white-space: nowrap;
}

.nav-trail {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-left: auto;
}

.enter {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--accent);
  font-family: var(--font-sans);
  font-size: 0.8rem;
  letter-spacing: 0.15em;
  padding: 0.3rem 0.9rem;
  text-decoration: none;
  transition: background 0.15s, color 0.15s;
  white-space: nowrap;
}
.enter:hover { background: var(--accent); color: var(--bg); }

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
  /* safe area: notched phones, Android nav bar */
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.drawer.open { transform: translateX(0); }

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.25rem 1rem;
  border-bottom: 1px solid var(--border);
  /* safe area: iOS status bar / notch */
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
  line-height: 1;
  padding: 0.4rem;
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
  /* min touch target */
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
  display: block;
  text-align: center;
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

/* ── Footer ───────────────────────────────────────────────────────────── */
footer {
  display: flex;
  justify-content: space-between;
  padding: var(--space-md);
  font-size: 0.75rem;
  color: var(--muted);
  border-top: 1px solid var(--border);
}
footer a { color: var(--muted); }
</style>
