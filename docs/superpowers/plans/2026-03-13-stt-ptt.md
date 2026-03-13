# STT Push-to-Talk + Aura Performance Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Space hold-to-talk into the Whisper STT pipeline, add inward aura animation during recording, and reduce aura CPU by 40–50%.

**Architecture:** Space PTT is a new state machine (`handle_space_ptt`) inserted at the top of `on_event`, gated by repeat-count. Aura gains a `RippleDir` enum and an inward ripple type. Performance fixes are surgical: one line hoisted, one render cadence decoupled, one RNG dependency replaced with the existing `noise3` hash.

**Tech Stack:** Rust, ratatui 0.30, crossterm 0.29, `cargo build`/`cargo run` from `apps/tui/`

---

## Chunk 1: Aura performance

### Task 1: Hoist `hole_geometry` out of inner render loop

**Files:**
- Modify: `apps/tui/src/aura.rs` (render method, ~line 176)

- [ ] **Step 1: Write a test confirming hole geometry is consistent**

Add at the bottom of `apps/tui/src/aura.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use ratatui::layout::Rect;

    #[test]
    fn hole_geometry_is_deterministic() {
        let area = Rect { x: 0, y: 0, width: 120, height: 40 };
        let (hx1, hy1, cx1, cy1) = hole_geometry(area);
        let (hx2, hy2, cx2, cy2) = hole_geometry(area);
        assert_eq!(hx1, hx2);
        assert_eq!(hy1, hy2);
        assert_eq!(cx1, cx2);
        assert_eq!(cy1, cy2);
    }
}
```

- [ ] **Step 2: Run test to verify it passes (baseline)**

```bash
cd apps/tui && cargo test hole_geometry_is_deterministic -- --nocapture
```
Expected: PASS

- [ ] **Step 3: Hoist `hole_geometry` out of the loop**

In `aura.rs`, the `render` method has this inside the `for row`/`for col` loop:
```rust
// Match hole size to the 80x24 conversation block.
let (hx, hy, _, _) = hole_geometry(area);
```

Move it to just before the loop, alongside `cx`, `cy`, `max_dist`:
```rust
let cx = area.x as f32 + (area.width as f32 / 2.0);
let cy = area.y as f32 + (area.height as f32 / 2.0);
let max_dist = ((area.width as f32).hypot(area.height as f32)) / 2.0;
let (hx, hy, _, _) = hole_geometry(area);   // ← add this line here

// ... then inside the loop, delete the now-duplicate call
```

Inside the loop, delete:
```rust
// Match hole size to the 80x24 conversation block.
let (hx, hy, _, _) = hole_geometry(area);
```

- [ ] **Step 4: Build**

```bash
cd apps/tui && cargo build 2>&1
```
Expected: no errors, no new warnings

- [ ] **Step 5: Commit**

```bash
cd apps/tui && git add src/aura.rs && git commit -m "perf(aura): hoist hole_geometry out of per-cell loop"
```

---

### Task 2: Replace RNG with `noise3` in glyph selection

**Files:**
- Modify: `apps/tui/src/aura.rs` (`glyph_for_energy_stochastic`, `sample_tier`, `render`)

- [ ] **Step 1: Write failing tests**

Add to the `#[cfg(test)]` block in `aura.rs`:

```rust
    #[test]
    fn noise3_range() {
        let aura = Aura::new();
        for x in 0..10u32 {
            for y in 0..10u32 {
                for z in 0..10u64 {
                    let v = aura.noise3(x, y, z);
                    assert!(v >= 0.0 && v <= 1.0, "noise3({x},{y},{z}) = {v}");
                }
            }
        }
    }

    #[test]
    fn sample_tier_noise_bounds() {
        let tier = &['a', 'b', 'c', 'd'];
        // noise 0.0 → index 0
        assert_eq!(sample_tier(0.0, tier), 'a');
        // noise 0.999 → last index
        let idx = (0.999_f32 * tier.len() as f32) as usize % tier.len();
        assert_eq!(sample_tier(0.999, tier), tier[idx]);
        // never panics with empty tier
        assert_eq!(sample_tier(0.5, &[]), ' ');
    }
```

- [ ] **Step 2: Run tests to verify they fail (sample_tier signature mismatch)**

```bash
cd apps/tui && cargo test noise3_range sample_tier_noise_bounds 2>&1 | head -30
```
Expected: compile error — `sample_tier` signature doesn't match yet

- [ ] **Step 3: Update `sample_tier` to take `noise: f32` instead of `rng`**

Replace:
```rust
fn sample_tier(rng: &mut StdRng, tier: &[char]) -> char {
    if tier.is_empty() {
        return ' ';
    }
    let idx = rng.gen_range(0..tier.len());
    tier[idx]
}
```

With:
```rust
fn sample_tier(noise: f32, tier: &[char]) -> char {
    if tier.is_empty() {
        return ' ';
    }
    let idx = (noise * tier.len() as f32) as usize % tier.len();
    tier[idx]
}
```

- [ ] **Step 4: Update `glyph_for_energy_stochastic` signature and body**

Change signature from:
```rust
fn glyph_for_energy_stochastic(&mut self, e: f32, _noise: f32) -> (char, u8) {
```
To:
```rust
fn glyph_for_energy_stochastic(&self, e: f32, _noise: f32, col: u32, row: u32) -> (char, u8) {
```

In the `AuraGlyphMode::Braille` arm, replace the two RNG calls:
```rust
// OLD:
let roll = self.rng.r#gen::<f32>();
// ...
let idx = self.rng.gen_range(0..list.len());

// NEW:
let roll = self.noise3(col, row, self.frame.wrapping_add(100));
// ...
let idx_noise = self.noise3(col, row, self.frame.wrapping_add(200));
let idx = (idx_noise * list.len() as f32) as usize % list.len().max(1);
```

For all other mode arms, replace `sample_tier(&mut self.rng, ...)` with `sample_tier(self.noise3(col, row, self.frame.wrapping_add(300)), ...)`:
```rust
AuraGlyphMode::Taz => {
    let ch = sample_tier(self.noise3(col, row, self.frame.wrapping_add(300)), TAZ_TIERS[tier]);
    (ch, (tier + 1) as u8)
}
AuraGlyphMode::Math => {
    let ch = sample_tier(self.noise3(col, row, self.frame.wrapping_add(300)), MATH_TIERS[tier]);
    (ch, (tier + 1) as u8)
}
AuraGlyphMode::Mahjong => {
    let ch = sample_tier(self.noise3(col, row, self.frame.wrapping_add(300)), MAHJONG_TIERS[tier]);
    (ch, (tier + 1) as u8)
}
AuraGlyphMode::Dominoes => {
    let ch = sample_tier(self.noise3(col, row, self.frame.wrapping_add(300)), DOMINOES_TIERS[tier]);
    (ch, (tier + 1) as u8)
}
AuraGlyphMode::Cards => {
    let ch = sample_tier(self.noise3(col, row, self.frame.wrapping_add(300)), CARDS_TIERS[tier]);
    (ch, (tier + 1) as u8)
}
```

- [ ] **Step 5: Update the two call sites in `render`**

Find the two calls to `glyph_for_energy_stochastic` inside the `for row`/`for col` loop and add `col as u32, row as u32`:

```rust
// mist section (inside `if e < ring_start` block):
let (ch, _) = self.glyph_for_energy_stochastic(mist, noise, col as u32, row as u32);

// ring section (near end of loop):
let (ch, _tier) = self.glyph_for_energy_stochastic(energy, noise, col as u32, row as u32);
```

- [ ] **Step 6: Run tests**

```bash
cd apps/tui && cargo test noise3_range sample_tier_noise_bounds 2>&1
```
Expected: both PASS

- [ ] **Step 7: Build and visually verify aura still looks correct**

```bash
cd apps/tui && cargo run 2>&1
```
Expected: aura renders, braille/taz/math modes look the same as before (still animated, no frozen patterns)

- [ ] **Step 8: Commit**

```bash
cd apps/tui && git add src/aura.rs && git commit -m "perf(aura): replace per-cell RNG with noise3 hash in glyph selection"
```

---

### Task 3: Decouple aura render cadence

**Files:**
- Modify: `apps/tui/src/app.rs` (struct + `new`)
- Modify: `apps/tui/src/main.rs` (app_loop)
- Modify: `apps/tui/src/ui.rs` (`draw` signature)

- [ ] **Step 1: Add `aura_last_render` to `App`**

In `app.rs`, add to the `App` struct (near `cursor_dirty`):
```rust
pub aura_last_render: Instant,
```

In `App::new()`, add to the initialization block:
```rust
aura_last_render: Instant::now(),
```

- [ ] **Step 2: Update `ui::draw` signature**

In `ui.rs`, change:
```rust
pub fn draw(frame: &mut Frame, app: &mut App) {
```
To:
```rust
pub fn draw(frame: &mut Frame, app: &mut App, render_aura: bool) {
```

Gate the aura render call. Find:
```rust
app.aura.render(frame, size, app.voice_intensity);
```
Replace with:
```rust
if render_aura {
    app.aura.render(frame, size, app.voice_intensity);
}
```

- [ ] **Step 3: Update the call site in `main.rs`**

In `app_loop` in `main.rs`, add the constant before the loop:
```rust
const AURA_FRAME_MS: u128 = 150;
```

Inside the loop, replace:
```rust
terminal.draw(|frame| ui::draw(frame, &mut app))?;
```
With:
```rust
let render_aura = app.aura_last_render.elapsed().as_millis() >= AURA_FRAME_MS;
terminal.draw(|frame| ui::draw(frame, &mut app, render_aura))?;
if render_aura {
    app.aura_last_render = Instant::now();
}
```

- [ ] **Step 4: Build**

```bash
cd apps/tui && cargo build 2>&1
```
Expected: no errors

- [ ] **Step 5: Run and verify aura still animates, typing feels instant**

```bash
cd apps/tui && cargo run 2>&1
```
Type quickly — cursor should move instantly. Aura should still breathe and ripple smoothly.

- [ ] **Step 6: Commit**

```bash
cd apps/tui && git add src/app.rs src/main.rs src/ui.rs && git commit -m "perf(aura): decouple aura render to 150ms cadence, keep input at full rate"
```

---

## Chunk 2: Inward ripple + Space PTT + UI

### Task 4: Add `RippleDir` and inward ripple math

**Files:**
- Modify: `apps/tui/src/aura.rs`

- [ ] **Step 1: Write a failing test for inward ripple energy**

Add to the `#[cfg(test)]` block:
```rust
    #[test]
    fn inward_ripple_energy_at_center_r() {
        let mut aura = Aura::new();
        // Launch at time_s=0. Advance 400ms → center_r = 1.6 - 0.25*0.4 = 1.5.
        aura.launch_inward_ripple();
        aura.tick(std::time::Duration::from_millis(400));
        // At r=1.5, dr=0, ring_env=1, energy ≈ strength*1*time_env ≈ 0.4.
        let energy = aura.ripple_energy(1.5, 0.0, 0.0, 0.5, 0.5);
        assert!(energy > 0.3, "expected energy > 0.3 at center of inward ripple, got {energy}");
    }

    #[test]
    fn inward_ripple_zero_after_contraction() {
        let mut aura = Aura::new();
        aura.launch_inward_ripple();
        // Advance 7s: center_r = (1.6 - 0.25*7).max(0) = 0.
        // At r=1.5, dr=1.5 >> width=0.12 → ring_env=0 → energy=0.
        aura.tick(std::time::Duration::from_secs(7));
        let energy = aura.ripple_energy(1.5, 0.0, 0.0, 0.5, 0.5);
        assert!(energy < 0.001, "expected ~0 after inward ripple contracts, got {energy}");
    }

    #[test]
    fn outward_ripples_all_have_outward_direction() {
        let mut aura = Aura::new();
        aura.launch_ripples(0.7, 1.0);
        assert!(!aura.ripples.is_empty());
        for r in &aura.ripples {
            assert_eq!(r.direction, RippleDir::Outward);
        }
        let area = ratatui::layout::Rect { x: 0, y: 0, width: 120, height: 40 };
        aura.launch_ripple_at(0, 0, area, 1.0); // click outside hole
        for r in &aura.ripples {
            assert_eq!(r.direction, RippleDir::Outward);
        }
    }
```

- [ ] **Step 2: Run tests to see them fail**

```bash
cd apps/tui && cargo test inward_ripple outward_ripple 2>&1 | head -20
```
Expected: compile error — `RippleDir`, `launch_inward_ripple` don't exist yet

- [ ] **Step 3: Add `RippleDir` enum**

Add just below the `AuraGlyphMode` enum in `aura.rs`:
```rust
/// Direction of a ripple — outward from center or inward toward it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RippleDir {
    Outward,
    Inward,
}
```

- [ ] **Step 4: Add `direction` field to `Ripple`**

In the `Ripple` struct, add:
```rust
pub struct Ripple {
    pub t0: f32,
    pub speed: f32,
    pub width: f32,
    pub strength: f32,
    pub center: Option<(f32, f32)>,
    pub start_radius: f32,
    pub direction: RippleDir,    // ← new
}
```

- [ ] **Step 5: Update all existing `Ripple` constructors to include `direction: RippleDir::Outward`**

In `launch_ripples`, add `direction: RippleDir::Outward` to the `Ripple { ... }` literal.

In `launch_ripple_at`, add `direction: RippleDir::Outward` to the `Ripple { ... }` literal.

- [ ] **Step 6: Update `ripple_energy` to branch on direction**

Find in `ripple_energy`:
```rust
let center_r = ripple.start_radius + ripple.speed * age * (1.0 + wobble);
```
Replace with:
```rust
let center_r = match ripple.direction {
    RippleDir::Outward => ripple.start_radius + ripple.speed * age * (1.0 + wobble),
    RippleDir::Inward => (ripple.start_radius - ripple.speed * age).max(0.0),
};
```

- [ ] **Step 7: Add `launch_inward_ripple` to `Aura`**

Add this method to the `impl Aura` block:
```rust
/// Launch an inward-contracting ripple — used during STT recording to
/// signal "listening / gathering". Enters the visible ring band ~1s after
/// launch and reaches the hole edge at ~2.4s.
pub fn launch_inward_ripple(&mut self) {
    self.ripples.push(Ripple {
        t0: self.time_s,
        speed: 0.25,
        width: 0.12,
        strength: 0.4,
        center: None,
        start_radius: 1.6,
        direction: RippleDir::Inward,
    });
}
```

- [ ] **Step 8: Run tests**

```bash
cd apps/tui && cargo test inward_ripple outward_ripple 2>&1
```
Expected: all three PASS

- [ ] **Step 9: Build and verify aura still renders correctly**

```bash
cd apps/tui && cargo build 2>&1
```
Expected: no errors

- [ ] **Step 10: Commit**

```bash
cd apps/tui && git add src/aura.rs && git commit -m "feat(aura): add RippleDir enum and inward ripple type for STT recording feedback"
```

---

### Task 5: Space PTT state machine

**Files:**
- Modify: `apps/tui/src/app.rs`

- [ ] **Step 1: Write failing tests for PTT state machine**

Add a `#[cfg(test)]` block at the bottom of `app.rs`:
```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crossterm::event::KeyEventKind;

    fn make_space_press() -> (KeyCode, KeyEventKind) {
        (KeyCode::Char(' '), KeyEventKind::Press)
    }

    fn make_space_repeat() -> (KeyCode, KeyEventKind) {
        (KeyCode::Char(' '), KeyEventKind::Repeat)
    }

    fn make_space_release() -> (KeyCode, KeyEventKind) {
        (KeyCode::Char(' '), KeyEventKind::Release)
    }

    #[test]
    fn space_tap_inserts_space() {
        let mut app = App::new();
        let (code, kind) = make_space_press();
        assert!(app.handle_space_ptt(code, kind)); // consumed
        let (code, kind) = make_space_release();
        assert!(app.handle_space_ptt(code, kind)); // consumed
        assert_eq!(app.input, " ");
        assert!(!app.stt_recording);
    }

    #[test]
    fn space_ptt_disabled_during_consent() {
        let mut app = App::new();
        app.awaiting_consent = true;
        let (code, kind) = make_space_press();
        assert!(!app.handle_space_ptt(code, kind)); // not consumed
    }

    #[test]
    fn space_ptt_disabled_during_name_prompt() {
        let mut app = App::new();
        app.awaiting_name = true;
        let (code, kind) = make_space_press();
        assert!(!app.handle_space_ptt(code, kind));
    }
}
```

- [ ] **Step 2: Run tests to see them fail**

```bash
cd apps/tui && cargo test space_tap space_ptt_disabled 2>&1 | head -20
```
Expected: compile error — `handle_space_ptt` does not exist

- [ ] **Step 3: Add new state fields to `App`**

In the `App` struct, add (alongside the other `stt_*` fields):
```rust
pub ptt_space_down: bool,
pub ptt_space_repeat_count: u32,
pub ptt_space_last_repeat: Option<Instant>,
pub stt_active_ptt: bool,
pub stt_ripple_accum_ms: f32,
```

In `App::new()`, add:
```rust
ptt_space_down: false,
ptt_space_repeat_count: 0,
ptt_space_last_repeat: None,
stt_active_ptt: false,
stt_ripple_accum_ms: 0.0,
```

- [ ] **Step 4: Add `clear_ptt_space_state` helper**

Add to `impl App`:
```rust
fn clear_ptt_space_state(&mut self) {
    self.ptt_space_down = false;
    self.ptt_space_repeat_count = 0;
    self.ptt_space_last_repeat = None;
    self.stt_active_ptt = false;
}
```

- [ ] **Step 5: Add `handle_space_ptt`**

Add to `impl App`:
```rust
/// Returns true if the event was consumed by the Space PTT handler.
/// Space PTT is disabled during structured text prompts (consent, name, password).
pub fn handle_space_ptt(&mut self, code: KeyCode, kind: KeyEventKind) -> bool {
    if code != KeyCode::Char(' ') {
        return false;
    }
    if self.awaiting_consent || self.awaiting_name || self.awaiting_password {
        return false;
    }
    match kind {
        KeyEventKind::Press => {
            self.ptt_space_down = true;
            self.ptt_space_repeat_count = 0;
            self.ptt_space_last_repeat = Some(Instant::now());
            true
        }
        KeyEventKind::Repeat => {
            if !self.ptt_space_down {
                return false;
            }
            let elapsed_ms = self.ptt_space_last_repeat
                .map(|t| t.elapsed().as_millis())
                .unwrap_or(u128::MAX);
            if elapsed_ms >= 150 {
                // Gap too large — disarm, let the char fall through next press.
                self.ptt_space_down = false;
                self.ptt_space_repeat_count = 0;
                self.ptt_space_last_repeat = None;
                return false;
            }
            self.ptt_space_last_repeat = Some(Instant::now());
            self.ptt_space_repeat_count += 1;
            if self.ptt_space_repeat_count >= 4 && !self.stt_recording {
                self.start_stt_recording();
                self.stt_active_ptt = true;
            }
            true
        }
        KeyEventKind::Release => {
            if !self.ptt_space_down {
                return false;
            }
            let was_active_ptt = self.stt_active_ptt;
            let count = self.ptt_space_repeat_count;
            self.clear_ptt_space_state();
            if was_active_ptt {
                self.stop_stt_recording();
            } else if count < 4 {
                self.input.push(' ');
            }
            // count >= 4 but stt_recording was already true (started by F9 etc.): no-op
            true
        }
    }
}
```

- [ ] **Step 6: Run tests**

```bash
cd apps/tui && cargo test space_tap space_ptt_disabled 2>&1
```
Expected: all PASS

- [ ] **Step 7: Build**

```bash
cd apps/tui && cargo build 2>&1
```
Expected: no errors

- [ ] **Step 8: Commit**

```bash
cd apps/tui && git add src/app.rs && git commit -m "feat(app): add Space PTT state machine with repeat-count gate"
```

---

### Task 6: Wire PTT into `on_event` and `on_tick`

**Files:**
- Modify: `apps/tui/src/app.rs`

- [ ] **Step 1: Wire `handle_space_ptt` into `on_event`**

In `on_event`, find the existing call to `handle_ptt_event` at the top of the `Event::Key` arm:
```rust
Event::Key(KeyEvent { code, modifiers, kind, .. }) => {
    if self.handle_ptt_event(*code, *modifiers, *kind) {
        return (false, None);
    }
```

Insert `handle_space_ptt` **before** `handle_ptt_event`:
```rust
Event::Key(KeyEvent { code, modifiers, kind, .. }) => {
    if self.handle_space_ptt(*code, *kind) {
        return (false, None);
    }
    if self.handle_ptt_event(*code, *modifiers, *kind) {
        return (false, None);
    }
```

- [ ] **Step 2: Add tick-based release inference and ripple launch to `on_tick`**

In `on_tick`, after the existing `stt_recording` timeout block (the 60-second limit), add:

```rust
// Tick-based Space PTT release inference (for terminals without KeyRelease).
if self.ptt_space_down {
    let elapsed_ms = self.ptt_space_last_repeat
        .map(|t| t.elapsed().as_millis())
        .unwrap_or(u128::MAX);
    if elapsed_ms > 300 {
        let was_active_ptt = self.stt_active_ptt;
        let count = self.ptt_space_repeat_count;
        self.clear_ptt_space_state();
        if was_active_ptt {
            self.stop_stt_recording();
        } else if count < 4 {
            self.input.push(' ');
        }
        // else: threshold reached but recording never started (error path) — discard
    }
}

// Inward ripple launch cadence while recording.
if self.stt_recording {
    self.stt_ripple_accum_ms += delta.as_secs_f32() * 1000.0;
    if self.stt_ripple_accum_ms >= 500.0 {
        self.stt_ripple_accum_ms -= 500.0;
        self.aura.launch_inward_ripple();
    }
} else {
    self.stt_ripple_accum_ms = 0.0;
}
```

- [ ] **Step 3: Add transcribing glow to `on_tick`**

Find the entire `stt_transcribe_rx` polling block in `on_tick` (around line 304) and replace it wholesale:

```rust
// OLD block — replace entirely:
if let Some(rx) = &self.stt_transcribe_rx {
    if let Ok(result) = rx.try_recv() {
        self.stt_transcribe_rx = None;
        match result {
            Ok(text) => {
                let text = text.trim();
                if !text.is_empty() {
                    if !self.input.is_empty() && !self.input.ends_with(' ') {
                        self.input.push(' ');
                    }
                    self.input.push_str(text);
                }
            }
            Err(err) => {
                self.stt_error = Some(err);
            }
        }
    }
}
```

Replace with:

```rust
if let Some(rx) = &self.stt_transcribe_rx {
    if let Ok(result) = rx.try_recv() {
        // Drop the transcribing glow before clearing the receiver.
        if self.voice_target <= 0.35 {
            self.voice_target = 0.0;
        }
        self.stt_transcribe_rx = None;
        match result {
            Ok(text) => {
                let text = text.trim();
                if !text.is_empty() {
                    if !self.input.is_empty() && !self.input.ends_with(' ') {
                        self.input.push(' ');
                    }
                    self.input.push_str(text);
                }
            }
            Err(err) => {
                self.stt_error = Some(err);
            }
        }
    }
}
// Held glow while still waiting for transcription result.
if self.stt_transcribe_rx.is_some() && self.voice_target < 0.35 {
    self.voice_target = 0.35;
}
```

- [ ] **Step 4: Build**

```bash
cd apps/tui && cargo build 2>&1
```
Expected: no errors

- [ ] **Step 5: Run and manually test PTT**

```bash
cd apps/tui && cargo run 2>&1
```

Manual checks:
- Type a sentence including spaces — spaces should appear normally
- Hold Space (hold for ~1.5s) — after ~0.5s, `stt_recording` indicator should appear in dev mode status
- Release — recording stops, `[ … ]` indicator should briefly appear
- Hold Space during name/consent prompt — should type spaces normally, no recording

- [ ] **Step 6: Commit**

```bash
cd apps/tui && git add src/app.rs && git commit -m "feat(app): wire Space PTT into on_event and on_tick with ripple launch"
```

---

### Task 7: STT status indicator in UI

**Files:**
- Modify: `apps/tui/src/ui.rs`
- Modify: `apps/tui/src/theme.rs` (check for existing warning color; add if absent)

- [ ] **Step 1: Add `stt_is_transcribing` accessor to `App`**

`stt_transcribe_rx` is a private field. `ui.rs` is a separate module and cannot access it directly. Add a public accessor in `app.rs`:

```rust
pub fn stt_is_transcribing(&self) -> bool {
    self.stt_transcribe_rx.is_some()
}
```

All UI code in later steps must call `app.stt_is_transcribing()` instead of `app.stt_transcribe_rx.is_some()`.

- [ ] **Step 2: Check what colors are available in theme.rs**

```bash
cd apps/tui && grep -n "pub fn" src/theme.rs
```

Note which color functions exist (e.g., `text_accent`, `text_fade`, `text_primary`, `text_secondary`). We need an accent (for recording) and a fade (for transcribing). These should already exist.

- [ ] **Step 3: Add STT status rendering to the non-dev-mode input area**

In `ui.rs`, the non-dev input rendering is around line 153–183. After `draw_centered_line_sparse(frame, input_area, &app.input, text_primary())`, insert the STT tag:

```rust
draw_centered_line_sparse(frame, input_area, &app.input, text_primary());

// STT status tag — rendered one cell after the cursor position
let stt_tag = if app.stt_recording {
    Some(("[ ● rec ]", text_accent()))
} else if app.stt_is_transcribing() {
    Some(("[ … ]", text_fade(0.6)))
} else if let Some(ref _err) = app.stt_error {
    Some(("[ stt error ]", text_accent()))
} else {
    None
};

if let Some((tag, color)) = stt_tag {
    // Place tag to the right of the cursor
    let input_len = app.input.chars().count();
    let width = input_area.width as usize;
    let pad = width.saturating_sub(input_len) / 2;
    let cursor_x = input_area.x + pad as u16 + input_len as u16;
    let tag_x = cursor_x + 2; // one glyph gap after cursor
    let tag_str = tag.to_string();
    let buf = frame.buffer_mut();
    let mut x = tag_x;
    for ch in tag_str.chars() {
        if x >= input_area.x + input_area.width {
            break;
        }
        if let Some(cell) = buf.cell_mut((x, input_area.y)) {
            let mut sym = [0u8; 4];
            cell.set_symbol(ch.encode_utf8(&mut sym));
            cell.set_style(Style::default().fg(color));
        }
        x += 1;
    }
}
```

- [ ] **Step 4: Add the same tag to dev-mode input area**

In the dev-mode branch (around line 97–109), after the `input_widget` render, add the same STT tag block but using absolute coordinates from `input_area`:

```rust
let stt_tag = if app.stt_recording {
    Some(("[ ● rec ]", text_accent()))
} else if app.stt_is_transcribing() {
    Some(("[ … ]", text_fade(0.6)))
} else if let Some(ref _err) = app.stt_error {
    Some(("[ stt error ]", text_accent()))
} else {
    None
};
if let Some((tag, color)) = stt_tag {
    let tag_x = input_area.x + 1 + app.input.len() as u16 + 3;
    let tag_y = input_area.y + 1;
    let buf = frame.buffer_mut();
    let mut x = tag_x;
    for ch in tag.chars() {
        if x >= input_area.x + input_area.width.saturating_sub(1) {
            break;
        }
        if let Some(cell) = buf.cell_mut((x, tag_y)) {
            let mut sym = [0u8; 4];
            cell.set_symbol(ch.encode_utf8(&mut sym));
            cell.set_style(Style::default().fg(color));
        }
        x += 1;
    }
}
```

- [ ] **Step 5: Build**

```bash
cd apps/tui && cargo build 2>&1
```
Expected: no errors

- [ ] **Step 6: Run and verify indicators appear**

```bash
cd apps/tui && cargo run 2>&1
```

With dev mode on (`/dev on`): hold Space, verify `[ ● rec ]` appears; release, verify `[ … ]` appears briefly then clears.

- [ ] **Step 7: Commit**

```bash
cd apps/tui && git add src/app.rs src/ui.rs && git commit -m "feat(ui): add STT recording/transcribing/error status tag to input area"
```

---

### Task 8: macOS dictation setup docs

**Files:**
- Create: `docs/setup/dictation-macos.md`

- [ ] **Step 1: Create docs/setup directory and write the file**

```bash
mkdir -p /Users/kerry/house/desk/ouracle/docs/setup
```

Create `docs/setup/dictation-macos.md`:

```markdown
# macOS System Dictation Setup

macOS System Dictation is faster than Whisper and requires no external dependencies.
It is **not** integrated into the TUI input field — use it outside ouracle or in
standard terminal sessions.

## Enable

1. Open **System Settings → Keyboard → Dictation**
2. Toggle **Dictation** to **On**
3. Choose a shortcut: **F5** or **Double-press Fn/Globe**

## Use

Press your shortcut, speak, press it again to stop. Text is injected at the cursor.

## Why it doesn't work inside the TUI

ouracle's TUI runs in raw terminal mode with an alternate screen. macOS dictation
injects text via the OS Accessibility layer, which writes to the terminal emulator's
own buffer — not to ouracle's stdin event queue. The typed characters land below the
TUI's rendered area instead of in the input field.

**Use case:** dictation works well for composing long messages in a normal terminal
session, then copying into ouracle. For in-TUI voice input, use **Space hold** (Whisper).

## Recommended in-TUI voice input

Hold **Space** for ~0.5s → recording starts (sox + Whisper)
Release → transcription runs, text appears in input field
```

- [ ] **Step 2: Commit**

```bash
cd /Users/kerry/house/desk/ouracle && git add docs/setup/dictation-macos.md && git commit -m "docs: add macOS system dictation setup guide"
```
