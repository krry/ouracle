<script lang="ts">
  import { renderMarkdown } from '$lib/markdown';
  import raw from '../../../../../docs/diy.md?raw';

  const html = renderMarkdown(raw);
</script>

<div class="page prose-page">
  {@html html}
</div>

<style>
.prose-page {
  max-width: var(--max-prose);
  margin: 0 auto;
  padding: var(--space-xl) var(--space-md);
}
.prose-page :global(h1) {
  font-family: var(--font-display);
  font-size: 2.5rem;
  font-weight: 300;
  letter-spacing: 0.2em;
  color: var(--accent);
  margin-bottom: var(--space-md);
}
.prose-page :global(h2) {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--muted);
  margin: var(--space-md) 0 var(--space-xs);
}
.prose-page :global(p) {
  font-size: 0.95rem;
  line-height: 1.8;
  color: var(--muted);
  margin-bottom: var(--space-sm);
}
.prose-page :global(pre) {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow-x: auto;
  padding: 0.8rem 1rem;
  margin: var(--space-sm) 0;
}
.prose-page :global(table) {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
  margin: var(--space-sm) 0;
}
.prose-page :global(th) {
  color: var(--muted);
  font-family: var(--font-mono);
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  border-bottom: 1px solid var(--border);
  padding: 0.4rem 0.6rem;
  text-align: left;
}
.prose-page :global(td) {
  border-bottom: 1px solid var(--border);
  padding: 0.4rem 0.6rem;
  color: var(--text);
}
.prose-page :global(hr) {
  border: none;
  border-top: 1px solid var(--border);
  margin: var(--space-md) 0;
}
.prose-page :global(a) { color: var(--accent); }
</style>
