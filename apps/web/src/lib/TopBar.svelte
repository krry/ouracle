<script lang="ts">
  import { page } from '$app/stores';
  import { creds, authed } from './stores';
  import type { Credentials } from './stores';
  import { signOut } from './auth';
  import AmbientControls from './AmbientControls.svelte';

  let { drawerOpen, ontoggle }: { drawerOpen: boolean; ontoggle: () => void } = $props();

  const isChat = $derived($page.url.pathname.startsWith('/chat'));

  async function leave() {
    await signOut({ fetchOptions: { onSuccess: () => creds.logout() } });
    creds.logout();
  }
</script>

<header class="topbar">
  <button
    class="menu-btn"
    onclick={ontoggle}
    aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
    aria-expanded={drawerOpen}
  >
    <span class:open={drawerOpen}></span>
    <span class:open={drawerOpen}></span>
    <span class:open={drawerOpen}></span>
  </button>

  <a href="/" class="wordmark">Ouracle</a>

  <div class="trail">
    <div class="ambient-wrap"><AmbientControls /></div>
    {#if isChat && $authed && $creds}
      <div class="identity">
        {#if ($creds as Credentials | null)?.handle}
          <span class="handle">{($creds as Credentials | null)?.handle}</span>
        {/if}
        <button class="leave" onclick={leave} title="leave">⌁</button>
      </div>
    {:else if !isChat}
      <a href="/chat" class="enter">enter the temple</a>
    {/if}
  </div>
</header>

<style>
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 1rem;
  border-bottom: 1px solid var(--border);
  background: var(--bg);
  position: sticky;
  top: 0;
  z-index: 30;
  height: var(--topbar-h, 57px);
  box-sizing: border-box;
}

/* Hamburger */
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
  transform-origin: center;
  transition: transform 0.22s ease, opacity 0.22s ease, background 0.15s;
}
.menu-btn:hover span { background: var(--text); }
.menu-btn span:nth-child(1).open { transform: translateY(6px) rotate(45deg); }
.menu-btn span:nth-child(2).open { opacity: 0; transform: scaleX(0); }
.menu-btn span:nth-child(3).open { transform: translateY(-6px) rotate(-45deg); }

/* Centered wordmark */
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
  transition: opacity 0.15s;
}
.wordmark:hover { opacity: 0.75; }

/* Trailing right side */
.trail {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-left: auto;
}

.identity {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.handle {
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.08em;
  color: var(--muted);
}

.leave {
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius);
  color: var(--muted);
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0.25rem 0.45rem;
  transition: border-color 0.15s, color 0.15s;
  min-height: 32px;
  display: grid;
  place-items: center;
}
.leave:hover { border-color: var(--border); color: var(--text); }

@media (max-width: 767px) {
  .ambient-wrap { display: none; }
  .identity { display: none; }
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
</style>
