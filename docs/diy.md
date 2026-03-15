# Aspire — Run Your Own Ouracle

Ouracle is open infrastructure. If you'd rather not use the hosted service, you can run the full stack on your own machine with a local language model. No API keys required for the core experience.

---

## What you're running

```
Ollama (local LLM)  ←→  Ouracle API (Node/Bun)  ←→  Clea (web or shell)
```

The Ouracle API is the intermediary — it runs the ritual logic, manages sessions, and talks to whatever LLM you point it at. The default is Ollama, so a vanilla clone with no extra config is already local-first.

---

## Prerequisites

- [Bun](https://bun.sh) (`curl -fsSL https://bun.sh/install | bash`)
- [Ollama](https://ollama.com) (`brew install ollama` on macOS, or the Linux installer)
- [Rust](https://rustup.rs) — only if you want the shell client (`clea-tui`)
- A Neon Postgres database — [free tier](https://neon.tech) works fine, or run Postgres locally

---

## 1. Install Ollama and pull a model

```sh
ollama serve &          # start the Ollama server (runs at http://localhost:11434)
ollama pull llama3.1:8b # recommended — supports tool/function calling
```

**Model guide:**

| Model | Size | Tool calling | Notes |
|-------|------|-------------|-------|
| `llama3.1:8b` | ~5 GB | ✓ | Recommended. Full Ouracle feature set. |
| `llama3.2:3b` | ~2 GB | ✓ | Lighter. Good on 8 GB RAM. |
| `llama3:8b` | ~5 GB | ✗ | Older. Disable semantic inference (see below). |
| `mistral:7b` | ~4 GB | ✗ | Alternative. Disable semantic inference. |

Tool calling is required for semantic inference (the Plexus). If your model doesn't support it, set `SEMANTIC_INFERENCE=false` and Ouracle falls back to keyword scoring — still fully functional, just less nuanced.

---

## 2. Clone and configure the API

```sh
git clone https://github.com/krry/ouracle
cd ouracle/api
cp .env.example .env
```

Edit `.env`:

```sh
# LLM — Ollama is the default; these are all optional if you accept the defaults
LLM_PROVIDER=ollama
OLLAMA_HOST=http://localhost:11434   # default
OLLAMA_MODEL=llama3.1:8b            # default is llama3:8b — upgrade to this

# Semantic inference (requires tool-calling model)
SEMANTIC_INFERENCE=true             # set false if using a non-tool-calling model

# Database
DATABASE_URL=postgresql://...       # your Neon or local Postgres connection string

# Auth — generate a random secret
JWT_SECRET=$(openssl rand -base64 32)

# TTS/STT — optional; voice features require a Fish Audio key
# Leave unset to run text-only
# FISH_AUDIO_API_KEY=your_key_here
```

---

## 3. Run the API

```sh
cd ouracle/api
bun install
bun run dev          # starts on http://localhost:3737
```

Verify:
```sh
curl http://localhost:3737/health
# {"ok":true}
```

---

## 4. Run the web client

```sh
cd ouracle/apps/web
cp .env.example .env.local
# Set VITE_OURACLE_BASE_URL=http://localhost:3737
bun install
bun run dev          # starts on http://localhost:5173
```

Open `http://localhost:5173` and you're talking to your own Ouracle.

---

## 5. Shell client (optional)

```sh
cargo install clea-tui
```

Configure `~/.config/clea/config.toml` (created on first run):

```toml
[api]
base_url = "http://localhost:3737"

[llm]
# No changes needed here — the shell client talks to the API, not the LLM directly
```

---

## Voice (TTS / STT)

Voice features use [Fish Audio](https://fish.audio). Without a key the text interface works fully — voice is progressive enhancement.

If you want voice:
1. Create a free Fish Audio account
2. Set `FISH_AUDIO_API_KEY=your_key` in the API `.env`

There is no self-hosted voice path yet. Community contributions welcome.

---

## Using Groq instead of Ollama

If you want a free remote LLM that's faster than local:

```sh
GROQ_API_KEY=your_key  # LLM_PROVIDER auto-selects groq when this is set
GROQ_MODEL=llama-3.1-8b-instant  # default
```

[Groq](https://groq.com) offers a generous free tier on Llama 3.1 models.

---

## Troubleshooting

**Ollama not responding:**
```sh
curl http://localhost:11434/api/tags   # list available models
ollama serve                           # if not running
```

**Tool calling errors / inference failing:**
Set `SEMANTIC_INFERENCE=false` in `.env`. Ouracle runs without it.

**Database connection errors:**
Check `DATABASE_URL` is set and the Postgres instance is reachable. Run `bun run migrate` if tables are missing.
