<script lang="ts">
  const clips = [
    '/media/clea-glyph-taz/clip-000.mp4',
    '/media/clea-glyph-taz/clip-001.mp4',
    '/media/clea-glyph-taz/clip-002.mp4',
    '/media/clea-glyph-taz/clip-005.mp4',
    '/media/clea-glyph-taz/clip-006.mp4',
    '/media/clea-glyph-taz/clip-010.mp4'
  ];
</script>

<svelte:head>
  <title>Devs | Ouracle</title>
</svelte:head>

<div class="page">
  <header>
    <h1>Devs</h1>
    <p class="sub">δεῦς</p>
  </header>

  <section class="dev-section">
    <div class="section-head">
      <div class="kicker">ripl</div>
      <h2>the shell listens back</h2>
    </div>

    <p class="lede">
      `ripl` is the terminal chassis for Clea: a <code>ratatui</code> event loop with
      voice, ambient sound, and themes that shift with the conversation.
    </p>

    <div class="video-grid">
      {#each clips as clip}
        <div class="clip-frame">
          <video
            class="clip"
            src={clip}
            controls
            muted
            playsinline
            loop
            preload="metadata"
          ></video>
        </div>
      {/each}
    </div>

    <div class="code-blocks">
      <div class="code-block">
        <h3>Add to your project</h3>
        <pre><code>[dependencies]
ripl-tui = "0.3"</code></pre>
      </div>

      <div class="code-block">
        <h3>Run the binary</h3>
        <pre><code>cargo install ripl-tui</code></pre>
      </div>
    </div>

    <div class="links">
      <a href="https://crates.io/crates/ripl-tui" target="_blank" rel="noopener">crates.io</a>
      <a href="https://docs.rs/ripl-tui" target="_blank" rel="noopener">docs.rs</a>
      <a href="https://github.com/krry/ripl" target="_blank" rel="noopener">github</a>
    </div>
  </section>

  <section class="dev-section">
    <div class="section-head">
      <div class="kicker">diy</div>
      <h2>open infrastructure</h2>
    </div>

    <p class="lede">
      Ouracle can run as a hosted ritual space, as a local web stack, or in the shell.
      The same oracle logic can speak through multiple surfaces.
    </p>

    <div class="code-blocks">
      <div class="code-block wide">
        <h3>Clone and configure</h3>
        <pre><code>git clone https://github.com/krry/ouracle
cd ouracle/api
cp .env.example .env

LLM_PROVIDER=ollama
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
SEMANTIC_INFERENCE=true
DATABASE_URL=postgresql://...
JWT_SECRET=$(openssl rand -base64 32)</code></pre>
      </div>

      <div class="code-block">
        <h3>Run the API</h3>
        <pre><code>cd ouracle/api
bun install
bun run dev</code></pre>
      </div>

      <div class="code-block">
        <h3>Run the web client</h3>
        <pre><code>cd ouracle/apps/web
bun install
bun run dev</code></pre>
      </div>

      <div class="code-block">
        <h3>Shell client</h3>
        <pre><code>cargo install clea-tui</code></pre>
      </div>

      <div class="code-block">
        <h3>Config</h3>
        <pre><code>[api]
base_url = "http://localhost:3737"</code></pre>
      </div>
    </div>
  </section>
</div>

<style>
.page {
  max-width: min(1100px, calc(100% - 2rem));
  margin: 0 auto;
  padding: var(--space-xl) var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

header {
  text-align: center;
}

h1 {
  font-family: var(--font-mono);
  font-size: 3rem;
  color: var(--accent);
  letter-spacing: 0.12em;
  text-transform: lowercase;
}

.sub {
  font-size: 0.9rem;
  color: var(--muted);
  margin-top: 0.5rem;
  font-family: var(--font-display);
}

.dev-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem;
  border: 1px solid var(--glass-border);
  border-radius: 24px;
  background: var(--glass-wash), color-mix(in srgb, var(--glass-bg-strong) 90%, transparent);
  box-shadow: var(--glass-shadow);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
}

.section-head {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.kicker {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 300;
}

h2 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 500;
  color: var(--text);
}

.lede {
  font-size: 0.95rem;
  line-height: var(--leading);
  color: var(--text);
  max-width: 70ch;
}

.video-grid {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.clip {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center bottom;
  background: color-mix(in srgb, var(--surface) 82%, transparent);
}

.clip-frame {
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--glass-border) 90%, transparent);
  background: color-mix(in srgb, var(--surface) 82%, transparent);
}

.code-blocks {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 0.85rem;
}

.code-block {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.code-block.wide {
  grid-column: 1 / -1;
}

h3 {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 300;
}

pre {
  background: color-mix(in srgb, var(--surface) 82%, transparent);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 0.8rem 1rem;
  font-size: 0.82rem;
  overflow-x: auto;
}

.links {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.links a {
  color: var(--accent);
  text-decoration: none;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: lowercase;
}

.links a:hover {
  text-decoration: underline;
}

@media (max-width: 640px) {
  .page {
    max-width: 100%;
    padding-inline: 0.75rem;
  }

  .dev-section {
    padding: 1rem;
  }
}
</style>
