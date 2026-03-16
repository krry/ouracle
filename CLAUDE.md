# Project Overview

## Stack
- **API**: Express + Bun, hosted on Railway
- **Web**: SvelteKit + Svelte 5, hosted on Vercel
- **DB**: Neon Postgres (dev branch: `br-purple-mouse-aezaj7nh`)
- **Auth**: BetterAuth 1.x

## Key Conventions

### Svelte 5 — mandatory
All `.svelte` files must use Svelte 5 runes mode. No Svelte 4 patterns:
- `$state()`, `$derived()`, `$effect()`, `$props()` — always
- No `export let` for props — use `let { prop } = $props()`
- No `createEventDispatcher` — use callback props (`onsomething: () => void`)
- No `on:event` — use `onevent={handler}`

### Runtime
- Use **bun** for everything: `bun install`, `bun run dev`, `bun test.js`

## Important Files
- `api/engine.js` — inference engine (OCTAVE, RITES, auditLoveFear)
- `api/db.js` — all DB access
- `api/decks.js` — divine card deck loader + parser
- `api/auth-config.js` — BetterAuth config + Apple JWT generation
- `apps/web/src/lib/Chat.svelte` — main chat UI
- `apps/web/src/lib/stores.ts` — shared state
