<div class="page">
  <header>
    <h1>ripl</h1>
    <p class="sub">when the shell that listens back</p>
  </header>

  <section class="prose-section">
    <p>
      ripl is the chassis for Clea in the shell —
      a <code>ratatui</code> event loop bathing in an ASCII aura
      wired to any LLM, with voice, ambient sound,
      and themes that shift with the conversation.
      Open source. Point it at your model.
      Build a prompt that listens.
    </p>
  </section>

  <section class="install">
    <h2>Add to your project</h2>
    <pre><code>[dependencies]
ripl-tui = "0.3"</code></pre>

    <h2>Run the binary</h2>
    <pre><code>cargo install ripl-tui</code></pre>

    <h2>Links</h2>
    <ul>
      <li><a href="https://crates.io/crates/ripl-tui" target="_blank" rel="noopener">crates.io</a></li>
      <li><a href="https://docs.rs/ripl-tui" target="_blank" rel="noopener">docs.rs</a></li>
      <li><a href="https://github.com/krry/ripl" target="_blank" rel="noopener">github</a></li>
    </ul>
  </section>
</div>

<style>
.page {
  max-width: var(--max-prose);
  margin: 0 auto;
  padding: var(--space-xl) var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}
header { text-align: center; }
h1 { font-family: var(--font-mono); font-size: 3rem; color: var(--accent); }
.sub { font-size: 0.9rem; color: var(--muted); margin-top: 0.5rem; font-family: var(--font-mono); }
.prose-section p { font-size: 1rem; line-height: var(--leading); color: var(--text); text-align: left; margin-bottom: 1rem; }
.install { display: flex; flex-direction: column; gap: var(--space-sm); }
h2 {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.15em;
  color: var(--muted);
  text-transform: uppercase;
  margin-top: var(--space-sm);
}
pre {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.8rem 1rem;
  font-size: 0.9rem;
  overflow-x: auto;
}
ul { display: flex; gap: var(--space-md); list-style: none; font-family: var(--font-mono); font-size: 0.85rem; }
ul a { color: var(--accent); text-decoration: none; }
ul a:hover { text-decoration: underline; }
</style>
