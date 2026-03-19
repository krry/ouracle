# RIPL Extraction Design

**Date:** 2026-03-13
**Scope:** `apps/tui` → new open-source `ripl` crate + binary

---

## Summary
RIPL is a provider-agnostic, speech-first terminal REPL with a breathing aura UI, push-to-talk, and lightweight project memory. Ouracle becomes a consumer via API endpoint; RIPL stays domain-agnostic and interacts only with chat-style messages.

---

## Goals
- Extract reusable TUI, aura, theme, and event loop into a standalone Rust crate + binary (`ripl`).
- Support Anthropic, OpenAI, and OpenRouter via a unified provider interface and streaming tokens.
- Speech-first UX: push-to-talk, STT (Whisper local and Fish.audio), and TTS (say/espeak/Fish.audio).
- Project memory via scaffold files in the working directory, with safe bootstrapping.
- Minimal dependencies; blocking network is acceptable.

## Non-goals
- Embedding Ouracle domain modes or server flows in RIPL.
- Implementing a complex plugin system or framework-level app traits.
- Making RIPL async-only or requiring Tokio.

---

## Architecture

### Crate shape
Single crate producing both a library and a binary.

```
ripl/
├── Cargo.toml
├── README.md
├── .claude/CLAUDE.md
├── skills/README.md
└── src/
    ├── main.rs
    ├── app.rs
    ├── ui.rs
    ├── aura.rs
    ├── theme.rs
    ├── config.rs
    ├── session.rs
    ├── providers/
    │   ├── mod.rs
    │   ├── anthropic.rs
    │   ├── openai.rs
    │   └── openrouter.rs
    └── speech/
        ├── mod.rs
        ├── tts.rs
        ├── stt.rs
        └── fish.rs
```

### Core data flow
- `main.rs` owns the terminal loop and channels.
- `app.rs` owns state, input handling, and view-model for UI rendering.
- `providers::*` stream tokens to the app via an `ApiResponse` channel.
- `speech::*` handles PTT, STT, and TTS, emitting tokens or errors.
- `scaffold` (in `config.rs` + `session.rs`) loads and optionally bootstraps agent memory files.

---

## Provider abstraction

```rust
pub enum Role { System, User, Assistant }

pub struct Message {
    pub role: Role,
    pub content: String,
}

pub enum ApiResponse {
    TokenChunk { token: String },
    TurnComplete,
    Error { message: String },
}

pub trait Provider: Send + 'static {
    fn stream(&self, messages: &[Message], tx: mpsc::Sender<ApiResponse>);
}
```

- Providers run in a worker thread and stream token chunks to the UI.
- Ouracle integration becomes a provider that targets an Ouracle chat endpoint.

---

## Config resolution
Config file: `~/.ripl/config.toml`.

Priority order: explicit config > env vars > defaults.

```
[provider]
name = "anthropic"          # anthropic | openai | openrouter
model = "claude-sonnet-4-6"
api_key = "..."              # or env vars

[scaffold]
bootstrap = true             # create scaffold on first launch
history_max_turns = 10

[theme]
root_hue = 217               # or RIPL_ROOT_HUE env var

[speech]
tts = "fish"                # fish | say | espeak | none
stt = "fish"                # fish | whisper | none
push_to_talk = true
fish_api_key = "..."        # or FISH_API_KEY
fish_voice_id = "..."
```

Provider auto-detect env vars (if no config):
1. `ANTHROPIC_API_KEY`
2. `OPENAI_API_KEY`
3. `OPENROUTER_API_KEY`

---

## Scaffold & memory
RIPL looks for these files in the current working directory:
- `README.md`
- `.claude/CLAUDE.md`
- `skills/README.md`

If missing and `scaffold.bootstrap = true`, RIPL offers:
- `Leave alone` (default)
- `Append` (add a RIPL section)
- `Overwrite`

The scaffold is used to build the system prompt and to store sparse, durable history summaries after each session.

---

## Session persistence
- Store minimal session history under `~/.ripl/sessions/` (per project hash).
- Write back sparse summary to scaffold files after `TurnComplete`.

---

## UI modes
`AppMode` becomes:
- `Setup` (missing config / API key)
- `Ready` (idle)
- `Pending` (request in flight)
- `Streaming` (token stream)

---

## Migration plan (Ouracle → RIPL)
1. Extract generic pieces: `aura.rs`, `theme.rs`, `ui.rs` helpers, and event loop from `main.rs`.
2. Replace `api.rs` with `providers/` and token streaming.
3. Replace `totem.rs` with `session.rs` (RIPL-owned persistence).
4. Replace Ouracle domain modes in `app.rs` with generic REPL flow.
5. Add scaffold + config bootstrap.
6. Add speech module; keep fish + whisper + say/espeak.

---

## Open questions
- Where should the Ouracle provider live: inside `ripl` or in the Ouracle repo as an extension crate?
- Do we want a `ripl init` command to pre-create scaffold outside launch flow?
- Should summaries be appended to `README.md` or stored in a separate `RIPL.md`?

