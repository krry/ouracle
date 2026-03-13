# Reception TUI Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Ouracle auth flow (name/password/covenant) into the ratatui TUI so the aura is live from first launch — no CLI crutch.

**Architecture:** Extend `ripl` lib with two new public functions (`with_terminal`, `run_in_terminal`) so consumers can share one terminal session across phases. `ripltui` uses these to run a ratatui reception mini-loop (step machine) before handing off to the main RIPL event loop. Default `dev_mode` to off; enable via `RIPL_DEV=1`.

**Tech Stack:** Rust 2024, ratatui 0.26, crossterm 0.28, reqwest blocking, color-eyre. Two repos: `~/house/desk/ripl/` (lib) and `~/house/desk/ouracle/apps/ripltui/` (consumer binary).

---

## Chunk 1: ripl lib — public terminal API + dev_mode default

### Task 1: Expose `with_terminal` and `run_in_terminal`

**Repo:** `~/house/desk/ripl/`

**Files:**
- Modify: `src/lib.rs`

- [ ] **Step 1: Read current lib.rs**

  Verify the private functions to rename:
  ```bash
  grep -n "^fn setup_terminal\|^fn event_loop\|^pub fn run" /Users/kerry/house/desk/ripl/src/lib.rs
  ```
  Expected: lines for `setup_terminal`, `event_loop`, `run`, `run_with_provider`.

- [ ] **Step 2: Replace `setup_terminal` with public `with_terminal`**

  In `ripl/src/lib.rs`, change:
  ```rust
  fn setup_terminal<F>(f: F) -> Result<()>
  where
      F: FnOnce(&mut Terminal<CrosstermBackend<io::Stdout>>) -> Result<()>,
  ```
  to:
  ```rust
  pub fn with_terminal<F>(f: F) -> Result<()>
  where
      F: FnOnce(&mut Terminal<CrosstermBackend<io::Stdout>>) -> Result<()>,
  ```
  Body is identical — just the visibility and name change.

- [ ] **Step 3: Rename `event_loop` to `run_in_terminal` and make it public**

  Change:
  ```rust
  fn event_loop(
      terminal: &mut Terminal<CrosstermBackend<io::Stdout>>,
      override_provider: Option<Arc<dyn providers::Provider>>,
      override_label: Option<String>,
  ) -> Result<()> {
  ```
  to:
  ```rust
  pub fn run_in_terminal(
      terminal: &mut Terminal<CrosstermBackend<io::Stdout>>,
      override_provider: Option<Arc<dyn providers::Provider>>,
      override_label: Option<String>,
  ) -> Result<()> {
  ```
  Body is identical for now — `RIPL_DEV` check comes in Task 2.

- [ ] **Step 4: Update `run` and `run_with_provider` to call the renamed functions**

  ```rust
  pub fn run() -> Result<()> {
      with_terminal(|t| run_in_terminal(t, None, None))
  }

  pub fn run_with_provider(provider: Arc<dyn providers::Provider>, label: Option<String>) -> Result<()> {
      with_terminal(|t| run_in_terminal(t, Some(provider), label))
  }
  ```

- [ ] **Step 5: Build to verify**

  ```bash
  cd ~/house/desk/ripl && cargo build 2>&1
  ```
  Expected: `Compiling ripl ...` then `Finished`. Zero errors.

- [ ] **Step 6: Verify ripltui still builds against the updated lib**

  ```bash
  cd ~/house/desk/ouracle/apps/ripltui && cargo build 2>&1
  ```
  Expected: Finished. No errors. (ripltui only calls `run_with_provider` which still exists.)

- [ ] **Step 7: Commit (ripl repo)**

  ```bash
  cd ~/house/desk/ripl
  git add src/lib.rs
  git commit -m "feat(lib): expose with_terminal and run_in_terminal as public API"
  ```

---

### Task 2: Default `dev_mode` to off; respect `RIPL_DEV` env var

**Repo:** `~/house/desk/ripl/`

**Files:**
- Modify: `src/app.rs`
- Modify: `src/lib.rs`

- [ ] **Step 1: Change `dev_mode` default in `App::new()`**

  In `src/app.rs`, change:
  ```rust
  dev_mode: true,
  ```
  to:
  ```rust
  dev_mode: false,
  ```

- [ ] **Step 2: Add `RIPL_DEV` env check in `run_in_terminal`**

  In `src/lib.rs`, inside `run_in_terminal`, after:
  ```rust
  let mut app = App::new();
  ```
  add:
  ```rust
  if std::env::var("RIPL_DEV").is_ok() {
      app.dev_mode = true;
  }
  ```

- [ ] **Step 3: Build to verify**

  ```bash
  cd ~/house/desk/ripl && cargo build 2>&1
  ```
  Expected: Finished. Zero errors.

- [ ] **Step 4: Smoke test — confirm dev mode is off by default**

  ```bash
  cd ~/house/desk/ripl && cargo run 2>&1
  ```
  Expected: TUI launches in minimal (non-dev) mode — no chrome boxes, centered aura layout. `q` to quit.

  Then verify the env var works:
  ```bash
  RIPL_DEV=1 cargo run 2>&1
  ```
  Expected: TUI launches with status bar + thread + input boxes (dev chrome visible).

- [ ] **Step 5: Commit (ripl repo)**

  ```bash
  cd ~/house/desk/ripl
  git add src/app.rs src/lib.rs
  git commit -m "feat(app): dev_mode off by default; enable via RIPL_DEV=1"
  ```

---

## Chunk 2: ripltui — reception TUI

### Task 3: Split reception.rs → reception/http.rs

**Repo:** `~/house/desk/ouracle/apps/ripltui/`

**Files:**
- Create: `src/reception/mod.rs`
- Create: `src/reception/http.rs`
- Delete: `src/reception.rs` (after migration)

Goal: extract all HTTP helpers and business logic into `http.rs` with a clean interface. The old `ensure_credentials` (stdin-based) is replaced — don't migrate it.

- [ ] **Step 1: Create `src/reception/http.rs`**

  ```rust
  //! Blocking HTTP helpers for Ouracle reception.

  use std::time::Duration;

  use color_eyre::eyre::{bail, Result};
  use reqwest::blocking::Client;
  use serde_json::Value;

  // ─── Credentials ──────────────────────────────────────────────────────────────

  #[derive(Clone)]
  pub struct Credentials {
      pub seeker_id: String,
      pub access_token: String,
      pub refresh_token: String,
  }

  pub struct RotateResult {
      pub credentials: Credentials,
      pub stage: String,
  }

  // ─── Client ───────────────────────────────────────────────────────────────────

  pub fn make_client() -> Client {
      Client::builder()
          .timeout(Duration::from_secs(15))
          .build()
          .unwrap_or_else(|_| Client::new())
  }

  // ─── Low-level HTTP ───────────────────────────────────────────────────────────

  fn post_json(client: &Client, url: &str, body: &Value, token: Option<&str>) -> Result<Value> {
      let mut req = client.post(url).json(body);
      if let Some(t) = token {
          req = req.bearer_auth(t);
      }
      let resp = req.send()?;
      let status = resp.status().as_u16();
      let json: Value = resp.json()?;
      if status >= 400 {
          let msg = json
              .get("message")
              .or_else(|| json.get("error"))
              .and_then(|v| v.as_str())
              .unwrap_or("request failed");
          bail!("{msg}");
      }
      Ok(json)
  }

  fn get_json(client: &Client, url: &str) -> Result<Value> {
      let resp = client.get(url).send()?;
      let status = resp.status().as_u16();
      let json: Value = resp.json()?;
      if status >= 400 {
          let msg = json
              .get("message")
              .or_else(|| json.get("error"))
              .and_then(|v| v.as_str())
              .unwrap_or("request failed");
          bail!("{msg}");
      }
      Ok(json)
  }

  // ─── Auth calls ───────────────────────────────────────────────────────────────

  /// Attempt to rotate a saved refresh token. Returns credentials + stage.
  pub fn rotate_token(base_url: &str, refresh_token: &str) -> Result<RotateResult> {
      let c = make_client();
      let body = serde_json::json!({ "refresh_token": refresh_token });
      let resp = post_json(&c, &format!("{base_url}/auth/refresh"), &body, None)?;
      extract_credentials_and_stage(resp)
  }

  /// Register a new seeker. Returns (credentials, assigned_handle).
  /// Errors include "handle_exhausted" if the name is saturated.
  pub fn register_seeker(base_url: &str, name: &str, password: &str) -> Result<(Credentials, String)> {
      let c = make_client();
      let body = serde_json::json!({
          "name": name,
          "password": password,
          "device_id": hostname(),
          "timezone": iana_timezone(),
      });
      let resp = post_json(&c, &format!("{base_url}/seeker/new"), &body, None)?;
      let handle = resp
          .get("handle")
          .and_then(|v| v.as_str())
          .unwrap_or("?")
          .to_string();
      let creds = extract_credentials(resp)?;
      Ok((creds, handle))
  }

  /// Sign in a returning seeker. Returns credentials + stage.
  pub fn sign_in(base_url: &str, handle: &str, password: &str) -> Result<RotateResult> {
      let c = make_client();
      let body = serde_json::json!({ "handle": handle, "password": password });
      let resp = post_json(&c, &format!("{base_url}/auth/token"), &body, None)?;
      extract_credentials_and_stage(resp)
  }

  /// Fetch the current covenant. Returns (version, text_lines).
  pub fn fetch_covenant(base_url: &str) -> Result<(String, Vec<String>)> {
      let c = make_client();
      let resp = get_json(&c, &format!("{base_url}/covenant/current"))?;
      let version = resp
          .get("version")
          .and_then(|v| v.as_str())
          .unwrap_or("1.0")
          .to_string();
      let lines = resp
          .get("text")
          .and_then(|v| v.as_array())
          .map(|arr| arr.iter().filter_map(|v| v.as_str().map(str::to_string)).collect())
          .unwrap_or_default();
      Ok((version, lines))
  }

  /// Accept the current covenant.
  pub fn accept_covenant(base_url: &str, access_token: &str) -> Result<()> {
      let c = make_client();
      post_json(&c, &format!("{base_url}/covenant"), &serde_json::json!({}), Some(access_token))?;
      Ok(())
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  fn extract_credentials(json: Value) -> Result<Credentials> {
      let seeker_id = json.get("seeker_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
      let access_token = json.get("access_token").and_then(|v| v.as_str()).unwrap_or("").to_string();
      let refresh_token = json.get("refresh_token").and_then(|v| v.as_str()).unwrap_or("").to_string();
      if seeker_id.is_empty() || access_token.is_empty() {
          bail!("missing credentials in response");
      }
      Ok(Credentials { seeker_id, access_token, refresh_token })
  }

  fn extract_credentials_and_stage(json: Value) -> Result<RotateResult> {
      let stage = json.get("stage").and_then(|v| v.as_str()).unwrap_or("covenanted").to_string();
      let credentials = extract_credentials(json)?;
      Ok(RotateResult { credentials, stage })
  }

  pub fn hostname() -> String {
      std::process::Command::new("hostname")
          .output()
          .ok()
          .and_then(|o| String::from_utf8(o.stdout).ok())
          .map(|s| s.trim().to_string())
          .unwrap_or_else(|| "unknown".to_string())
  }

  pub fn iana_timezone() -> String {
      std::fs::read_link("/etc/localtime")
          .ok()
          .and_then(|p| {
              let s = p.to_string_lossy().into_owned();
              s.find("zoneinfo/").map(|i| s[i + 9..].to_string())
          })
          .unwrap_or_else(|| "UTC".to_string())
  }
  ```

- [ ] **Step 2: Create `src/reception/mod.rs`**

  ```rust
  pub mod http;
  pub mod tui;
  ```

  Note: `tui.rs` doesn't exist yet — this will cause a compile error until Task 4. That's expected.

- [ ] **Step 3: Create a stub `src/reception/tui.rs` to unblock compilation**

  ```rust
  //! TUI reception flow — stub (implemented in Task 4).
  use std::io;
  use color_eyre::eyre::Result;
  use ratatui::{backend::CrosstermBackend, Terminal};
  use super::http::Credentials;
  use crate::Config;

  pub fn ensure_credentials(
      _terminal: &mut Terminal<CrosstermBackend<io::Stdout>>,
      _cfg: &Config,
      _base_url: &str,
  ) -> Result<Option<Credentials>> {
      todo!("reception TUI not yet implemented")
  }
  ```

- [ ] **Step 4: Build to verify http.rs compiles**

  ```bash
  cd ~/house/desk/ouracle/apps/ripltui && cargo build 2>&1
  ```
  Expected: may warn about unused `tui` stub, but no errors (main.rs still uses old `reception::ensure_credentials` which is now missing — that's ok, it will error here and be fixed in Task 5). Actually: `reception.rs` still exists alongside `reception/mod.rs`, which is a conflict. So we need to handle that.

  **Fix the conflict first:** Delete `src/reception.rs`:
  ```bash
  cd ~/house/desk/ouracle/apps/ripltui
  trash src/reception.rs   # or: mv src/reception.rs ~/.Trash/
  ```

  Then re-run:
  ```bash
  cargo build 2>&1
  ```
  Expected: errors about `reception::ensure_credentials` not found (main.rs still calls old API). That's expected — Task 5 fixes main.rs.

- [ ] **Step 5: Commit**

  ```bash
  cd ~/house/desk/ouracle/apps/ripltui
  git add src/reception/
  git rm src/reception.rs
  git commit -m "refactor(reception): split into http.rs + tui stub; remove old reception.rs"
  ```

---

### Task 4: Implement `reception/tui.rs` — the ratatui auth mini-loop

**Repo:** `~/house/desk/ouracle/apps/ripltui/`

**Files:**
- Modify: `src/reception/tui.rs` (replace stub)
- Modify: `Cargo.toml` (add ratatui + crossterm as direct deps)

`tui.rs` imports `ratatui` and `crossterm` types directly. These are not re-exported from the `ripl` lib crate, so `ripltui` must declare them as direct dependencies matching the versions in ripl.

- [ ] **Step 1: Add ratatui and crossterm to ripltui's Cargo.toml**

  ```bash
  cd ~/house/desk/ouracle/apps/ripltui
  cargo add ratatui@0.26
  cargo add crossterm@0.28
  ```

  Verify `Cargo.toml` now contains:
  ```toml
  ratatui = "0.26"
  crossterm = "0.28"
  ```

- [ ] **Step 2: Replace the stub with the full implementation**

  Write `src/reception/tui.rs`:

  ```rust
  //! Ratatui reception flow — runs inside an existing terminal session.
  //! Returns Some(Credentials) on success or None if the user aborts.

  use std::io;
  use std::time::{Duration, Instant};

  use color_eyre::eyre::Result;
  use crossterm::event::{self, Event, KeyCode, KeyEventKind};
  use ratatui::layout::Rect;
  use ratatui::style::Style;
  use ratatui::widgets::{Block, Borders, Clear, Paragraph, Wrap};
  use ratatui::{backend::CrosstermBackend, Frame, Terminal};

  use ripl::aura::Aura;
  use ripl::theme::{text_accent, text_fade, text_primary, text_secondary, text_warning};

  use super::http::{self, Credentials};
  use crate::Config;

  // ─── Step machine ─────────────────────────────────────────────────────────────

  #[derive(Debug, Clone)]
  enum Step {
      Entry,
      Name,
      Password { name: String },
      Covenant {
          name: String,
          password: String,
          version: String,
          lines: Vec<String>,
          offset: usize,
          /// Credentials already obtained (returning seeker covenant path)
          existing_creds: Option<Box<Credentials>>,
      },
      ReturningHandle,
      ReturningPassword { handle: String },
  }

  struct State {
      step: Step,
      input: String,
      mask_input: bool,
      error: Option<String>,
      connecting: bool,
      aura: Aura,
  }

  enum Outcome {
      Continue,
      Done(Option<Credentials>),
  }

  // ─── Entry point ──────────────────────────────────────────────────────────────

  /// Run reception if no valid credentials are saved. Returns None if aborted.
  pub fn ensure_credentials(
      terminal: &mut Terminal<CrosstermBackend<io::Stdout>>,
      cfg: &Config,
      base_url: &str,
  ) -> Result<Option<Credentials>> {
      // Fast path: try saved refresh token.
      if let Some(rt) = &cfg.refresh_token {
          let mut state = State::new(Step::Entry); // aura running during connect
          state.connecting = true;
          terminal.draw(|f| draw(f, &state))?;

          match http::rotate_token(base_url, rt) {
              Ok(rotated) if rotated.stage != "known" => {
                  return Ok(Some(rotated.credentials));
              }
              Ok(rotated) => {
                  // Covenant update required — fetch text then enter Covenant step.
                  terminal.draw(|f| draw(f, &state))?;
                  let (version, lines) = match http::fetch_covenant(base_url) {
                      Ok(v) => v,
                      Err(e) => return Err(e),
                  };
                  let step = Step::Covenant {
                      name: String::new(),
                      password: String::new(),
                      version,
                      lines,
                      offset: 0,
                      existing_creds: Some(Box::new(rotated.credentials)),
                  };
                  return run_loop(terminal, base_url, step);
              }
              Err(_) => {
                  // Refresh failed — fall through to full reception.
              }
          }
      }

      run_loop(terminal, base_url, Step::Entry)
  }

  // ─── Event loop ───────────────────────────────────────────────────────────────

  fn run_loop(
      terminal: &mut Terminal<CrosstermBackend<io::Stdout>>,
      base_url: &str,
      initial_step: Step,
  ) -> Result<Option<Credentials>> {
      let mut state = State::new(initial_step);
      let tick_rate = Duration::from_millis(100);
      let mut last_tick = Instant::now();

      loop {
          terminal.draw(|f| draw(f, &state))?;

          let timeout = tick_rate
              .checked_sub(last_tick.elapsed())
              .unwrap_or(Duration::ZERO);

          if event::poll(timeout)? {
              let ev = event::read()?;
              match handle_event(&mut state, &ev, terminal, base_url)? {
                  Outcome::Continue => {}
                  Outcome::Done(result) => return Ok(result),
              }
          }

          if last_tick.elapsed() >= tick_rate {
              state.aura.tick(last_tick.elapsed());
              last_tick = Instant::now();
          }
      }
  }

  // ─── Event handler ────────────────────────────────────────────────────────────

  fn handle_event(
      state: &mut State,
      event: &Event,
      terminal: &mut Terminal<CrosstermBackend<io::Stdout>>,
      base_url: &str,
  ) -> Result<Outcome> {
      let Event::Key(key) = event else { return Ok(Outcome::Continue) };
      if key.kind != KeyEventKind::Press { return Ok(Outcome::Continue) }

      // Global: Esc always aborts.
      if key.code == KeyCode::Esc {
          return Ok(Outcome::Done(None));
      }

      match &state.step.clone() {
          Step::Entry => match key.code {
              KeyCode::Char('n') | KeyCode::Char('N') => {
                  state.goto(Step::Name, false);
              }
              KeyCode::Char('r') | KeyCode::Char('R') => {
                  state.goto(Step::ReturningHandle, false);
              }
              _ => {}
          },

          Step::Name => match key.code {
              KeyCode::Enter => {
                  let name = state.input.trim().to_string();
                  if name.is_empty() {
                      state.error = Some("name cannot be empty".into());
                  } else {
                      state.goto(Step::Password { name }, false);
                      state.mask_input = true;
                  }
              }
              KeyCode::Backspace => { state.input.pop(); }
              KeyCode::Char(c) => { state.input.push(c); }
              _ => {}
          },

          Step::Password { name } => {
              let name = name.clone();
              match key.code {
                  KeyCode::Enter => {
                      let password = state.input.trim().to_string();
                      if password.is_empty() {
                          state.error = Some("password cannot be empty".into());
                      } else {
                          // Show connecting, then register.
                          state.connecting = true;
                          state.error = None;
                          terminal.draw(|f| draw(f, state))?;

                          match http::register_seeker(base_url, &name, &password) {
                              Ok((creds, handle)) => {
                                  state.connecting = false;
                                  // Fetch covenant text.
                                  terminal.draw(|f| draw(f, state))?;
                                  let (version, lines) = http::fetch_covenant(base_url)?;
                                  let step = Step::Covenant {
                                      name: handle,
                                      password,
                                      version,
                                      lines,
                                      offset: 0,
                                      existing_creds: Some(Box::new(creds)),
                                  };
                                  state.goto(step, false);
                              }
                              Err(e) => {
                                  state.connecting = false;
                                  let msg = e.to_string();
                                  if msg.contains("handle_exhausted") {
                                      state.error = Some("that name has no handles left — try another".into());
                                      state.goto(Step::Name, false);
                                  } else {
                                      state.error = Some(msg);
                                  }
                              }
                          }
                      }
                  }
                  KeyCode::Backspace => { state.input.pop(); }
                  KeyCode::Char(c) => { state.input.push(c); }
                  _ => {}
              }
          }

          Step::Covenant { existing_creds, .. } => {
              // Extract owned copies from the cloned step before any mutable borrows.
              let creds_owned: Option<Credentials> = existing_creds.as_ref().map(|b| {
                  let c = b.as_ref();
                  Credentials {
                      seeker_id: c.seeker_id.clone(),
                      access_token: c.access_token.clone(),
                      refresh_token: c.refresh_token.clone(),
                  }
              });

              match key.code {
                  KeyCode::Char('y') | KeyCode::Char('Y') => {
                      if let Some(creds) = creds_owned {
                          state.connecting = true;
                          terminal.draw(|f| draw(f, state))?;
                          http::accept_covenant(base_url, &creds.access_token)?;
                          return Ok(Outcome::Done(Some(creds)));
                      }
                  }
                  KeyCode::Char('n') | KeyCode::Char('N') => {
                      return Ok(Outcome::Done(None));
                  }
                  KeyCode::Char('j') | KeyCode::Down => {
                      if let Step::Covenant { offset, .. } = &mut state.step {
                          *offset = offset.saturating_add(1);
                      }
                  }
                  KeyCode::Char('k') | KeyCode::Up => {
                      if let Step::Covenant { offset, .. } = &mut state.step {
                          *offset = offset.saturating_sub(1);
                      }
                  }
                  _ => {}
              }
          }

          Step::ReturningHandle => match key.code {
              KeyCode::Enter => {
                  let handle = state.input.trim().to_string();
                  if handle.is_empty() {
                      state.error = Some("handle cannot be empty".into());
                  } else {
                      state.goto(Step::ReturningPassword { handle }, false);
                      state.mask_input = true;
                  }
              }
              KeyCode::Backspace => { state.input.pop(); }
              KeyCode::Char(c) => { state.input.push(c); }
              _ => {}
          },

          Step::ReturningPassword { handle } => {
              let handle = handle.clone();
              match key.code {
                  KeyCode::Enter => {
                      let password = state.input.trim().to_string();
                      if password.is_empty() {
                          state.error = Some("password cannot be empty".into());
                      } else {
                          state.connecting = true;
                          state.error = None;
                          terminal.draw(|f| draw(f, state))?;

                          match http::sign_in(base_url, &handle, &password) {
                              Ok(rotated) if rotated.stage != "known" => {
                                  return Ok(Outcome::Done(Some(rotated.credentials)));
                              }
                              Ok(rotated) => {
                                  state.connecting = false;
                                  terminal.draw(|f| draw(f, state))?;
                                  let (version, lines) = http::fetch_covenant(base_url)?;
                                  let step = Step::Covenant {
                                      name: handle,
                                      password,
                                      version,
                                      lines,
                                      offset: 0,
                                      existing_creds: Some(Box::new(rotated.credentials)),
                                  };
                                  state.goto(step, false);
                              }
                              Err(e) => {
                                  state.connecting = false;
                                  state.error = Some(e.to_string());
                              }
                          }
                      }
                  }
                  KeyCode::Backspace => { state.input.pop(); }
                  KeyCode::Char(c) => { state.input.push(c); }
                  _ => {}
              }
          }
      }

      Ok(Outcome::Continue)
  }

  // ─── State helpers ────────────────────────────────────────────────────────────

  impl State {
      fn new(step: Step) -> Self {
          Self {
              step,
              input: String::new(),
              mask_input: false,
              error: None,
              connecting: false,
              aura: Aura::new(),
          }
      }

      fn goto(&mut self, step: Step, mask: bool) {
          self.step = step;
          self.input.clear();
          self.mask_input = mask;
          self.error = None;
          self.connecting = false;
      }
  }

  // ─── Drawing ──────────────────────────────────────────────────────────────────

  fn draw(frame: &mut Frame, state: &State) {
      let size = frame.size();
      let voice_intensity: f32 = if state.connecting { 0.4 } else { 0.0 };
      state.aura.render(frame, size, voice_intensity);

      match &state.step {
          Step::Covenant { lines, offset, .. } => draw_covenant(frame, lines, *offset, state),
          _ => draw_input_screen(frame, state),
      }
  }

  fn draw_input_screen(frame: &mut Frame, state: &State) {
      let size = frame.size();

      // Centered column, 60 chars wide or full width.
      let width = 60u16.min(size.width.saturating_sub(4));
      let height = 7u16;
      let x = size.x + (size.width.saturating_sub(width)) / 2;
      let y = size.y + (size.height.saturating_sub(height)) / 2;
      let area = Rect { x, y, width, height };

      frame.render_widget(Clear, area);

      let (title, prompt) = step_labels(&state.step);
      let displayed_input = if state.mask_input {
          "•".repeat(state.input.len())
      } else {
          state.input.clone()
      };
      let input_line = if state.connecting {
          "connecting…".to_string()
      } else {
          format!("{prompt}: {displayed_input}")
      };

      let error_line = state.error.as_deref().unwrap_or("");

      let body = format!("{input_line}\n\n{error_line}");
      let widget = Paragraph::new(body)
          .block(
              Block::default()
                  .borders(Borders::ALL)
                  .title(title)
                  .border_style(Style::default().fg(text_accent())),
          )
          .style(Style::default().fg(text_primary()))
          .wrap(Wrap { trim: false });
      frame.render_widget(widget, area);
  }

  fn draw_covenant(frame: &mut Frame, lines: &[String], offset: usize, state: &State) {
      let size = frame.size();
      let width = 70u16.min(size.width.saturating_sub(4));
      let height = 20u16.min(size.height.saturating_sub(4));
      let x = size.x + (size.width.saturating_sub(width)) / 2;
      let y = size.y + (size.height.saturating_sub(height)) / 2;
      let area = Rect { x, y, width, height };

      frame.render_widget(Clear, area);

      let visible = (area.height.saturating_sub(4)) as usize; // subtract border + instructions
      let start = offset.min(lines.len().saturating_sub(1));
      let visible_lines: Vec<&str> = lines[start..]
          .iter()
          .take(visible)
          .map(String::as_str)
          .collect();

      let mut body = visible_lines.join("\n");
      body.push_str("\n\n[y] accept   [n] decline   [j/k] scroll");

      let widget = Paragraph::new(body)
          .block(
              Block::default()
                  .borders(Borders::ALL)
                  .title("The Covenant")
                  .border_style(Style::default().fg(text_accent())),
          )
          .style(Style::default().fg(text_secondary()))
          .wrap(Wrap { trim: true });
      frame.render_widget(widget, area);
  }

  fn step_labels(step: &Step) -> (&'static str, &'static str) {
      match step {
          Step::Entry => ("Ouracle", "[n] new   [r] returning   [Esc] quit"),
          Step::Name => ("New seeker", "name"),
          Step::Password { .. } => ("New seeker", "password"),
          Step::ReturningHandle => ("Welcome back", "handle"),
          Step::ReturningPassword { .. } => ("Welcome back", "password"),
          Step::Covenant { .. } => ("The Covenant", ""),
      }
  }
  ```

- [ ] **Step 2: Build to verify**

  ```bash
  cd ~/house/desk/ouracle/apps/ripltui && cargo build 2>&1
  ```
  Expected: may have errors from `main.rs` still referencing old `reception::Credentials` / `reception::ensure_credentials`. Those get fixed in Task 5.

- [ ] **Step 3: Commit**

  ```bash
  cd ~/house/desk/ouracle/apps/ripltui
  git add src/reception/tui.rs
  git commit -m "feat(reception): implement ratatui step-machine TUI for auth flow"
  ```

---

### Task 5: Rewrite `main.rs`

**Repo:** `~/house/desk/ouracle/apps/ripltui/`

**Files:**
- Modify: `src/main.rs`

- [ ] **Step 1: Rewrite main.rs**

  Replace the entire file with:

  ```rust
  mod provider;
  mod reception;

  use std::fs;
  use std::path::PathBuf;
  use std::sync::Arc;
  use std::time::Duration;

  use color_eyre::eyre::{bail, Result};
  use serde::{Deserialize, Serialize};

  use provider::OuracleProvider;
  use ripl::providers::{Message, Role};
  use ripl::session::SessionCache;

  // ─── Config ───────────────────────────────────────────────────────────────────

  #[derive(Debug, Serialize, Deserialize, Default, Clone)]
  pub struct Config {
      base_url: Option<String>,
      seeker_id: Option<String>,
      access_token: Option<String>,
      refresh_token: Option<String>,
  }

  fn config_path() -> PathBuf {
      let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
      PathBuf::from(home).join(".ouracle").join("ripl.toml")
  }

  fn load_config() -> Config {
      let path = config_path();
      let raw = match fs::read_to_string(&path) {
          Ok(r) => r,
          Err(_) => return Config::default(),
      };
      toml::from_str(&raw).unwrap_or_default()
  }

  fn save_config(cfg: &Config) -> Result<()> {
      let path = config_path();
      if let Some(dir) = path.parent() {
          fs::create_dir_all(dir)?;
      }
      let raw = toml::to_string_pretty(cfg)?;
      fs::write(path, raw)?;
      Ok(())
  }

  fn resolve_base_url(cfg: &Config) -> String {
      std::env::var("OURACLE_BASE_URL")
          .ok()
          .or_else(|| cfg.base_url.clone())
          .unwrap_or_else(|| "http://127.0.0.1:3737".to_string())
  }

  // ─── Session bootstrap ────────────────────────────────────────────────────────

  struct BootstrappedSession {
      session_id: String,
      greeting: Option<String>,
      question: String,
  }

  fn bootstrap_session(base_url: &str, access_token: &str) -> Result<BootstrappedSession> {
      use reqwest::blocking::Client;

      let client = Client::builder().timeout(Duration::from_secs(12)).build()?;

      let covenant = client
          .get(format!("{base_url}/covenant/current"))
          .send()?
          .json::<serde_json::Value>()?;

      let version = covenant
          .get("version")
          .and_then(|v| v.as_str())
          .unwrap_or("1.0");

      let body = serde_json::json!({
          "covenant": {
              "version": version,
              "accepted": true,
              "timestamp": chrono::Utc::now().to_rfc3339(),
          }
      });

      let resp = client
          .post(format!("{base_url}/session/new"))
          .bearer_auth(access_token)
          .json(&body)
          .send()?;

      let status = resp.status().as_u16();
      let json: serde_json::Value = resp.json()?;
      if status >= 400 {
          let msg = json
              .get("error")
              .and_then(|v| v.as_str())
              .unwrap_or("session bootstrap failed");
          bail!("bootstrap failed ({status}): {msg}");
      }

      let session_id = json
          .get("session_id")
          .and_then(|v| v.as_str())
          .unwrap_or("")
          .to_string();
      let question = json
          .get("question")
          .and_then(|v| v.as_str())
          .unwrap_or("...")
          .to_string();
      let greeting = json
          .get("greeting")
          .and_then(|v| v.as_str())
          .map(|s| s.to_string());

      if session_id.is_empty() {
          bail!("bootstrap failed: missing session_id");
      }

      Ok(BootstrappedSession { session_id, greeting, question })
  }

  fn seed_ripl_session(bootstrap: &BootstrappedSession) {
      let mut conversation = Vec::new();
      if let Some(g) = &bootstrap.greeting {
          conversation.push(Message { role: Role::Assistant, content: g.clone() });
      }
      conversation.push(Message { role: Role::Assistant, content: bootstrap.question.clone() });
      ripl::session::save(&SessionCache {
          conversation,
          provider: Some("ouracle".to_string()),
          model: None,
      });
  }

  // ─── Main ─────────────────────────────────────────────────────────────────────

  fn main() -> Result<()> {
      color_eyre::install()?;

      let mut cfg = load_config();
      let base_url = resolve_base_url(&cfg);

      ripl::with_terminal(|terminal| {
          // Phase 1: reception (handles refresh fast-path and full auth flow)
          let creds = reception::tui::ensure_credentials(terminal, &cfg, &base_url)?;
          let Some(creds) = creds else {
              return Ok(()); // user aborted
          };

          // Persist credentials.
          cfg.access_token = Some(creds.access_token.clone());
          cfg.refresh_token = Some(creds.refresh_token.clone());
          cfg.seeker_id = Some(creds.seeker_id.clone());
          cfg.base_url = Some(base_url.clone());
          save_config(&cfg)?;

          // Phase 2: session bootstrap (blocking HTTP while terminal is live).
          let bootstrap = bootstrap_session(&base_url, &creds.access_token)?;
          seed_ripl_session(&bootstrap);

          // Phase 3: RIPL event loop.
          let provider = Arc::new(OuracleProvider::new(
              base_url.clone(),
              creds.access_token.clone(),
              Some(bootstrap.session_id),
          ));
          ripl::run_in_terminal(terminal, Some(provider), Some("Ouracle".to_string()))
      })
  }
  ```

- [ ] **Step 2: Build to verify**

  ```bash
  cd ~/house/desk/ouracle/apps/ripltui && cargo build 2>&1
  ```
  Expected: `Finished`. No errors.

  If there are missing import errors (e.g. `chrono` not in `Cargo.toml`), verify:
  ```bash
  grep chrono apps/ripltui/Cargo.toml
  ```
  It should be there. If not, add:
  ```bash
  cd ~/house/desk/ouracle/apps/ripltui && cargo add chrono --features clock --no-default-features
  ```

- [ ] **Step 3: Smoke test**

  Ensure the API server is running locally:
  ```bash
  cd ~/house/desk/ouracle && bun run dev &
  ```

  Then launch ripltui:
  ```bash
  cd ~/house/desk/ouracle/apps/ripltui && cargo run 2>&1
  ```
  Expected:
  - TUI opens immediately (aura visible, no CLI prompts)
  - If `~/.ouracle/ripl.toml` has a valid refresh token: skip to RIPL loop
  - If no token: Entry step shows `[n] new   [r] returning`
  - New seeker flow: name → password → covenant → RIPL loop
  - Returning seeker flow: handle → password → RIPL loop
  - Esc at any point exits cleanly

- [ ] **Step 4: Commit**

  ```bash
  cd ~/house/desk/ouracle/apps/ripltui
  git add src/main.rs
  git commit -m "feat(main): use with_terminal + run_in_terminal; reception TUI wired up"
  ```

---

### Task 6: Delete `apps/ripl`

**Repo:** `~/house/desk/ouracle/`

**Files:**
- Delete: `apps/ripl/` (entire directory)

- [ ] **Step 1: Confirm `apps/ripl` is not referenced anywhere**

  ```bash
  grep -r "apps/ripl" ~/house/desk/ouracle --include="*.toml" --include="*.md" --include="*.js" --include="*.json" 2>/dev/null
  ```
  Expected: no references (or only the directory itself). If references exist, update them before deleting.

- [ ] **Step 2: Move to Trash**

  ```bash
  trash ~/house/desk/ouracle/apps/ripl
  ```

- [ ] **Step 3: Commit**

  ```bash
  cd ~/house/desk/ouracle
  git rm -r apps/ripl/
  git commit -m "chore: remove superseded apps/ripl (ouracle binary)"
  ```

---

## Done

Both repos should now build cleanly. Verify end-to-end:

```bash
# ripl lib
cd ~/house/desk/ripl && cargo build

# ripltui
cd ~/house/desk/ouracle/apps/ripltui && cargo build

# Confirm dev mode behavior
cd ~/house/desk/ouracle/apps/ripltui
cargo run &           # should open minimal TUI (no dev chrome)
RIPL_DEV=1 cargo run  # should open dev-chrome TUI
```
