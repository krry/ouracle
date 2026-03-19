# Reception TUI Design

**Date:** 2026-03-13
**Scope:** Move Ouracle auth flow into the TUI; `/dev off` by default; delete `apps/ripl`

---

## Problem

`apps/ripltui` runs a blocking plain-stdin/stdout reception flow (name, password, covenant) before entering raw-mode TUI. This is bad UX — the user sees a naked CLI prompt before the aura appears. The TUI should own the entire experience from launch.

---

## Goals

- Reception (sign-in / new seeker / covenant) happens inside the TUI with the aura live
- No CLI crutch before `ripl::run_with_provider`
- `/dev` mode off by default; enabled via `RIPL_DEV=1` env var
- Delete the superseded `apps/ripl` (`ouracle` binary)

---

## Architecture

### 1. ripl lib — new public API (`~/house/desk/ripl/src/lib.rs`)

Add two public functions and refactor the existing ones to wrap them:

```rust
/// Enter raw-mode terminal, run `f`, restore terminal.
pub fn with_terminal<F>(f: F) -> Result<()>
where
    F: FnOnce(&mut Terminal<CrosstermBackend<io::Stdout>>) -> Result<()>;

/// Run the RIPL event loop inside an already-open terminal.
pub fn run_in_terminal(
    terminal: &mut Terminal<CrosstermBackend<io::Stdout>>,
    provider: Option<Arc<dyn providers::Provider>>,
    label: Option<String>,
) -> Result<()>;
```

`run_with_provider` becomes:
```rust
pub fn run_with_provider(provider: Arc<dyn Provider>, label: Option<String>) -> Result<()> {
    with_terminal(|t| run_in_terminal(t, Some(provider), label))
}
```

No other ripl internals change.

### 2. ripltui — reception TUI (`apps/ripltui/src/`)

`reception.rs` splits:

- `reception/http.rs` — all blocking HTTP helpers (unchanged logic from current `reception.rs`)
- `reception/tui.rs` — new ratatui mini-loop for auth

**`reception/tui.rs`** — step machine:

```rust
enum ReceptionStep {
    Entry,             // new [n] or returning [r]
    Name,              // text input — new seeker name
    Password,          // masked input — new seeker password
    Covenant,          // scroll covenant text, [y]/[n]
    ReturningHandle,   // text input — existing handle
    ReturningPassword, // masked input — existing password
}
```

State struct carries `step: ReceptionStep`, `input: String`, `error: Option<String>`. Errors are rendered as a dim status line below the input field; the step stays put and the user corrects. On `handle_exhausted` from `/seeker/new`: return to `Name` step with error.

**Refresh token fast-path:** `ensure_credentials` first attempts token rotation (blocking HTTP, see below). Three outcomes:
1. Rotation succeeds, `stage != "known"` → skip TUI entirely, return credentials
2. Rotation succeeds, `stage == "known"` → enter TUI at `Covenant` step (seeker has a new covenant to accept)
3. Rotation fails → enter TUI at `Entry` step

Aura is live throughout (same `Aura::tick` + `on_tick` cadence as ripl). Borrows `theme::*` color helpers directly (already in scope via the ripl dep). On abort (Esc or covenant rejection): `return Ok(None)`, caller exits cleanly.

Returns `Option<Credentials>` where `Credentials` is the existing struct from `reception.rs`.

**Blocking HTTP in raw mode:** All HTTP calls (`/auth/refresh`, `/seeker/new`, `/auth/token`, `/covenant`, `bootstrap_session`) are blocking and called while the terminal is in raw mode. To prevent invisible freezes, each call is preceded by rendering a "connecting…" message in the aura status area. Timeouts remain at their current values (15s for reception, 12s for bootstrap). Threaded HTTP is out of scope for this pass — acceptable tradeoff given these are short-lived, infrequent auth calls, not streaming.

### 3. ripltui — `main.rs` rewrite

```rust
fn main() -> Result<()> {
    color_eyre::install()?;

    let mut cfg = load_config();
    let base_url = resolve_base_url(&cfg);

    ripl::with_terminal(|terminal| {
        // Phase 1: reception (if no valid refresh token)
        let creds = reception::tui::ensure_credentials(terminal, &cfg, &base_url)?;
        let Some(creds) = creds else { return Ok(()); };

        // Save credentials
        cfg.access_token = Some(creds.access_token.clone());
        cfg.refresh_token = Some(creds.refresh_token.clone());
        cfg.seeker_id = Some(creds.seeker_id.clone());
        cfg.base_url = Some(base_url.clone());
        save_config(&cfg)?;

        // Phase 2: session bootstrap
        let bootstrap = bootstrap_session(&base_url, &creds.access_token)?;
        seed_ripl_session(&bootstrap);

        // Phase 3: RIPL event loop
        let provider = Arc::new(OuracleProvider::new(
            base_url,
            creds.access_token,
            Some(bootstrap.session_id),
        ));
        ripl::run_in_terminal(terminal, Some(provider), Some("Ouracle".to_string()))
    })
}
```

### 4. `/dev` default

`ripl/src/app.rs` — `App::new()`: change `dev_mode: true` → `dev_mode: false`. `dev_mode` is already a public field (`pub dev_mode: bool`) so direct assignment from `run_in_terminal` compiles without a setter.

`ripl/src/lib.rs` — `run_in_terminal` (formerly `event_loop`): after constructing `App`, add:
```rust
if std::env::var("RIPL_DEV").is_ok() {
    app.dev_mode = true;
}
```

**Note:** `run_in_terminal` internally calls `config::Config::load()` to configure speech modes. This is a second config load — `ripltui` loads `~/.ouracle/ripl.toml` and ripl loads `~/.ripl/config.toml`. These are separate files and the second load is intentional (speech config stays ripl-owned).

### 5. Delete `apps/ripl`

Remove `ouracle/apps/ripl/` entirely (the `ouracle` binary — superseded by ripltui).

---

## File changeset

| Repo | File | Action |
|------|------|--------|
| `ripl` | `src/lib.rs` | Add `with_terminal`, `run_in_terminal`; refactor `run_with_provider` |
| `ripl` | `src/app.rs` | `dev_mode: false` default |
| `ouracle` | `apps/ripltui/src/main.rs` | Rewrite to use `with_terminal` + `run_in_terminal` |
| `ouracle` | `apps/ripltui/src/reception/http.rs` | Move HTTP helpers from `reception.rs` |
| `ouracle` | `apps/ripltui/src/reception/tui.rs` | New: ratatui reception mini-loop |
| `ouracle` | `apps/ripltui/src/reception.rs` | Delete (replaced by submodule) |
| `ouracle` | `apps/ripl/` | Delete entire directory |

---

## Out of scope

- Speech (PTT, STT, TTS) changes
- Covenant display inside ripl's main loop (already handled by existing session bootstrap)
- Any changes to the API server
