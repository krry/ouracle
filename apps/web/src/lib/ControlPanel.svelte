<script module lang="ts">
  export type ControlPanelRouteId =
    | 'welcome'
    | 'draw'
    | 'oracle'
    | 'records'
    | 'about'
    | 'devs';

  export type ControlPanelRoute = {
    id: ControlPanelRouteId;
    href: string;
    label: string;
    epithet: string;
    icon: string;
    authedOnly?: boolean;
  };

  export const controlPanelNav: ControlPanelRoute[] = [
    { id: 'welcome', href: '/', label: 'Welcome', epithet: 'προπύλαια', icon: '⛶' },
    { id: 'draw', href: '/draw', label: 'Draw', epithet: 'ναός', icon: '✶' },
    { id: 'oracle', href: '/oracle', label: 'Oracle', epithet: 'ἄδυτον', icon: '☉', authedOnly: true },
    { id: 'records', href: '/records', label: 'Records', epithet: 'στοά', icon: '☷', authedOnly: true },
    { id: 'about', href: '/about', label: 'About', epithet: 'ἱέρειαι', icon: '⚭' },
    { id: 'devs', href: '/devs', label: 'Devs', epithet: 'δεῦς', icon: '◈' }
  ];

  export const controlPanelRouteById = Object.fromEntries(
    controlPanelNav.map((route) => [route.id, route])
  ) as Record<ControlPanelRouteId, ControlPanelRoute>;

  export function routeIsActive(pathname: string, href: string): boolean {
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  }
</script>

<script lang="ts">
  import { page } from '$app/stores';
  import AmbientControls from './AmbientControls.svelte';
  import { creds, authed, seekerState, pendingRite, messages, ttsEnabled, ttsVoice } from './stores';
  import { anySoundPlaying, allOff } from './ambientEngine';
  import { TTS_VOICES } from './tts-client';
  import { signOut } from './auth';

  let { onclose = () => {} }: { onclose?: () => void } = $props();

  async function leave() {
    await signOut({ fetchOptions: { onSuccess: () => creds.logout() } });
    creds.logout();
    pendingRite.set(null);
    messages.set([]);
    seekerState.reset();
    onclose();
  }
</script>

<section class="control-panel">
  <div class="cp-block glass-block">
    <div class="cp-kicker">Temple</div>
    <nav class="cp-nav">
      {#each controlPanelNav as item}
        {#if !item.authedOnly || $authed}
          <a
            href={item.href}
            class="cp-link"
            class:active={routeIsActive($page.url.pathname, item.href)}
            onclick={onclose}
          >
            <span class="cp-icon">{item.icon}</span>
            <span class="cp-copy">
              <span class="cp-link-label">{item.label}</span>
              <span class="cp-link-epithet">{item.epithet}</span>
            </span>
          </a>
        {/if}
      {/each}
    </nav>
  </div>

  <div class="cp-block glass-block">
    <div class="cp-kicker">Voice</div>
    <label class="vb-row" class:on={$ttsEnabled} title={$ttsEnabled ? "mute Clea's voice" : "enable Clea's voice"}>
      <input type="checkbox" bind:checked={$ttsEnabled} />
      <span class="vb-icon">〲</span>
      <span class="vb-label">{$ttsEnabled ? 'voice on' : 'voice off'}</span>
    </label>
    <div class="vb-row" class:on={$ttsEnabled}>
      <span class="vb-icon">◈</span>
      <select
        class="vb-select"
        value={$ttsVoice}
        onchange={(e) => ttsVoice.set((e.target as HTMLSelectElement).value)}
        aria-label="Clea's voice"
      >
        {#each TTS_VOICES as v}
          <option value={v.id}>{v.label}</option>
        {/each}
      </select>
    </div>
  </div>

  <div class="cp-block glass-block">
    <button
      class="cp-kicker cp-kicker-btn"
      class:cp-kicker-live={$anySoundPlaying}
      onclick={allOff}
      title={$anySoundPlaying ? 'silence all' : 'ambience'}
    >Ambience</button>
    <AmbientControls />
  </div>

  <div class="cp-block glass-block">
    <div class="cp-kicker">Identity</div>
    {#if $authed && $creds}
      <div class="cp-identity">
        <span class="cp-handle">{$creds.handle ?? 'seeker'}</span>
        <span class="cp-stage">{$creds.stage ?? 'received'}</span>
      </div>
      <button class="cp-action cp-action-muted" onclick={leave}>sign out</button>
    {:else}
      <a href={`${controlPanelRouteById.draw.href}?signin=1`} class="cp-action" onclick={onclose}>sign in</a>
    {/if}
  </div>
</section>

<style>
.control-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.cp-block {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  padding: 0.85rem;
}

.cp-kicker {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 300;
}

.cp-kicker-btn {
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  cursor: pointer;
  text-align: left;
  transition: color 0.2s;
  border-radius: 4px;
}
.cp-kicker-btn:hover { color: color-mix(in srgb, var(--muted) 55%, var(--accent)); }
.cp-kicker-live { color: var(--accent); }

.cp-nav {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.cp-link {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.55rem 0.65rem;
  border-radius: 14px;
  color: var(--text);
  text-decoration: none;
  background: color-mix(in srgb, var(--surface) 72%, transparent);
  transition: background 0.15s ease, color 0.15s ease;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  font-weight: 500;
  text-transform: lowercase;
}

.cp-copy {
  display: inline-flex;
  align-items: baseline;
  gap: 0.45rem;
  min-width: 0;
}

.cp-link-label {
  min-width: 0;
}

.cp-link-epithet {
  color: color-mix(in srgb, var(--muted) 88%, var(--accent));
  font-size: 0.66rem;
  letter-spacing: 0.03em;
  text-transform: none;
  font-weight: 400;
}

.cp-link:hover,
.cp-link.active {
  background: color-mix(in srgb, var(--accent) 18%, var(--surface));
  color: var(--accent);
}

.cp-icon {
  width: 1.2rem;
  text-align: center;
}

.vb-row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.15rem 0.4rem;
  margin: 0 -0.4rem;
  border-radius: 999px;
  cursor: pointer;
  color: var(--muted);
  transition: color 0.15s;
  width: calc(100% + 0.8rem);
}
.vb-row:hover { color: color-mix(in srgb, var(--muted) 60%, var(--accent)); }
.vb-row.on { color: var(--accent); }
.vb-row input[type="checkbox"] { display: none; }

.vb-icon {
  width: 1.1rem;
  flex-shrink: 0;
  text-align: center;
  font-size: 0.8rem;
  line-height: 1;
}

.vb-label {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  font-weight: 500;
  text-transform: lowercase;
}

.vb-select {
  appearance: none;
  -webkit-appearance: none;
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  font-weight: 500;
  text-transform: lowercase;
  color: inherit;
  border-radius: 999px;
  outline-offset: 3px;
}
.vb-select option { background: var(--bg); color: var(--text); }

.cp-identity {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.cp-handle {
  font-family: var(--font-mono);
  font-size: 0.88rem;
  color: var(--accent);
  letter-spacing: 0.04em;
}

.cp-stage {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 300;
}

.cp-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  min-width: 6.5rem;
  padding: 0.5rem 0.85rem;
  border-radius: 999px;
  border: 1px solid var(--accent);
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--accent);
  text-decoration: none;
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  text-transform: lowercase;
  font-weight: 500;
}

.cp-action:hover {
  background: var(--accent);
  color: var(--bg);
}

.cp-action-muted {
  border-color: var(--border);
  background: color-mix(in srgb, var(--surface) 78%, transparent);
  color: var(--text);
}
</style>
