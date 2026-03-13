# STT Push-to-Talk + Aura Performance

**Date:** 2026-03-13
**Scope:** `apps/tui` — `app.rs`, `aura.rs`, `main.rs`, `ui.rs`, new `docs/setup/dictation-macos.md`

---

## Problem

1. The existing PTT trigger requires a modifier key (F9 or Alt/Super+Space). Super/Cmd is intercepted by macOS before reaching the terminal; Alt works but is ergonomically awkward for hold-to-talk.
2. No visual feedback distinguishes the recording and transcribing wait states.
3. `aura.rs` recomputes every cell every frame — including during rapid Space repeat bursts (~30hz) — causing CPU saturation visible during screen recording.

---

## Goals

- Plain Space held = start Whisper STT; release = stop and transcribe.
- Quick Space tap = type a space (no regression).
- Aura animates inward while recording, pulses gently while transcribing.
- Aura CPU reduced without changing visual output.
- macOS System Dictation documented as a faster external alternative.

---

## Non-goals

- Integrating macOS dictation output into the TUI input field (platform-specific, brittle).
- Kitty keyboard protocol support (future enhancement; not needed for this design).
- Changing aura aesthetics.

---

## Design

### 1. Space PTT — Repeat-count gate

**Principle:** The OS fires `KeyEventKind::Repeat` at ~30hz when a key is held, but only after an initial delay of ~300–500ms. A typed space generates at most one `Repeat` before release. Waiting for 4 consecutive rapid repeats ensures the trigger fires well into a deliberate hold — approximately 400–530ms after the initial `Press` — and never on a tap.

**New state on `App`:**

```rust
ptt_space_down: bool,
ptt_space_repeat_count: u32,
ptt_space_last_repeat: Option<Instant>,
stt_active_ptt: bool,         // true = this recording was started by Space hold
stt_ripple_accum_ms: f32,     // ms since last inward ripple launch (see §2a)
aura_last_render: Instant,    // initialized to Instant::now() in App::new()
```

**Event routing:** Bare `KeyCode::Char(' ')` currently falls through to `on_event`'s character-input arm. The Space PTT handler must be inserted at the **top of `on_event`**, before the `match code` block, as a dedicated function `handle_space_ptt(code, kind)` — analogous to but separate from `handle_ptt_event`. It returns `true` if it consumed the event (preventing the character arm from also processing it).

Space PTT is **disabled** while `awaiting_consent`, `awaiting_name`, or `awaiting_password` are true — in these modes the input field is collecting structured text and Space must type normally. Add a guard at the top of `handle_space_ptt`.

**Event handling:**

| Event | Condition | Action |
|---|---|---|
| Space `Press` | PTT enabled (not awaiting text prompt) | Arm: `ptt_space_down = true`, count = 0, `last_repeat = now`. Return consumed. |
| Space `Press` | PTT disabled | Return not-consumed (falls through to char input). |
| Space `Repeat` | `ptt_space_down` and elapsed since `last_repeat` < 150ms | Increment count, update `last_repeat`. If count ≥ 4 and not recording → `start_stt_recording()`, `stt_active_ptt = true`. Return consumed. |
| Space `Repeat` | `ptt_space_down` and elapsed ≥ 150ms | Gap too large; disarm (`ptt_space_down = false`). Return not-consumed. |
| Space `Release` | `stt_active_ptt` | `stop_stt_recording()`, clear all ptt state. Return consumed. |
| Space `Release` | `ptt_space_down` and not `stt_active_ptt` | Clear ptt state. Push `' '` to `app.input`. Return consumed. |
| — | `on_tick`: `ptt_space_down` and `last_repeat` elapsed > 300ms | Infer release: if `stt_active_ptt` → `stop_stt_recording()`, clear ptt state; elif count < 4 → push `' '`, clear ptt state; else → clear ptt state silently (recording never started). |

**Existing triggers unchanged:** F9 and modifier+Space (`handle_ptt_event` / `is_ptt_key`) continue to work as immediate toggles, unaffected.

---

### 2. Aura voice-state feedback

#### 2a. Recording — inward ripple

Add a `direction` field to `Ripple`:

```rust
pub enum RippleDir { Outward, Inward }

pub struct Ripple {
    // existing fields...
    pub direction: RippleDir,
}
```

All existing ripples default to `RippleDir::Outward`. Update `ripple_energy` to branch on direction:
- Outward (existing): `center_r = start_radius + speed * age * (1.0 + wobble)`
- Inward: `center_r = (start_radius - speed * age).max(0.0)`

**Inward ripple parameters:** `strength: 0.4`, `speed: 0.25`, `width: 0.12`, `start_radius: 1.6`, `direction: Inward`

Note: `ring_end = 1.0 + 0.35 = 1.35`. An inward ripple launched at `start_radius: 1.6` enters the visible ring band at `age ≈ 1.0s` (`(1.6 - 1.35) / 0.25`) and reaches the hole edge at `age = 2.4s`. It is invisible for its first second — this is intentional; the ripple "drops in" from beyond the ring edge.

**Launch cadence:** `on_tick` fires every ~100ms. Use `stt_ripple_accum_ms` (new field on `App`, `f32`) to accumulate elapsed ms. While `stt_recording`, add `dt_ms` each tick; when `stt_ripple_accum_ms >= 500.0`, call `aura.launch_inward_ripple()` and reset to 0. Reset `stt_ripple_accum_ms` to 0 when recording stops.

Add `launch_inward_ripple` to `Aura`:

```rust
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

#### 2b. Transcribing — held glow

While `stt_transcribe_rx.is_some()`, set `voice_target` toward `0.35` in `on_tick`. Uses existing smoothing (`voice_intensity` lerps toward `voice_target`). No new ripple type needed.

`voice_intensity` target table:

| State | `voice_target` |
|---|---|
| Idle | 0.0 |
| Recording | 0.0 (inward ripples provide visual) |
| Transcribing | 0.35 |
| TTS playing | existing behavior (unchanged) |

#### 2c. UI indicator

In the input area of `ui.rs`, show a status suffix when STT is active:

- `stt_recording` → `[ ● rec ]` in accent color
- `stt_transcribe_rx.is_some()` → `[ … ]` in fade color
- `stt_error.is_some()` → `[ stt error ]` in warning color (already partially surfaced)

---

### 3. Aura performance

Three surgical fixes. No visual change.

#### 3a. Hoist `hole_geometry` out of inner loop

`hole_geometry(area)` is currently called inside the per-cell loop (line 176 of `aura.rs`). Move it to before the loop alongside `cx`, `cy`, `max_dist`. One line relocated.

#### 3b. Decouple aura render cadence

`aura_last_render` lives on `App` (not in `app_loop`) so it is accessible inside the draw closure:

```rust
// on App:
pub aura_last_render: Instant,
```

In `app_loop`, compute the flag before drawing:

```rust
const AURA_FRAME_MS: u64 = 150;
let render_aura = app.aura_last_render.elapsed().as_millis() >= AURA_FRAME_MS as u128;
terminal.draw(|frame| ui::draw(frame, &mut app, render_aura))?;
if render_aura {
    app.aura_last_render = Instant::now();
}
```

`ui::draw` signature becomes `pub fn draw(frame: &mut Frame, app: &mut App, render_aura: bool)`. Inside `draw`, gate `app.aura.render(...)` on `render_aura`.

Input, cursor, and all text widgets still redraw every loop iteration at full rate. ratatui's buffer diff means unchanged aura cells produce zero terminal output on skipped frames — pure-typing frames are faster.

#### 3c. Replace RNG with `noise3` in glyph selection

`glyph_for_energy_stochastic` currently takes `&mut self` because it calls:
- `self.rng.gen::<f32>()` twice (dot-count bias rolls, Braille mode)
- `self.rng.gen_range(0..list.len())` (Braille index)
- `sample_tier(&mut self.rng, ...)` (all other modes)

Replace all of these with `self.noise3(col, row, self.frame + salt)` using distinct salt values (e.g. 100, 200, 300) to decorrelate the hash streams. Update `sample_tier` to accept `noise: f32` instead of `rng: &mut StdRng` and derive the index via `(noise * len as f32) as usize`. Pass `col` and `row` down from the render loop to `glyph_for_energy_stochastic`.

After this change `glyph_for_energy_stochastic` and `sample_tier` take `&self`. `self.rng` is no longer mutated during render; it remains on `Aura` for any future use.

---

### 4. macOS dictation docs

New file: `docs/setup/dictation-macos.md`

Contents:
- Enable: System Settings → Keyboard → Dictation → On
- Shortcut: F5 or double-press Fn/Globe key
- Caveat: dictation output writes to the terminal's scroll buffer via the OS Accessibility layer — it bypasses crossterm's raw-mode event queue and does not land in the TUI input field
- Recommendation: use Space-hold (Whisper) for in-TUI voice input; use macOS dictation outside the TUI in standard terminal sessions or other apps

---

## Files changed

| File | Change |
|---|---|
| `apps/tui/src/app.rs` | Add `ptt_space_*` + `stt_active_ptt` + `stt_ripple_accum_ms` + `aura_last_render`; add `handle_space_ptt`; update `on_tick` for ripple launch + transcribing `voice_target`; PTT disabled guard for prompt modes |
| `apps/tui/src/aura.rs` | Add `RippleDir` to `Ripple`; add `launch_inward_ripple`; update `ripple_energy` for inward branch; hoist `hole_geometry`; replace RNG with `noise3` in `glyph_for_energy_stochastic` + `sample_tier`; pass `col`/`row` from render loop |
| `apps/tui/src/main.rs` | Add `AURA_FRAME_MS`; compute `render_aura` flag; update `terminal.draw` call site to pass flag; update `aura_last_render` after draw |
| `apps/tui/src/ui.rs` | Add `render_aura: bool` param to `draw`; gate `aura.render()` on flag; render STT status tag in input area |
| `docs/setup/dictation-macos.md` | New — macOS dictation setup guide |
