** AURA Prototype **

You’re working inside the Ouracle TUI Priestess in apps/tui.

Context:
- The TUI already talks to the Ouracle MEATAPI via src/api.rs.
- src/app.rs holds App state and drives aura + thread.
- src/ui.rs lays out Status / Thread / Dev panels / Input.
- src/aura.rs currently just draws a color-cycling border.
- The design spec for the aura and conversation is as follows:

``` rust
// ============================
// Cargo.toml (relevant parts)
// ============================
[package]
name = "tui"
version = "0.2.0"
edition = "2024"

[dependencies]
color-eyre = "0.6.5"
crossterm = "0.29.0"
rand = "0.8.5"
ratatui = "0.30.0"
chrono = { version = "0.4.40", default-features = false, features = ["clock"] }
textwrap = "0.16.1"
serde = { version = "1.0.228", features = ["derive"] }
serde_json = "1.0.140"
reqwest = { version = "0.12.14", features = ["blocking","json"] }

// later, for real audio
// cpal = "0.15"
// rodio = "0.19"


// ============================
// src/main.rs
// ============================

use std::io;
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

use color_eyre::eyre::Result;
use crossterm::{
    event::{self, DisableMouseCapture, EnableMouseCapture},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{backend::CrosstermBackend, Terminal};

mod app;
mod ui;
mod aura;
mod api;

use crate::app::App;
use crate::api::{execute as execute_api, ApiRequest, ApiResponse};

fn main() -> Result<()> {
    color_eyre::install()?;
    run()
}

fn run() -> Result<()> {
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen, EnableMouseCapture)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;
    terminal.clear()?;

    let res = app_loop(&mut terminal);

    disable_raw_mode()?;
    execute!(terminal.backend_mut(), DisableMouseCapture, LeaveAlternateScreen)?;
    terminal.show_cursor()?;

    res
}

fn app_loop(terminal: &mut Terminal<CrosstermBackend<io::Stdout>>) -> Result<()> {
    let mut app = App::new();

    // API worker
    let (req_tx, req_rx) = mpsc::channel::<ApiRequest>();
    let (resp_tx, resp_rx) = mpsc::channel::<ApiResponse>();
    thread::spawn(move || {
        while let Ok(req) = req_rx.recv() {
            let resp = execute_api(req);
            let _ = resp_tx.send(resp);
        }
    });

    let mut last_tick = Instant::now();
    let tick_rate = Duration::from_millis(33); // ~30 fps for shimmer/ripples

    loop {
        terminal.draw(|frame| ui::draw(frame, &app))?;

        let timeout = tick_rate
            .checked_sub(last_tick.elapsed())
            .unwrap_or(Duration::from_secs(0));

        if event::poll(timeout)? {
            let ev = event::read()?;
            let (should_quit, maybe_req) = app.on_event(&ev);
            if let Some(req) = maybe_req {
                let _ = req_tx.send(req);
            }
            if should_quit {
                let _ = req_tx.send(ApiRequest::Shutdown);
                return Ok(());
            }
        }

        if app.mouse_capture_dirty {
            if app.mouse_capture {
                execute!(terminal.backend_mut(), EnableMouseCapture)?;
            } else {
                execute!(terminal.backend_mut(), DisableMouseCapture)?;
            }
            app.mouse_capture_dirty = false;
        }

        while let Ok(resp) = resp_rx.try_recv() {
            app.handle_api_response(resp);
        }

        if let Some(req) = app.take_queued_request() {
            let _ = req_tx.send(req);
        }

        if last_tick.elapsed() >= tick_rate {
            let dt = last_tick.elapsed();
            app.on_tick(dt);
            last_tick = Instant::now();
        }
    }
}


// ============================
// src/aura.rs
// ============================

use std::time::Duration;

use rand::{rngs::StdRng, Rng, SeedableRng};
use ratatui::{
    layout::Rect,
    style::{Color, Style},
    text::Span,
    widgets::Paragraph,
    Frame,
};

/// Slow breathing phase of the aura.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BreathPhase {
    Inhale,
    Exhale,
}

/// An expanding ripple started when the Priestess speaks.
#[derive(Debug, Clone)]
pub struct Ripple {
    pub t0: f32,        // launch time (seconds)
    pub speed: f32,     // radial units per second (0..1)
    pub width: f32,     // ring thickness in radial units
    pub strength: f32,  // amplitude 0..1
}

/// Aura state: breathing field + ripples + RNG for puffs.
pub struct Aura {
    /// Global frame counter for cheap animation hooks.
    frame: u64,
    /// Elapsed time in seconds since app start.
    time_s: f32,
    /// Current breath phase (inhale/exhale).
    phase: BreathPhase,
    /// 0..1 position within the current breath.
    breath_t: f32,
    /// Breath duration in seconds (7 breaths/min ≈ 8.571s).
    breath_duration: f32,
    /// Active ripples.
    ripples: Vec<Ripple>,
    /// RNG for light stochastic texture.
    rng: StdRng,
}

impl Aura {
    pub fn new() -> Self {
        Aura {
            frame: 0,
            time_s: 0.0,
            phase: BreathPhase::Inhale,
            breath_t: 0.0,
            breath_duration: 60.0 / 7.0,
            ripples: Vec::new(),
            rng: StdRng::from_entropy(),
        }
    }

    /// Advance time and breath phase.
    pub fn tick(&mut self, dt: Duration) {
        self.frame = self.frame.wrapping_add(1);
        let dt_s = dt.as_secs_f32();
        self.time_s += dt_s;

        // advance breath
        self.breath_t += dt_s / self.breath_duration;
        if self.breath_t >= 1.0 {
            self.breath_t -= 1.0;
            self.phase = match self.phase {
                BreathPhase::Inhale => BreathPhase::Exhale,
                BreathPhase::Exhale => BreathPhase::Inhale,
            };
        }

        // prune old ripples (hard cap on age)
        let max_age = self.breath_duration * 3.0;
        self.ripples.retain(|r| self.time_s - r.t0 <= max_age);
    }

    /// Launch one or more ripples when the Priestess begins speaking.
    pub fn launch_ripples(&mut self, base_strength: f32) {
        let now = self.time_s;
        // Three slightly staggered rings, with gentle jitter.
        for i in 0..3 {
            let jitter = (i as f32) * 0.1;
            let strength = (base_strength * (0.8 + 0.4 * self.rng.gen::<f32>())).clamp(0.0, 1.0);
            let speed = 0.2 + 0.1 * self.rng.gen::<f32>();
            let width = 0.1 + 0.05 * self.rng.gen::<f32>();
            self.ripples.push(Ripple {
                t0: now + jitter,
                speed,
                width,
                strength,
            });
        }
    }

    /// Main render entry. `voice_intensity` is 0..1.
    pub fn render(&self, frame: &mut Frame, area: Rect, voice_intensity: f32) {
        // We render a field of chars into a buffer string and wrap it in a Paragraph.
        // Simple for now: full-screen. Later you can restrict to a band around the inner rect.
        let width = area.width as usize;
        let height = area.height as usize;

        if width == 0 || height == 0 {
            return;
        }

        // Precompute breath envelope.
        let breath_env = self.breath_envelope();

        // Precompute center of the area.
        let cx = area.x as f32 + (area.width as f32 / 2.0);
        let cy = area.y as f32 + (area.height as f32 / 2.0);
        let max_dist = ((area.width as f32).hypot(area.height as f32)) / 2.0;

        let mut lines = String::with_capacity(width * height * 4);

        for row in 0..height {
            for col in 0..width {
                let x = area.x as usize + col;
                let y = area.y as usize + row;

                // radial distance 0..1
                let dx = x as f32 - cx;
                let dy = y as f32 - cy;
                let dist = (dx * dx + dy * dy).sqrt();
                let r = (dist / max_dist).clamp(0.0, 1.0);

                // base energy from breath + distance
                let base_energy = match self.phase {
                    BreathPhase::Inhale => breath_env * (1.0 - r),
                    BreathPhase::Exhale => breath_env * r,
                };

                // add ripple energy
                let ripple_energy = self.ripple_energy(r);

                // simple hash-based noise as tiny perturbation
                let noise = self.noise3(col as u32, row as u32, self.frame) * 0.08;

                // combine with voice intensity (voice speeds/brightens the field a bit)
                let mut energy = base_energy + ripple_energy + noise;
                energy *= 0.7 + 0.3 * voice_intensity;
                let energy = energy.clamp(0.0, 1.0);

                let (ch, _) = Self::glyph_for_energy(energy);

                lines.push(ch);
            }
            lines.push('\n');
        }

        // Choose color palette by energy bands. For now use one hue family and map intensity in the style.
        let aura_text = Span::styled(lines, Style::default().fg(Color::Rgb(15, 35, 60)));
        let p = Paragraph::new(aura_text);
        frame.render_widget(p, area);
    }

    fn breath_envelope(&self) -> f32 {
        // simple sine 0..1
        let s = (std::f32::consts::PI * self.breath_t).sin().max(0.0);
        match self.phase {
            BreathPhase::Inhale => s,
            BreathPhase::Exhale => s,
        }
    }

    fn ripple_energy(&self, r: f32) -> f32 {
        let mut acc = 0.0;
        for ripple in &self.ripples {
            let age = self.time_s - ripple.t0;
            if age < 0.0 {
                continue;
            }
            let center_r = ripple.speed * age;
            let dr = (r - center_r).abs();
            let ring_env = (1.0 - (dr / ripple.width)).clamp(0.0, 1.0);
            let max_age = self.breath_duration * 3.0;
            let time_env = (1.0 - age / max_age).clamp(0.0, 1.0);
            acc += ripple.strength * ring_env * time_env;
        }
        acc
    }

    /// Tiny integer hash → [0,1).
    fn noise3(&self, x: u32, y: u32, z: u64) -> f32 {
        let mut h = x.wrapping_mul(374761393) ^ y.wrapping_mul(668265263) ^ (z as u32).wrapping_mul(2246822519);
        h = (h ^ (h >> 13)).wrapping_mul(1274126177);
        let v = (h ^ (h >> 16)) & 0xffff;
        (v as f32) / 65535.0
    }

    fn glyph_for_energy(e: f32) -> (char, u8) {
        // tier 0: empty, tier 1–3: braille density
        if e < 0.15 {
            (' ', 0)
        } else if e < 0.35 {
            ('⠂', 1)
        } else if e < 0.7 {
            ('⠖', 2)
        } else {
            ('⣿', 3)
        }
    }
}


// ============================
// src/app.rs (only the new bits)
// ============================

use std::time::Duration;

use crossterm::event::{Event, KeyCode, KeyEvent, MouseEventKind};
use rand::{rngs::OsRng, RngCore};

use crate::aura::Aura;
use crate::api::{ApiMeta, ApiRequest, ApiResponse};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AppMode {
    Covenant,
    Inquiry,
    Prescribed,
    Reintegration,
    Complete,
}

pub struct App {
    pub mode: AppMode,
    pub input: String,
    pub messages: Vec<String>,
    pub aura: Aura,

    pub base_url: String,
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
    pub seeker_id: Option<String>,
    pub session_id: Option<String>,

    pub stage: String,
    pub last_turn: Option<u32>,
    pub pending: bool,
    pub dev_mode: bool,
    pub last_meta: Option<ApiMeta>,

    pub submit_history: Vec<String>,
    pub history_index: Option<usize>,
    pub history_offset: usize,

    pub mouse_capture: bool,
    pub mouse_capture_dirty: bool,

    pub pending_seeker_after_consent: bool,
    pub queued_request: Option<ApiRequest>,
    pub pending_begin_after_covenant: bool,

    /// 0..1 scalar driving aura flicker during Priestess speech.
    pub voice_intensity: f32,
    /// Target for voice_intensity; on/off envelope.
    pub voice_target: f32,
}

impl App {
    pub fn new() -> Self {
        App {
            mode: AppMode::Inquiry,
            input: String::new(),
            messages: Vec::new(),
            aura: Aura::new(),
            base_url: std::env::var("OURACLE_API_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:3737".to_string()),
            access_token: None,
            refresh_token: None,
            seeker_id: None,
            session_id: None,
            stage: "disconnected".to_string(),
            last_turn: None,
            pending: false,
            dev_mode: true,
            last_meta: None,
            submit_history: Vec::new(),
            history_index: None,
            history_offset: 0,
            mouse_capture: true,
            mouse_capture_dirty: false,
            pending_seeker_after_consent: false,
            queued_request: None,
            pending_begin_after_covenant: false,
            voice_intensity: 0.0,
            voice_target: 0.0,
        }
    }

    pub fn on_event(&mut self, event: &Event) -> (bool, Option<ApiRequest>) {
        match event {
            Event::Key(KeyEvent { code, .. }) => match code {
                KeyCode::Char('q') if self.input.is_empty() => return (true, None),
                KeyCode::Esc => self.input.clear(),
                KeyCode::Enter => {
                    let line = self.input.trim().to_string();
                    self.input.clear();
                    if line.is_empty() {
                        return (false, None);
                    }
                    self.push_history(&line);
                    let (req, echo) = if line.starts_with('/') {
                        self.parse_command(&line)
                    } else {
                        self.parse_input(&line)
                    };
                    if let Some(msg) = echo {
                        self.push_message(msg);
                    }
                    return (false, req);
                }
                KeyCode::PageUp => {
                    self.history_offset = self.history_offset.saturating_add(5);
                }
                KeyCode::PageDown => {
                    self.history_offset = self.history_offset.saturating_sub(5);
                }
                KeyCode::End => {
                    self.history_offset = 0;
                }
                KeyCode::Up => self.load_prev_history(),
                KeyCode::Down => self.load_next_history(),
                KeyCode::Char(c) => self.input.push(*c),
                KeyCode::Backspace => {
                    self.input.pop();
                }
                _ => {}
            },
            Event::Mouse(mouse) => match mouse.kind {
                MouseEventKind::ScrollUp => {
                    self.history_offset = self.history_offset.saturating_add(3);
                }
                MouseEventKind::ScrollDown => {
                    self.history_offset = self.history_offset.saturating_sub(3);
                }
                _ => {}
            },
            _ => {}
        }
        (false, None)
    }

    pub fn on_tick(&mut self, dt: Duration) {
        // Advance aura time/breath/ripples.
        self.aura.tick(dt);
        // Ease voice_intensity toward voice_target.
        let dt_s = dt.as_secs_f32();
        let rate = 4.0; // seconds to fully rise/fall; tweak freely
        let factor = (dt_s * rate).clamp(0.0, 1.0);
        self.voice_intensity = self.voice_intensity + factor * (self.voice_target - self.voice_intensity);
    }

    // parse_input, parse_command, handle_api_response, history helpers, etc.
    // remain structurally as in your current app.rs, with one key addition:
    // when a Priestess line begins, we set voice_target and launch ripples.

    fn push_message(&mut self, msg: String) {
        // crude: detect Priestess lines by prefix
        let is_priestess = msg.starts_with("Priestess") || msg.starts_with("Rite:")
            || msg.starts_with("Witness:") || msg.starts_with("Shift:")
            || msg.starts_with("Next:");
        if is_priestess {
            // raise voice and launch a ripple
            self.voice_target = 1.0;
            self.aura.launch_ripples(0.7);
        } else if msg.starts_with("You:") {
            // let Seeker lines decay voice
            self.voice_target = 0.0;
        }

        self.messages.push(msg);
        if self.history_offset == 0 {
            self.history_offset = 0;
        }
    }

    // ...rest of your App impl omitted here for brevity...
}


// ============================
// src/ui.rs (only the key change)
// ============================

use ratatui::{
    layout::{Constraint, Direction, Layout},
    style::{Color, Style},
    widgets::{Block, Borders, Paragraph, Wrap},
    Frame,
};
use textwrap::wrap;

use crate::app::App;

pub fn draw(frame: &mut Frame, app: &App) {
    let size = frame.area();

    // 1. Aura: pass in voice_intensity so it can flicker with Priestess speech.
    app.aura.render(frame, size, app.voice_intensity);

    // 2. Status, thread, dev panel, input line as you already have.
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3),
            Constraint::Min(3),
            Constraint::Length(3),
        ])
        .split(size);

    let status_area = chunks[0];
    let main_area = chunks[1];
    let input_area = chunks[2];

    let status = format!("mode={:?} stage={} pending={}", app.mode, app.stage, app.pending);
    let status_widget = Paragraph::new(status)
        .block(Block::default().borders(Borders::ALL).title("Status"))
        .wrap(Wrap { trim: true });
    frame.render_widget(status_widget, status_area);

    let main_chunks = if app.dev_mode {
        Layout::default()
            .direction(Direction::Horizontal)
            .constraints([Constraint::Percentage(65), Constraint::Percentage(35)])
            .split(main_area)
    } else {
        Layout::default()
            .direction(Direction::Horizontal)
            .constraints([Constraint::Percentage(100)])
            .split(main_area)
    };

    let history_area = main_chunks[0];
    let wrap_width = history_area.width.saturating_sub(2) as usize;
    let wrapped_lines = wrap_messages(&app.messages, wrap_width);
    let history = wrapped_lines.join("\n");
    let history_lines = wrapped_lines.len();
    let visible_lines = history_area.height.saturating_sub(2) as usize;
    let max_offset = history_lines.saturating_sub(visible_lines);
    let scroll = max_offset.saturating_sub(app.history_offset.min(max_offset)) as u16;
    let history_widget = Paragraph::new(history)
        .block(Block::default().borders(Borders::ALL).title("Thread"))
        .wrap(Wrap { trim: false })
        .scroll((scroll, 0));
    frame.render_widget(history_widget, history_area);

    // dev panel and input widget unchanged from your current ui.rs (omitted here)
}

// wrap_messages, format_meta, format_state, etc. stay as in your current ui.rs.
```

Task:
Implement the aura and voice/breath behavior described above, using the current repo as the starting point.

Concrete requirements:

1. Aura API and state
   - Replace the simple Aura in src/aura.rs with the spec’d version:
     - fields: frame, time_s, breath_phase, breath_t, breath_duration, ripples, rng.
     - methods:
       - new() -> Aura
       - tick(dt: Duration)
       - launch_ripples(base_strength: f32)
       - render(frame: &mut Frame, area: Rect, voice_intensity: f32)
   - render() should:
     - Compute a radial distance r (0..1) from the conversation center for each cell.
     - Use breath + phase (Inhale/Exhale) to bias density inward/outward.
     - Add ripple rings (expanding circles) from launch_ripples().
     - Add small hash-based noise for stochastic “puffs.”
     - Map energy to a small set of braille glyphs and a single hue family (darker → lighter).

2. Wire aura into App
   - In src/app.rs:
     - Extend App with:
       - voice_intensity: f32 (0..1)
       - voice_target: f32 (0..1)
     - In on_tick(delta):
       - Call aura.tick(delta).
       - Ease voice_intensity toward voice_target (simple lerp).
     - In push_message(msg: String):
       - If the message is from the Priestess (prefix “Priestess”, “Rite:”, “Witness:”, “Shift:”, “Next:”):
         - Set voice_target = 1.0.
         - Call aura.launch_ripples(0.7).
       - If the message is from the Seeker (prefix “You:”):
         - Set voice_target = 0.0.
       - Then push msg into messages as today.

3. Update UI to use voice_intensity
   - In src/ui.rs draw(frame, app):
     - Call app.aura.render(frame, size, app.voice_intensity) at the very top, before drawing Status / Thread / Dev / Input.
     - Keep the existing layout and widgets intact.

4. Keep everything compiling and idiomatic
   - Use the existing dependencies in Cargo.toml; don’t add new crates unless absolutely necessary.
   - Keep the current MEATAPI client behavior in src/api.rs unchanged.
   - Preserve current commands and UI behavior; only touch aura, App state, and the draw call wiring.

Output:
- Show the updated full contents of src/aura.rs.
- Show the minimal diffs (or full updated versions) for src/app.rs and src/ui.rs needed to wire voice_intensity, launch_ripples, and aura.render.
- Do not introduce new modules or change the public API of the crate; keep everything local to these three files.


