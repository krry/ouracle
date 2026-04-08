<script lang="ts">
  import OraclePanel from './OraclePanel.svelte';
  import SeekerStatusPanel from './SeekerStatusPanel.svelte';
  import ThreadsPanel from './ThreadsPanel.svelte';
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
  let collapsed = $state(false);

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'decks', label: 'Decks' },
    { id: 'seeker', label: 'Seeker' },
    { id: 'threads', label: 'Threads' }
  ];

  $effect(() => {
    onCollapseChange(collapsed);
  });
</script>

<aside class="seeker-rail" class:collapsed>
  <button
    class="sp-collapse glass-block focus-ring-contained"
    class:collapsed={collapsed}
    onclick={() => (collapsed = !collapsed)}
    aria-label={collapsed ? 'Expand seeker panel' : 'Collapse seeker panel'}
    title={collapsed ? 'Expand seeker panel' : 'Collapse seeker panel'}
  >
    <span class="sp-collapse-chevron" class:collapsed={collapsed}>⟨</span>
  </button>

  <section class="sp-shell" class:collapsed>
    <div class="sp-tabs-wrap rail-shell">
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
        </div>
      {:else}
        <div class="sp-pane">
          <ThreadsPanel />
        </div>
      {/if}
    </div>
  </section>
</aside>

<style>
.seeker-rail {
  position: relative;
  height: 100%;
  display: flex;
  align-items: stretch;
  width: 100%;
  overflow: visible;
}

.sp-collapse {
  position: absolute;
  left: -3.75ch;
  top: 50%;
  transform: translateY(-50%);
  width: 1.25rem;
  height: 4.1rem;
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
}

.sp-collapse.collapsed {
  left: -0.5ch;
}


@media (max-width: 640px) {
  .sp-collapse {
    left: -0.5ch;
    &.collapsed {
      left: 0;
    }
  }
}

.sp-collapse-chevron {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 1rem;
  line-height: 1;
  transform: translateX(-2px) rotateY(180deg);
  transition: transform 0.36s ease;
}

.sp-collapse-chevron.collapsed {
  transform: translateX(-2px) rotateY(0deg);
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
  opacity: 0;
  transform: translateX(0.8rem);
  pointer-events: none;
}

.sp-tabs-wrap {
  padding: 0.5rem;
  flex: 0 0 auto;
  overflow: visible;
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
  }

  .sp-tabs::-webkit-scrollbar {
    display: none;
  }
}
</style>
