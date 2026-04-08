<script lang="ts">
  import '../app.css';
  import { inject } from '@vercel/analytics';
  import { page } from '$app/stores';
  import { onMount, type Snippet } from 'svelte';
  import Nebula from '$lib/Nebula.svelte';
  import TopBar from '$lib/TopBar.svelte';
  import ControlPanel from '$lib/ControlPanel.svelte';
  import { creds, seekerState } from '$lib/stores';
  import { initPwa } from '$lib/pwa';

  inject();

  let { children }: { children: Snippet } = $props();

  onMount(() => {
    const destroyPwa = initPwa();
    const vv = window.visualViewport;
    const sync = () => {
      document.documentElement.style.setProperty('--app-h', `${vv?.height ?? window.innerHeight}px`);
    };

    sync();
    vv?.addEventListener('resize', sync);
    vv?.addEventListener('scroll', sync);

    return () => {
      destroyPwa();
      vv?.removeEventListener('resize', sync);
      vv?.removeEventListener('scroll', sync);
    };
  });

  const isEnquire = $derived($page.url.pathname.startsWith('/enquire'));

  let drawerOpen = $state(false);
  function toggleDrawer() { drawerOpen = !drawerOpen; }
  function closeDrawer() { drawerOpen = false; }

  $effect(() => {
    const c = $creds;
    if (c?.handle) seekerState.setPartial({ handle: c.handle });
    else seekerState.setPartial({ handle: null });
  });
</script>

<svelte:head>
  <title>Ouracle</title>
</svelte:head>

<div class="nebula-backdrop" aria-hidden="true"><Nebula /></div>

<div class="app">
  <TopBar {drawerOpen} ontoggle={toggleDrawer} />

  {#if drawerOpen}
    <div
      class="backdrop"
      role="presentation"
      onclick={closeDrawer}
      onkeydown={(e) => e.key === 'Escape' && closeDrawer()}
    ></div>
  {/if}

  <div class="drawer" class:open={drawerOpen} aria-hidden={!drawerOpen}>
    <div class="drawer-header">
      <a href="/" class="drawer-wordmark" onclick={closeDrawer}>Ouracle</a>
      <button class="drawer-close" onclick={closeDrawer} aria-label="Close menu">✕</button>
    </div>

    <div class="drawer-body">
      <ControlPanel onclose={closeDrawer} />
    </div>
  </div>

  <main class="app-content">
    {@render children()}
    {#if !isEnquire}
      <footer>
        <span><span class="flip-x">©</span> 2026 <a href="https://kerry.ink">kerry.ink</a></span>
      </footer>
      <webring-widget
        data-source="https://kerry.ink/widgets/webring/webring.json"
        theme="auto"
      ></webring-widget>
    {/if}
  </main>
</div>

<style>
.nebula-backdrop {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: -1;
  opacity: 0.9;
}

.app {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  height: var(--app-h, 100dvh);
  overflow: hidden;
}

.app-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.backdrop {
  position: fixed;
  inset: 0;
  z-index: 38;
  background: color-mix(in srgb, var(--bg) 56%, transparent);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
}

.drawer {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: min(82vw, 360px);
  background: var(--glass-wash), var(--glass-bg-strong);
  border-right: 1px solid var(--glass-border);
  backdrop-filter: blur(calc(var(--glass-blur) + 2px)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(calc(var(--glass-blur) + 2px)) saturate(var(--glass-saturate));
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
  font-weight: 600;
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

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

footer {
  display: flex;
  justify-content: flex-end;
  width: 100%;
  padding: var(--space-xs) var(--space-sm);
  font-size: 0.75rem;
  color: var(--muted);
  flex-shrink: 0;
}

footer a { color: var(--muted); }

.flip-x {
  display: inline-block;
  transform: rotateY(180deg);
}
</style>
