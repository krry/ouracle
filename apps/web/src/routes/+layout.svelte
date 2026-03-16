<script lang="ts">
  import '../app.css';
  import { inject } from '@vercel/analytics';
  import { page } from '$app/stores';
  import type { Snippet } from 'svelte';

  inject();

  let { children }: { children: Snippet } = $props();
  const isChat = $derived($page.url.pathname.startsWith('/chat'));

  let menuOpen = $state(false);
  function toggleMenu() { menuOpen = !menuOpen; }
  function closeMenu() { menuOpen = false; }
</script>

{#if !isChat}
  <nav>
    <a href="/" class="wordmark" onclick={closeMenu}>Ouracle</a>
    <div class="links">
      <a href="/clea">Clea</a>
      <a href="/ripl">ripl</a>
      <a href="/diy">D.I.Y.</a>
      <a href="/chat" class="cta">enter</a>
    </div>
    <button class="hamburger" onclick={toggleMenu} aria-label="Menu" aria-expanded={menuOpen}>
      <span class:open={menuOpen}></span>
      <span class:open={menuOpen}></span>
      <span class:open={menuOpen}></span>
    </button>
  </nav>

  {#if menuOpen}
    <div class="backdrop" role="presentation" onclick={closeMenu} onkeydown={closeMenu}></div>
  {/if}

  <div class="drawer" class:open={menuOpen}>
    <a href="/clea" onclick={closeMenu}>Clea</a>
    <a href="/ripl" onclick={closeMenu}>ripl</a>
    <a href="/diy" onclick={closeMenu}>D.I.Y.</a>
    <a href="/chat" class="cta" onclick={closeMenu}>enter</a>
  </div>
{/if}

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
nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  background: var(--bg);
  z-index: 20;
}
.wordmark {
  font-family: var(--font-display);
  font-size: 1.2rem;
  letter-spacing: 0.2em;
  color: var(--accent);
  text-decoration: none;
}
.links {
  display: flex;
  gap: var(--space-md);
  align-items: center;
  font-size: 0.85rem;
  letter-spacing: 0.1em;
}
.links a { color: var(--muted); text-decoration: none; transition: color 0.15s; }
.links a:hover { color: var(--text); }
.cta {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--accent) !important;
  padding: 0.3rem 0.8rem;
}

/* ── Hamburger button ─────────────────────────────────────── */
.hamburger {
  display: none;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  width: 32px;
  height: 32px;
}
.hamburger span {
  display: block;
  width: 100%;
  height: 1px;
  background: var(--muted);
  transform-origin: center;
  transition: transform 0.22s ease, opacity 0.22s ease, background 0.15s;
}
.hamburger:hover span { background: var(--text); }
/* X morphing */
.hamburger span:nth-child(1).open { transform: translateY(6px) rotate(45deg); }
.hamburger span:nth-child(2).open { opacity: 0; transform: scaleX(0); }
.hamburger span:nth-child(3).open { transform: translateY(-6px) rotate(-45deg); }

/* ── Mobile drawer ────────────────────────────────────────── */
.backdrop {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 18;
  background: hsl(0 0% 0% / 0.4);
  backdrop-filter: blur(2px);
}
.drawer {
  display: none;
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(72vw, 260px);
  background: var(--surface);
  border-left: 1px solid var(--border);
  z-index: 19;
  flex-direction: column;
  padding: calc(var(--space-xl) * 0.6) var(--space-md) var(--space-md);
  gap: var(--space-sm);
  transform: translateX(100%);
  transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}
.drawer a {
  font-family: var(--font-display);
  font-size: 1.15rem;
  letter-spacing: 0.08em;
  color: var(--muted);
  text-decoration: none;
  padding: 0.4rem 0;
  border-bottom: 1px solid var(--border);
  transition: color 0.15s;
}
.drawer a:hover { color: var(--text); }
.drawer .cta {
  margin-top: var(--space-sm);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--accent) !important;
  padding: 0.5rem 1rem;
  text-align: center;
}
.drawer.open { transform: translateX(0); }

@media (max-width: 600px) {
  .links { display: none; }
  .hamburger { display: flex; }
  .backdrop { display: block; }
  .drawer { display: flex; }
}

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
