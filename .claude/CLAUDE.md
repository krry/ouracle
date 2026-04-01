# Ouracle

A reflective AI companion organized as a non-profit church. Not a task assistant — a portal.
Docs in `docs/` are the source of truth. Implement the roadmap; don't edit specs to match code.

---

## Stack

| Layer | Tech |
|-------|------|
| API | Node/Bun, Express, port 3737 |
| Web | SvelteKit 2 + Svelte 5 runes, port 2532 (C-L-E-A) |
| TUI | Rust + Ratatui (`apps/tui`) |
| DB | Neon Postgres (serverless driver) |
| Auth | BetterAuth 1.5.5 (no passkey plugin — deferred to v2) |
| LLM | Ollama (default) · Groq · Claude via `api/llm-client.js` |
| Deploy | API → Railway · Web → Vercel |

## Key files

```
api/
  index.js          — Express routes
  engine.js         — OCTAVE, RITES, auditLoveFear inference
  db.js             — all DB access (repository layer)
  auth.js           — JWT + refresh tokens (Ouracle's own auth)
  auth-config.js    — BetterAuth config (social OAuth)
  infer.js          — Claude semantic inference (Phase 1, feature-flagged)
  llm-client.js     — unified LLM client (Ollama / Groq / Claude)
  clea-prompt.js    — Clea system prompt

apps/web/src/
  app.css           — design tokens (jing·qi·shen hues, font stack, spacing)
  lib/Chat.svelte   — main chat interface
  lib/Reception.svelte — auth/onboarding flow
  routes/+layout.svelte — nav, footer, analytics
```

## Deploying

- **Web (Vercel)**: push to `main` — auto-deploys `apps/web`
- **API (Railway)**: push to `main` — auto-deploys `api/`
- **TUI binary**: build with `cargo build --release` from `apps/tui`, package with `tar czf apps/web/static/clea-macos.tar.gz -C apps/tui/target/release clea`, commit and push to `main`

## Conventions

- **Bun** everywhere: `bun install`, `bun run dev`, `bun test.js`
- Bun loads `.env` automatically — no dotenv import needed
- Svelte 5 runes: `$state`, `$derived`, `$effect`, `{@render children()}`
- No `npm`, no `node` commands

## Design tokens

- `--hue-jing` 217° · `--hue-shen` 354° · `--hue-qi` 80° (three treasures)
- `--font-display` New York/Georgia serif — body text
- `--font-sans` SF Pro/system-ui — UI elements (buttons, nav, inputs)
- `--font-mono` SF Mono/Fira Code — code, pre, kbd only
- `--accent` animates through jing→shen→qi on 90s cycle via `@property`

## Feature flags (`.env`)

- `SEMANTIC_INFERENCE=true` — Claude API inference (Phase 1)
- `SEMANTIC_INFERENCE=false` — keyword fallback (default)

## Phase status

- **Phase 0** Foundation ✅
- **Phase 1** The Plexus 🔄 (`infer.js` built, prompt tuning pending)
- **Phase 2** The Temple (web Priestess — in progress)

## Nebula background

`apps/web/src/lib/Nebula.svelte` is **pure CSS** — no Three.js, no canvas, no WebGL. Do not restore the WebGL implementation; it filled iOS tab cache.

- Accepts `opacity` prop (default 1); used at full opacity on homepage hero, `0.18` on enquire page background
- Two `::before`/`::after` pseudo-elements with Ouracle hue vocabulary (core 185°, teal 172°, gold 38°, pink 295°, amber 22°)
- Animation: prime-factor durations (32s / 41s / 58s hue-rotate), `transform` + `filter` only
