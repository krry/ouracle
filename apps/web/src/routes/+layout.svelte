<script lang="ts">
  import '../app.css';
  import { inject } from '@vercel/analytics';
  import { page } from '$app/stores';
  import { onMount, type Snippet } from 'svelte';
  import Nebula from '$lib/Nebula.svelte';
  import TopBar from '$lib/TopBar.svelte';
  import ControlPanel from '$lib/ControlPanel.svelte';
  import ModalVeil from '$lib/ModalVeil.svelte';
  import CustomVoiceModal from '$lib/CustomVoiceModal.svelte';
  import { creds, seekerState } from '$lib/stores';
  import { initPwa } from '$lib/pwa';

  inject();

  let { children }: { children: Snippet } = $props();

  const isEnquire = $derived(
    $page.url.pathname.startsWith('/draw') ||
    $page.url.pathname.startsWith('/oracle')
  );

  onMount(() => {
    const destroyPwa = initPwa();
    const vv = window.visualViewport;
    let maxViewportHeight = 0;
    const debugKeyboard =
      import.meta.env.DEV &&
      new URLSearchParams(window.location.search).has('debugKeyboard');

    const logKeyboardState = (label: string, extra: Record<string, unknown> = {}) => {
      if (!debugKeyboard) return;
      const appContent = document.querySelector<HTMLElement>('.app-content');
      const scrolling = document.scrollingElement as HTMLElement | null;
      console.debug('[ouracle:keyboard]', {
        label,
        appHeightVar: getComputedStyle(document.documentElement).getPropertyValue('--app-h').trim(),
        innerHeight: window.innerHeight,
        scrollY: window.scrollY,
        visualViewportHeight: vv?.height ?? null,
        visualViewportOffsetTop: vv?.offsetTop ?? null,
        visualViewportPageTop: vv?.pageTop ?? null,
        documentScrollTop: scrolling?.scrollTop ?? null,
        appContentScrollTop: appContent?.scrollTop ?? null,
        activeTag: document.activeElement?.tagName ?? null,
        activeRole: document.activeElement?.getAttribute('role') ?? null,
        ...extra
      });
    };

    let lockingScroll = false;
    let touchY = 0;
    const scrollableSelector = '.msgs.scrollable, .drawer-body, .tp-list, .deck-list, .card-content, .practice-content, .rite-content';

    const lockWindowScroll = () => {
      if (!isEnquire || lockingScroll) return;
      if (window.scrollY === 0) return;
      lockingScroll = true;
      window.scrollTo(0, 0);
      requestAnimationFrame(() => {
        window.scrollTo(0, 0);
        lockingScroll = false;
      });
    };

    const resolveScrollable = (target: EventTarget | null) =>
      target instanceof Element
        ? (target.closest(scrollableSelector) as HTMLElement | null)
        : null;

    const handleTouchStart = (event: TouchEvent) => {
      touchY = event.touches[0]?.clientY ?? 0;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!isEnquire) return;
      const scrollable = resolveScrollable(event.target);
      if (!scrollable) {
        event.preventDefault();
        return;
      }

      if (scrollable.scrollHeight <= scrollable.clientHeight + 1) {
        event.preventDefault();
        return;
      }

      const nextY = event.touches[0]?.clientY ?? touchY;
      const deltaY = nextY - touchY;
      touchY = nextY;

      const atTop = scrollable.scrollTop <= 0;
      const atBottom = scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 1;

      if ((atTop && deltaY > 0) || (atBottom && deltaY < 0)) {
        event.preventDefault();
      }
    };

    const sync = () => {
      const viewportHeight = vv?.height ?? window.innerHeight;
      const viewportTop = vv?.offsetTop ?? 0;
      maxViewportHeight = Math.max(maxViewportHeight, viewportHeight);
      const keyboardOpen = maxViewportHeight - viewportHeight > 120;

      document.documentElement.style.setProperty('--app-h', `${viewportHeight}px`);
      document.documentElement.style.setProperty('--app-vv-top', `${viewportTop}px`);
      document.documentElement.style.setProperty(
        '--input-safe-bottom',
        keyboardOpen ? '0px' : 'env(safe-area-inset-bottom, 0px)'
      );
      lockWindowScroll();
      logKeyboardState('layout-sync', { keyboardOpen, maxViewportHeight });
    };

    sync();
    vv?.addEventListener('resize', sync);
    vv?.addEventListener('scroll', sync);

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      lockWindowScroll();
      logKeyboardState('layout-focusin', {
        targetTag: target?.tagName ?? null,
        targetRole: target?.getAttribute('role') ?? null
      });
    };

    const handleFocusOut = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      logKeyboardState('layout-focusout', {
        targetTag: target?.tagName ?? null,
        targetRole: target?.getAttribute('role') ?? null
      });
    };

    if (debugKeyboard) {
      (window as any).__ouracleKeyboardDebug = logKeyboardState;
      window.addEventListener('focusin', handleFocusIn, true);
      window.addEventListener('focusout', handleFocusOut, true);
      logKeyboardState('layout-mounted');
    }

    if (isEnquire) {
      document.addEventListener('touchstart', handleTouchStart, { passive: true });
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
    }

    return () => {
      destroyPwa();
      vv?.removeEventListener('resize', sync);
      vv?.removeEventListener('scroll', sync);
      if (isEnquire) {
        document.removeEventListener('touchstart', handleTouchStart);
        document.removeEventListener('touchmove', handleTouchMove);
      }
      if (debugKeyboard) {
        window.removeEventListener('focusin', handleFocusIn, true);
        window.removeEventListener('focusout', handleFocusOut, true);
        delete (window as any).__ouracleKeyboardDebug;
      }
    };
  });

  let drawerOpen = $state(false);
  function toggleDrawer() { drawerOpen = !drawerOpen; }
  function closeDrawer() { drawerOpen = false; }

  let voiceModalOpen = $state(false);

  $effect(() => {
    const c = $creds;
    if (c?.handle) seekerState.setPartial({ handle: c.handle });
    else seekerState.setPartial({ handle: null });
  });

  $effect(() => {
    if (typeof document === 'undefined') return;

    document.documentElement.classList.toggle('enquire-open', isEnquire);
    document.body.classList.toggle('enquire-open', isEnquire);

    return () => {
      document.documentElement.classList.remove('enquire-open');
      document.body.classList.remove('enquire-open');
    };
  });
</script>

<svelte:head>
  <title>Ouracle</title>
</svelte:head>

<div class="nebula-backdrop" aria-hidden="true"><Nebula /></div>

<div class="app" class:is-enquire={isEnquire}>
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
      <ControlPanel onclose={closeDrawer} onopencustomvoice={() => voiceModalOpen = true} />
    </div>
  </div>

  <ModalVeil
    active={voiceModalOpen}
    component={CustomVoiceModal}
    close={() => voiceModalOpen = false}
    onclose={() => voiceModalOpen = false}
  />

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

.app.is-enquire {
  position: fixed;
  left: 0;
  right: 0;
  top: var(--app-vv-top, 0px);
  height: var(--app-h, 100dvh);
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
  backdrop-filter: var(--glass-backdrop);
  -webkit-backdrop-filter: var(--glass-backdrop);
}

.drawer {
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  width: min(82vw, 360px);
  background: var(--glass-wash), var(--glass-bg-strong);
  border-right: 1px solid var(--glass-border);
  backdrop-filter: var(--glass-backdrop);
  -webkit-backdrop-filter: var(--glass-backdrop);
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
