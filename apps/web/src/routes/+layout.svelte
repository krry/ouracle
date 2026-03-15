<script lang="ts">
  import '../app.css';
  import { inject } from '@vercel/analytics';
  import { page } from '$app/stores';
  import type { Snippet } from 'svelte';

  inject();

  let { children }: { children: Snippet } = $props();
  const isChat = $derived($page.url.pathname.startsWith('/chat'));
</script>

{#if !isChat}
  <nav>
    <a href="/" class="wordmark">Ouracle</a>
    <div class="links">
      <a href="/clea">Clea</a>
      <a href="/ripl">RIPL</a>
      <a href="/diy">D.I.Y.</a>
      <a href="/chat" class="cta">enter</a>
    </div>
  </nav>
{/if}

{@render children()}

{#if !isChat}
  <footer>
    <span>© 2026 <a href="https://kerry.ink">Kerry Alan Snyder</a></span>
  </footer>
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
  z-index: 10;
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
