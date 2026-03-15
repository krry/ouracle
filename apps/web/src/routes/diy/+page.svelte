<script lang="ts">
  import { renderMarkdown } from '$lib/markdown';

  const raw = `# DIY — Make It Yours(acle)

Ouracle is open infrastructure. If you'd rather not use the hosted service, you can run the full stack on your own machine with a local language model. No API keys required for the core experience.

---

## What you're running

\`\`\`
Ollama (local LLM)  ←→  Ouracle API (Node/Bun)  ←→  Clea (web or shell)
\`\`\`

The Ouracle API is the intermediary — it runs the ritual logic, manages sessions, and talks to whatever LLM you point it at. The default is Ollama, so a vanilla clone with no extra config is already local-first.

---

## Prerequisites

- [Bun](https://bun.sh) (\`curl -fsSL https://bun.sh/install | bash\`)
- [Ollama](https://ollama.com) (\`brew install ollama\` on macOS, or the Linux installer)
- [Rust](https://rustup.rs) — only if you want the shell client (\`clea-tui\`)
- A Neon Postgres database — [free tier](https://neon.tech) works fine, or run Postgres locally

---

## 1. Install Ollama and pull a model

\`\`\`sh
ollama serve &          # start the Ollama server (runs at http://localhost:11434)
ollama pull llama3.1:8b # recommended — supports tool/function calling
\`\`\`

**Model guide:**

| Model | Size | Tool calling | Notes |
|-------|------|-------------|-------|
| \`llama3.1:8b\` | ~5 GB | ✓ | Recommended. Full Ouracle feature set. |
| \`llama3.2:3b\` | ~2 GB | ✓ | Lighter. Good on 8 GB RAM. |
| \`llama3:8b\` | ~5 GB | ✗ | Older. Disable semantic inference (see below). |
| \`mistral:7b\` | ~4 GB | ✗ | Alternative. Disable semantic inference. |

Tool calling is required for semantic inference (the Plexus). If your model doesn't support it, set \`SEMANTIC_INFERENCE=false\` and Ouracle falls back to keyword scoring — still fully functional, just less nuanced.

---

## 2. Clone and configure the API

\`\`\`sh
git clone https://github.com/krry/ouracle
cd ouracle/api
cp .env.example .env
\`\`\`

Edit \`.env\`:

\`\`\`sh
LLM_PROVIDER=ollama
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b

SEMANTIC_INFERENCE=true

DATABASE_URL=postgresql://...

JWT_SECRET=$(openssl rand -base64 32)

# FISH_AUDIO_API_KEY=your_key_here
\`\`\`

---

## 3. Run the API

\`\`\`sh
cd ouracle/api
bun install
bun run dev          # starts on http://localhost:3737
\`\`\`

Verify:
\`\`\`sh
curl http://localhost:3737/health
# {"ok":true}
\`\`\`

---

## 4. Run the web client

\`\`\`sh
cd ouracle/apps/web
cp .env.example .env.local
# Set VITE_OURACLE_BASE_URL=http://localhost:3737
bun install
bun run dev          # starts on http://localhost:5173
\`\`\`

Open \`http://localhost:5173\` and you're talking to your own Ouracle.

---

## 5. Shell client (optional)

\`\`\`sh
cargo install clea-tui
\`\`\`

Configure \`~/.config/clea/config.toml\` (created on first run):

\`\`\`toml
[api]
base_url = "http://localhost:3737"
\`\`\`

---

## Voice (TTS / STT)

Voice features use [Fish Audio](https://fish.audio). Without a key the text interface works fully — voice is progressive enhancement.

If you want voice:
1. Create a free Fish Audio account
2. Set \`FISH_AUDIO_API_KEY=your_key\` in the API \`.env\`

---

## Using Groq instead of Ollama

\`\`\`sh
GROQ_API_KEY=your_key
GROQ_MODEL=llama-3.1-8b-instant
\`\`\`

[Groq](https://groq.com) offers a generous free tier on Llama 3.1 models.

---

## Troubleshooting

**Ollama not responding:**
\`\`\`sh
curl http://localhost:11434/api/tags
ollama serve
\`\`\`

**Tool calling errors / inference failing:**
Set \`SEMANTIC_INFERENCE=false\` in \`.env\`.

**Database connection errors:**
Check \`DATABASE_URL\` is set and the Postgres instance is reachable. Run \`bun run migrate\` if tables are missing.
`;

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
