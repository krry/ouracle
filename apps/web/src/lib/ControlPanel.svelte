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
    <label class="cp-toggle" title={$ttsEnabled ? "mute Clea's voice" : "enable Clea's voice"}>
      <input type="checkbox" bind:checked={$ttsEnabled} />
      <span class="cp-toggle-icon">〲</span>
      <span>{$ttsEnabled ? 'voice on' : 'voice off'}</span>
    </label>
    <label class="cp-field">
      <span class="cp-label">voiceprint</span>
      <select
        class="cp-select"
        value={$ttsVoice}
        onchange={(e) => ttsVoice.set((e.target as HTMLSelectElement).value)}
        aria-label="Clea's voice"
      >
        {#each TTS_VOICES as v}
          <option value={v.id}>{v.label}</option>
        {/each}
      </select>
    </label>
  </div>

  <div class="cp-block glass-block">
    <div class="cp-kicker">Ambience</div>
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

.cp-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  width: fit-content;
  cursor: pointer;
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  font-weight: 500;
  text-transform: lowercase;
}

.cp-toggle input { display: none; }
.cp-toggle:has(input:checked) { color: var(--accent); }

.cp-toggle-icon {
  display: grid;
  place-items: center;
  width: 2rem;
  height: 2rem;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 75%, transparent);
}

.cp-field {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.cp-label {
  font-family: var(--font-mono);
  font-size: 0.58rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 300;
}

.cp-select {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--surface) 82%, transparent);
  color: var(--text);
  font: inherit;
  padding: 0.6rem 0.75rem;
}

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
