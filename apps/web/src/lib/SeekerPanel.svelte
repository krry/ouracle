<script lang="ts">
  import { browser } from '$app/environment';
  import OraclePanel from './OraclePanel.svelte';
  import SeekerStatusPanel from './SeekerStatusPanel.svelte';
  import ThreadsPanel from './ThreadsPanel.svelte';
  import { authed, activeRite, pendingRite } from './stores';
  import { controlPanelRouteById } from './ControlPanel.svelte';
  import type { CardData, RiteData } from './stores';

  type DeckMeta = { id: string; meta: { name?: string; description?: string }; count: number };
  type TabId = 'decks' | 'seeker' | 'threads';

  let {
    availableDecks = [],
    selectedDecks = new Set<string>(),
    onDeckToggle,
    onDrawCard,
    onInterpretCard,
    onAcceptRite,
    onDiscussPractice,
    drawing = false,
    streaming = false,
    onCollapseChange = () => {}
  }: {
    availableDecks: DeckMeta[];
    selectedDecks: Set<string>;
    onDeckToggle: (id: string, checked: boolean) => void;
    onDrawCard: () => void;
    onInterpretCard: (card: CardData) => void;
    onAcceptRite: (rite: RiteData) => void;
    onDiscussPractice: (card: CardData) => void;
    drawing?: boolean;
    streaming?: boolean;
    onCollapseChange?: (collapsed: boolean) => void;
  } = $props();

  let activeTab = $state<TabId>('decks');
  let collapsed = $state(browser ? window.matchMedia('(max-width: 639px)').matches : false);
  let hadVisibleRite = $state(false);

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'decks', label: 'Decks' },
    { id: 'seeker', label: 'Seeker' },
    { id: 'threads', label: 'Threads' }
  ];

  $effect(() => {
    onCollapseChange(collapsed);
  });

  $effect(() => {
    const hasVisibleRite = !!$activeRite || !!$pendingRite;
    if (hasVisibleRite && !hadVisibleRite) {
      activeTab = 'decks';
      collapsed = false;
    }
    hadVisibleRite = hasVisibleRite;
  });
</script>

<aside class="seeker-rail" class:collapsed>
  <section class="sp-shell" class:collapsed>
    <div class="sp-tabs-wrap rail-shell" class:collapsed={collapsed}>
      <button
        class="sp-collapse rail-shell focus-ring-contained"
        class:collapsed={collapsed}
        onclick={() => (collapsed = !collapsed)}
        aria-label={collapsed ? 'Expand seeker panel' : 'Collapse seeker panel'}
        title={collapsed ? 'Expand seeker panel' : 'Collapse seeker panel'}
      >
        <span class="sp-collapse-glyphs" class:collapsed={collapsed}>
          <span class="sp-collapse-ankh">☥</span>
          <span class="sp-collapse-chevron" class:collapsed={collapsed}>⟨</span>
        </span>
      </button>

      <div class="sp-tabs">
        {#each tabs as tab}
          <button
            class="sp-tab focus-ring-contained"
            class:active={tab.id === activeTab}
            onclick={() => (activeTab = tab.id)}
            aria-pressed={tab.id === activeTab}
          >
            {tab.label}
          </button>
        {/each}
      </div>
    </div>

    <div class="sp-body">
      {#if activeTab === 'decks'}
        <OraclePanel
          {availableDecks}
          {selectedDecks}
          {onDeckToggle}
          {onDrawCard}
          {onInterpretCard}
          {onAcceptRite}
          {onDiscussPractice}
          {drawing}
          {streaming}
        />
      {:else if activeTab === 'seeker'}
        <div class="sp-pane rail-shell">
          <div class="sp-pane-header">
            <div class="sp-kicker">Seeker</div>
            <h3>Current state</h3>
          </div>
          <SeekerStatusPanel variant="expanded" />
          {#if !$authed}
            <div class="sp-pane-actions">
              <a href={`${controlPanelRouteById.draw.href}?signin=1`} class="sp-pane-action focus-ring-contained">sign in</a>
            </div>
          {/if}
        </div>
      {:else}
        <div class="sp-pane">
          <ThreadsPanel />
        </div>
      {/if}
    </div>
  </section>
</aside>

<style lang="postcss">
.seeker-rail {
  --sp-tabs-shell-h: 3.2rem;
  position: relative;
  height: 100%;
  display: flex;
  align-items: stretch;
  width: 100%;
  overflow: visible;
}

.sp-collapse {
  position: static;
  transform: none;
  width: 2rem;
  min-width: 2rem;
  height: 2.2rem;
  border-radius: 999px;
  border: 1px solid var(--glass-border);
  display: grid;
  place-items: center;
  cursor: pointer;
  color: var(--muted);
  flex: 0 0 auto;
  z-index: 3;
  transition:
    transform 0.382s ease,
    opacity 0.32s ease,
    background 0.32s ease,
    border-color 0.32s ease;
  margin-right: 0.35rem;
  background: color-mix(in srgb, var(--glass) 85%, transparent);
}

.sp-collapse-glyphs {
  position: relative;
  display: inline-block;
  width: 1.35rem;
  height: 1rem;
}

.sp-collapse-ankh,
.sp-collapse-chevron {
  position: absolute;
  top: 50%;
  left: 0.12rem;
  display: grid;
  place-items: center;
  font-family: var(--font-mono);
  font-size: 0.92rem;
  line-height: 1;
  transition:
    left 0.28s ease,
    transform 0.36s ease;
}

.sp-collapse-ankh {
  left: 0.12rem;
  transform: translate(-2px, -50%);
}

.sp-collapse-chevron {
  left: 0.72rem;
  transform: translate(-2px, -50%) rotateY(180deg);
}

.sp-collapse-glyphs.collapsed .sp-collapse-ankh {
  left: 0.72rem;
}

.sp-collapse-glyphs.collapsed .sp-collapse-chevron {
  left: 0.12rem;
}

.sp-collapse-chevron.collapsed {
  transform: translate(-2px, -50%) rotateY(0deg);
}

.sp-shell {
  min-width: 0;
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.5em;
  overflow: visible;
  transform-origin: right center;
  transition:
    opacity 0.32s ease,
    transform 0.382s ease;
}

.sp-shell.collapsed {
  opacity: 1;
  transform: none;
}

.sp-shell.collapsed .sp-tabs {
  opacity: 0;
  pointer-events: none;
}

.sp-shell.collapsed .sp-body {
  display: none;
}

.sp-tabs-wrap {
  min-height: var(--sp-tabs-shell-h);
  padding: 0.4rem;
  flex: 0 0 auto;
  overflow: visible;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.sp-tabs-wrap.collapsed {
  min-height: 0;
  padding: 0;
  border-color: transparent;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
}

.sp-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.45rem;
  width: 100%;
  overflow: visible;
}

.sp-tab {
  width: 100%;
  min-height: 2.2rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 0.67rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: lowercase;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  position: relative;
  z-index: 0;
}

.sp-tab:focus-visible {
  z-index: 1;
}

.sp-pane-actions {
  margin-top: auto;
  padding-top: 0.75rem;
  display: flex;
  justify-content: flex-start;
}

.sp-pane-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.1rem;
  padding: 0.5rem 0.95rem;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--accent) 42%, var(--glass-border));
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
  text-decoration: none;
  font-family: var(--font-mono);
  font-size: 0.67rem;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: lowercase;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
}

.sp-pane-action:hover {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  border-color: color-mix(in srgb, var(--accent) 60%, var(--glass-border));
}

.sp-tab.active,
.sp-tab:hover {
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 28%, transparent);
}

.sp-body {
  min-height: 0;
  flex: 1;
  display: flex;
  overflow: visible;
}

.sp-pane {
  width: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 1rem;
}

.sp-pane-header {
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
}

.sp-kicker {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 300;
}

.sp-pane-header h3 {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.84rem;
  font-weight: 500;
  letter-spacing: 0.03em;
  color: var(--text);
  text-transform: lowercase;
}

@media (max-width: 640px) {
  .seeker-rail {
    width: 100%;
  }

  .sp-shell {
    gap: 0.5rem;
  }

  .sp-tabs {
    overflow-x: auto;
    scrollbar-width: none;
    grid-template-columns: repeat(3, minmax(max-content, 1fr));
    padding-right: 0.15rem;
  }

  .sp-shell.collapsed .sp-tabs {
    display: none;
  }

  .sp-tabs::-webkit-scrollbar {
    display: none;
  }
}
</style>
