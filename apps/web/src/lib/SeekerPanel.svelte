<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import OraclePanel from './OraclePanel.svelte';
  import SeekerStatusPanel from './SeekerStatusPanel.svelte';
  import ThreadsPanel from './ThreadsPanel.svelte';
  import { authed, creds, activeRite, pendingRite, seekerState, messages } from './stores';
  import { controlPanelRouteById } from './ControlPanel.svelte';
  import { signOut } from './auth';
  import { updateHandle } from './api';
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
  let editingHandle = $state(false);
  let handleDraft = $state('');
  let handleError = $state('');
  let handleSaving = $state(false);

  const seekerTabLabel = $derived($authed && $seekerState.handle ? $seekerState.handle : 'Seeker');

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: 'decks', label: 'Decks' },
    { id: 'seeker', label: '' },
    { id: 'threads', label: 'Threads' }
  ];

  async function leave() {
    await signOut({ fetchOptions: { onSuccess: () => creds.logout() } });
    creds.logout();
    pendingRite.set(null);
    messages.set([]);
    seekerState.reset();
    goto(controlPanelRouteById.welcome.href);
  }

  function startEditHandle() {
    handleDraft = $seekerState.handle ?? $creds?.handle ?? '';
    handleError = '';
    editingHandle = true;
  }

  async function saveHandle() {
    const token = $creds?.access_token;
    if (!token || !handleDraft.trim()) return;
    handleSaving = true;
    handleError = '';
    try {
      const { handle } = await updateHandle(handleDraft.trim(), token);
      creds.login({ ...$creds!, handle });
      seekerState.setPartial({ handle });
      editingHandle = false;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      handleError = msg.includes('handle_taken') ? 'already taken' : 'could not save';
    } finally {
      handleSaving = false;
    }
  }

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
            {tab.id === 'seeker' ? seekerTabLabel : tab.label}
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
          onclose={() => { collapsed = true; }}
        />
      {:else if activeTab === 'seeker'}
        <div class="sp-pane rail-shell">
          <SeekerStatusPanel variant="expanded" />

          <div class="sp-identity-block">
            {#if $authed && $creds}
              <div class="sp-identity-handle-row">
                {#if editingHandle}
                  <input
                    class="sp-handle-input focus-ring-contained"
                    bind:value={handleDraft}
                    onkeydown={(e) => { if (e.key === 'Enter') saveHandle(); if (e.key === 'Escape') editingHandle = false; }}
                    placeholder="new handle"
                    maxlength={40}
                    autofocus
                  />
                  <button class="sp-handle-btn" onclick={saveHandle} disabled={handleSaving}>
                    {handleSaving ? '…' : 'save'}
                  </button>
                  <button class="sp-handle-btn sp-handle-btn-muted" onclick={() => (editingHandle = false)}>×</button>
                {:else}
                  <span class="sp-handle-display">{$creds.handle ?? 'seeker'}</span>
                  <button class="sp-handle-btn" onclick={startEditHandle}>rename</button>
                {/if}
              </div>
              {#if handleError}
                <span class="sp-handle-error">{handleError}</span>
              {/if}
              <span class="sp-stage">{$creds.stage ?? 'received'}</span>
              <button class="sp-pane-action sp-pane-action-muted" onclick={leave}>sign out</button>
            {:else}
              <a href={`${controlPanelRouteById.draw.href}?signin=1`} class="sp-pane-action focus-ring-contained">sign in</a>
            {/if}
          </div>
        </div>
      {:else}
        <ThreadsPanel />
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
    opacity 0.32s ease,
    background 0.32s ease,
    border-color 0.32s ease,
    margin 0.32s ease;
  background: color-mix(in srgb, var(--glass) 85%, transparent);
}

.sp-collapse.collapsed {
  margin-left: -1rem;
  margin-top: 0.25rem;
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
  padding: 0 0.5em 0 0;
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

.sp-identity-block {
  margin-top: auto;
  padding-top: 0.75rem;
  border-top: 1px solid var(--glass-border);
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.sp-identity-handle-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.sp-handle-display {
  font-family: var(--font-mono);
  font-size: 0.88rem;
  color: var(--accent);
  letter-spacing: 0.04em;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sp-handle-input {
  flex: 1;
  min-width: 0;
  background: color-mix(in srgb, var(--surface) 60%, transparent);
  border: 1px solid var(--glass-border);
  border-radius: 6px;
  padding: 0.3rem 0.5rem;
  font-family: var(--font-mono);
  font-size: 0.82rem;
  color: var(--text);
  outline: none;
}

.sp-handle-input:focus {
  border-color: var(--accent);
}

.sp-handle-btn {
  flex-shrink: 0;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.06em;
  color: color-mix(in srgb, var(--muted) 70%, var(--accent));
  text-decoration: underline;
  text-underline-offset: 2px;
  transition: color 0.15s;
}

.sp-handle-btn:hover:not(:disabled) { color: var(--accent); }
.sp-handle-btn:disabled { opacity: 0.5; cursor: default; }
.sp-handle-btn-muted { color: var(--muted); text-decoration: none; font-size: 0.78rem; }

.sp-handle-error {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  color: hsl(var(--hue-shen), 60%, 55%);
  letter-spacing: 0.04em;
}

.sp-stage {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 300;
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

.sp-pane-action-muted {
  border-color: var(--border);
  background: color-mix(in srgb, var(--surface) 78%, transparent);
  color: var(--text);
  cursor: pointer;
}

.sp-pane-action-muted:hover {
  background: color-mix(in srgb, var(--surface) 90%, transparent);
  border-color: var(--border);
  color: var(--text);
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
  overflow: hidden;
}

.sp-pane {
  width: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  padding: 1rem;
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior-y: contain;
}

.sp-pane-header {
  display: flex;
  flex-direction: column;
  gap: 0;
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

.sp-handle {
  margin-left: 0.7ch;
  color: var(--accent);
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
