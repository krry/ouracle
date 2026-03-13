// src/app.rs

use std::{
    collections::VecDeque,
    fs,
    io::Write,
    sync::mpsc::{self, Receiver},
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use crossterm::event::{Event, KeyCode, KeyEvent, KeyEventKind, KeyModifiers, MouseEventKind};
use rand::{RngCore, rngs::OsRng};
use reqwest::blocking::Client;
use serde_json::json;
use sha2::{Digest, Sha256};
use std::process::{Child, Command};

use crate::aura::Aura;
use crate::api::{ApiMeta, ApiRequest, ApiResponse};
use crate::theme;
use crate::totem::{Totem, SeekerPreferences};
use crate::totem as totem_store;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AppMode {
    Covenant,
    Inquiry,
    Prescribed,
    Reintegration,
    Complete,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VoiceMode {
    Off,
    Say,
    Fish,
}

pub struct App {
    pub mode: AppMode,
    pub input: String,
    pub messages: Vec<String>, // later becomes structured Priestess/Seeker turns
    pub aura: Aura,
    pub base_url: String,
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
    pub seeker_id: Option<String>,
    pub seeker_name: Option<String>,
    pub session_id: Option<String>,
    pub stage: String,
    pub last_turn: Option<u32>,
    pub pending: bool,
    pub dev_mode: bool,
    pub last_meta: Option<ApiMeta>,
    pub tts_error: Option<String>,
    pub submit_history: Vec<String>,
    pub history_index: Option<usize>,
    pub history_offset: usize, // lines up from bottom (0 = pinned to latest)
    pub mouse_capture: bool,
    pub mouse_capture_dirty: bool,
    pub queued_request: Option<ApiRequest>,
    pub pending_begin_after_covenant: bool,
    pub ritual_opened_at: Option<std::time::Instant>,
    pub ritual_min_delay_ms: u128,
    pub begin_allowed: bool,
    pub sessions_completed: u32,
    pub totem_path: PathBuf,
    pub totem: Option<Totem>,
    pub voice_intensity: f32,
    pub voice_target: f32,
    pub voice_mode: VoiceMode,
    pub priestess_display: String,
    pub priestess_prev: String,
    pub priestess_transition_ms: f32,
    pub priestess_transition_duration_ms: f32,
    pub priestess_next_delay_ms: f32,
    pub seeker_fade_ms: f32,
    pub seeker_fade_duration_ms: f32,
    pub seeker_fade_line: String,
    priestess_typing: bool,
    pub cursor_visible: bool,
    pub cursor_dirty: bool,
    pub aura_last_render: Instant,
    pub seeker_last_line: String,
    pub pace: f32,
    pub last_frame: Option<ratatui::layout::Rect>,
    priestess_queue: Vec<char>,
    priestess_accum_ms: f32,
    priestess_line_queue: VecDeque<String>,
    awaiting_consent: bool,
    awaiting_name: bool,
    awaiting_password: bool,
    pending_covenant_after_name: bool,
    pending_record_covenant: bool,
    echo_mode: bool,
    auto_hue: bool,
    root_hue_f32: f32,
    tts_duration_rx: Option<Receiver<Result<f32, String>>>,
    priestess_target_duration_ms: Option<f32>,
    priestess_line_chars: usize,
    priestess_elapsed_ms: f32,
    pub stt_error: Option<String>,
    pub stt_recording: bool,
    stt_record_started: Option<Instant>,
    stt_recorder: Option<Child>,
    stt_record_path: Option<PathBuf>,
    stt_transcribe_rx: Option<Receiver<Result<String, String>>>,
}

impl App {
    pub fn new() -> Self {
        let mut app = App {
            mode: AppMode::Covenant,
            input: String::new(),
            messages: Vec::new(),
            aura: Aura::new(),
            base_url: std::env::var("OURACLE_API_URL").unwrap_or_else(|_| "http://127.0.0.1:3737".to_string()),
            access_token: None,
            refresh_token: None,
            seeker_id: None,
            seeker_name: None,
            session_id: None,
            stage: "disconnected".to_string(),
            last_turn: None,
            pending: false,
            dev_mode: false,
            last_meta: None,
            tts_error: None,
            submit_history: Vec::new(),
            history_index: None,
            history_offset: 0,
            mouse_capture: true,
            mouse_capture_dirty: false,
            queued_request: None,
            pending_begin_after_covenant: false,
            ritual_opened_at: None,
            ritual_min_delay_ms: 1500,
            begin_allowed: false,
            sessions_completed: 0,
            totem_path: totem_store::default_path(),
            totem: None,
            voice_intensity: 0.0,
            voice_target: 0.0,
            voice_mode: VoiceMode::Say,
            priestess_display: String::new(),
            priestess_prev: String::new(),
            priestess_transition_ms: 0.0,
            priestess_transition_duration_ms: 360.0,
            priestess_next_delay_ms: 0.0,
            priestess_queue: Vec::new(),
            priestess_accum_ms: 0.0,
            seeker_fade_ms: 0.0,
            seeker_fade_duration_ms: 480.0,
            seeker_fade_line: String::new(),
            priestess_typing: false,
            cursor_visible: false,
            cursor_dirty: true,
            aura_last_render: Instant::now(),
            seeker_last_line: String::new(),
            pace: pace_to_scalar(5),
            last_frame: None,
            priestess_line_queue: VecDeque::new(),
            awaiting_consent: false,
            awaiting_name: false,
            awaiting_password: false,
            pending_covenant_after_name: false,
            pending_record_covenant: false,
            echo_mode: false,
            auto_hue: true,
            root_hue_f32: theme::current_root_hue() as f32,
            tts_duration_rx: None,
            priestess_target_duration_ms: None,
            priestess_line_chars: 0,
            priestess_elapsed_ms: 0.0,
            stt_error: None,
            stt_recording: false,
            stt_record_started: None,
            stt_recorder: None,
            stt_record_path: None,
            stt_transcribe_rx: None,
        };
        app.start_priestess_line("Welcome, traveler...\n\nHow are you arriving?".to_string());
        app
    }

    // Called on each key event
    pub fn on_event(&mut self, event: &Event) -> (bool, Option<ApiRequest>) {
        match event {
            Event::Key(KeyEvent { code, modifiers, kind, .. }) => {
                if self.handle_ptt_event(*code, *modifiers, *kind) {
                    return (false, None);
                }
                match code {
                KeyCode::Char('q') if self.input.is_empty() => {
                    // signal caller to quit
                    return (true, None);
                }
                KeyCode::Esc => {
                    // clear input for now
                    self.input.clear();
                }
                KeyCode::Enter => {
                    // commit current input as a new line
                    let line = self.input.trim().to_string();
                    self.input.clear();
                    if line.is_empty() {
                        return (false, None);
                    }
                    self.push_history(&line);
                    let (req, echo) = self.parse_input(&line);
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
                KeyCode::Up => {
                    self.load_prev_history();
                }
                KeyCode::Down => {
                    self.load_next_history();
                }
                KeyCode::Char(c) => {
                    self.input.push(*c);
                }
                KeyCode::Backspace => {
                    self.input.pop();
                }
                _ => {}
            }},
            Event::Mouse(mouse) => {
                match mouse.kind {
                    MouseEventKind::Down(crossterm::event::MouseButton::Left) => {
                        if let Some(area) = self.last_frame {
                            self.aura.launch_ripple_at(mouse.column, mouse.row, area, self.pace);
                        }
                    }
                    MouseEventKind::ScrollUp => {
                        self.history_offset = self.history_offset.saturating_add(3);
                    }
                    MouseEventKind::ScrollDown => {
                        self.history_offset = self.history_offset.saturating_sub(3);
                    }
                    _ => {}
                }
            }
            _ => {}
        }
        (false, None)
    }

    fn handle_ptt_event(&mut self, code: KeyCode, modifiers: KeyModifiers, kind: KeyEventKind) -> bool {
        if !is_ptt_key(code, modifiers) {
            return false;
        }
        match kind {
            KeyEventKind::Press => {
                if self.stt_recording {
                    self.stop_stt_recording();
                } else {
                    self.start_stt_recording();
                }
            }
            KeyEventKind::Release => {
                if self.stt_recording {
                    self.stop_stt_recording();
                }
            }
            KeyEventKind::Repeat => {}
        }
        true
    }

    // Called on each tick (for animations)
    pub fn on_tick(&mut self, delta: Duration) {
        self.aura.tick(delta);
        let dt_s = delta.as_secs_f32();
        if self.auto_hue {
            self.root_hue_f32 = (self.root_hue_f32 + dt_s * 24.0) % 360.0;
            theme::set_root_hue(self.root_hue_f32.round() as u16);
        }
        let rate = 4.0;
        let factor = (dt_s * rate).clamp(0.0, 1.0);
        self.voice_intensity =
            self.voice_intensity + factor * (self.voice_target - self.voice_intensity);

        if self.stt_recording {
            if let Some(started) = self.stt_record_started {
                if started.elapsed() >= Duration::from_secs(60) {
                    self.stop_stt_recording();
                }
            }
        }

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

        if !self.priestess_queue.is_empty() {
            self.priestess_typing = true;
            self.priestess_accum_ms += delta.as_secs_f32() * 1000.0;
            self.priestess_elapsed_ms += delta.as_secs_f32() * 1000.0;
            let interval_ms = self.current_char_interval_ms();
            while self.priestess_accum_ms >= interval_ms && !self.priestess_queue.is_empty() {
                self.priestess_accum_ms -= interval_ms;
                if let Some(ch) = self.priestess_queue.first().copied() {
                    self.priestess_display.push(ch);
                    self.priestess_queue.remove(0);
                }
            }
        }

        if self.priestess_typing && self.priestess_queue.is_empty() {
            self.priestess_typing = false;
            if !self.seeker_last_line.is_empty() {
                self.seeker_fade_line = self.seeker_last_line.clone();
                self.seeker_fade_ms = 1.0;
            }
            self.seeker_last_line.clear();
            if !self.priestess_line_queue.is_empty() {
                let delay_ms = self.priestess_display.chars().count() as f32 * pace_to_char_ms(self.pace);
                self.priestess_next_delay_ms = delay_ms.max(0.0);
            }
        }

        if self.seeker_fade_ms > 0.0 {
            self.seeker_fade_ms += delta.as_secs_f32() * 1000.0;
            if self.seeker_fade_ms >= self.seeker_fade_duration_ms {
                self.seeker_fade_ms = 0.0;
                self.seeker_fade_line.clear();
            }
        }

        if self.priestess_transition_ms > 0.0 {
            self.priestess_transition_ms += delta.as_secs_f32() * 1000.0;
            if self.priestess_transition_ms >= self.priestess_transition_duration_ms {
                self.priestess_transition_ms = 0.0;
                self.priestess_prev.clear();
            }
        }
        if self.priestess_next_delay_ms > 0.0 {
            self.priestess_next_delay_ms -= delta.as_secs_f32() * 1000.0;
            if self.priestess_next_delay_ms <= 0.0 {
                self.priestess_next_delay_ms = 0.0;
            }
        }

        if !self.priestess_typing
            && self.priestess_queue.is_empty()
            && self.priestess_next_delay_ms <= 0.0
        {
            if let Some(next) = self.priestess_line_queue.pop_front() {
                self.start_priestess_line(next);
            }
        }

        if let Some(rx) = &self.tts_duration_rx {
            if let Ok(result) = rx.try_recv() {
                match result {
                    Ok(seconds) => {
                        self.priestess_target_duration_ms = Some(seconds * 1000.0);
                        self.tts_error = None;
                    }
                    Err(err) => {
                        log_tts_error(&err);
                        self.tts_error = Some(err);
                    }
                }
                self.tts_duration_rx = None;
            }
        }
    }

    fn start_stt_recording(&mut self) {
        if self.stt_recording {
            return;
        }
        let path = stt_record_path();
        let child = match spawn_stt_recorder(&path) {
            Ok(child) => child,
            Err(err) => {
                self.stt_error = Some(err);
                return;
            }
        };
        self.stt_error = None;
        self.stt_recording = true;
        self.stt_record_started = Some(Instant::now());
        self.stt_recorder = Some(child);
        self.stt_record_path = Some(path);
    }

    fn stop_stt_recording(&mut self) {
        if !self.stt_recording {
            return;
        }
        self.stt_recording = false;
        self.stt_record_started = None;
        if let Some(mut child) = self.stt_recorder.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        let Some(path) = self.stt_record_path.take() else {
            return;
        };
        self.stt_transcribe_rx = spawn_stt_transcribe(path);
    }

    fn parse_input(&mut self, line: &str) -> (Option<ApiRequest>, Option<String>) {
        if line.starts_with('/') {
            return self.parse_command(line);
        }

        if self.echo_mode {
            let clean = line.trim();
            if !clean.is_empty() {
                self.push_message(clean.to_string());
            }
            return (None, None);
        }

        if self.awaiting_name {
            return self.handle_name_reply(line);
        }

        if self.awaiting_password {
            return self.handle_password_reply(line);
        }

        if self.awaiting_consent {
            return self.handle_consent_reply(line);
        }

        if self.session_id.is_none() {
            if self.seeker_id.is_none() {
                return self.parse_command("/welcome");
            }
            return (None, Some("You may /begin or /restart or /reset.".to_string()));
        }

        let access_token = match &self.access_token {
            Some(t) => t.clone(),
            None => return (None, Some("Receive our /welcome, or /restart.".to_string())),
        };

        let session_id = self.session_id.clone().unwrap_or_default();
        let req = ApiRequest::ContinueInquiry {
            base_url: self.base_url.clone(),
            access_token,
            session_id,
            response: line.to_string(),
        };
        self.pending = true;
        (Some(req), Some(format!("You: {}", line)))
    }

    fn parse_command(&mut self, line: &str) -> (Option<ApiRequest>, Option<String>) {
        let parts: Vec<&str> = line.trim().split_whitespace().collect();
        let cmd = parts.get(0).copied().unwrap_or("");

        match cmd {
            "/help" => {
                let msg = "Commands: /consent, /covenant-text, /welcome, /covenant, /begin, /intromit, /prescribe [tarot|iching], /thread, /redact <session_id>, /delete, /reintegrate yes|no, /totem status|init|export <path>|import <path>, /token, /mouse on|off, /dev on|off, /status, /echo on|off, /set color|pace|voice|glyphs, /get color|pace|glyphs, /restart, /reset, /help".to_string();
                (None, Some(msg))
            }
            "/dev" => {
                let mode = parts.get(1).copied().unwrap_or("toggle");
                match mode {
                    "on" => self.dev_mode = true,
                    "off" => self.dev_mode = false,
                    _ => self.dev_mode = !self.dev_mode,
                }
                self.cursor_visible = self.dev_mode;
                self.cursor_dirty = true;
                (None, None)
            }
            "/echo" => {
                let mode = parts.get(1).copied().unwrap_or("");
                match mode {
                    "on" => {
                        self.echo_mode = true;
                        (None, Some("Echo mode: on.".to_string()))
                    }
                    "off" => {
                        self.echo_mode = false;
                        (None, Some("Echo mode: off.".to_string()))
                    }
                    _ => (None, Some("Usage: /echo on|off".to_string())),
                }
            }
            "/status" => {
                let msg = format!(
                    "Status: base_url={} seeker_id={} session_id={} stage={} pending={} mouse_capture={} sessions_completed={} totem={} tts_error={}",
                    self.base_url,
                    self.seeker_id.as_deref().unwrap_or("none"),
                    self.session_id.as_deref().unwrap_or("none"),
                    self.stage,
                    self.pending,
                    if self.mouse_capture { "on" } else { "off" },
                    self.sessions_completed,
                    if self.totem.is_some() { "loaded" } else { "none" },
                    self.tts_error.as_deref().unwrap_or("none")
                );
                (None, Some(msg))
            }
            "/set" => {
                let key = parts.get(1).copied().unwrap_or("");
                let val = parts.get(2).copied().unwrap_or("");
                match key {
                    "color" => {
                        let hue: u16 = match val.parse() {
                            Ok(v) if (1..=360).contains(&v) => v,
                            _ => {
                                return (None, Some("Enter a hue on the color wheel (1-360).".to_string()));
                            }
                        };
                        theme::set_root_hue(hue);
                        self.root_hue_f32 = hue as f32;
                        self.auto_hue = false;
                        (None, Some(format!("Color root hue set to {}", hue)))
                    }
                    "pace" => {
                        let pace: u8 = match val.parse() {
                            Ok(v) if (1..=10).contains(&v) => v,
                            _ => return (None, Some("Usage: /set pace <1-10>".to_string())),
                        };
                        self.pace = pace_to_scalar(pace);
                        (None, Some(format!("Pace set to {}", pace)))
                    }
                    "voice" => {
                        let mode = parts.get(2).copied().unwrap_or("");
                        match mode {
                            "fish" => {
                                self.voice_mode = VoiceMode::Fish;
                                (None, Some("Voice set to fish.".to_string()))
                            }
                            "say" => {
                                self.voice_mode = VoiceMode::Say;
                                (None, Some("Voice set to say.".to_string()))
                            }
                            "off" => {
                                self.voice_mode = VoiceMode::Off;
                                (None, Some("Voice off.".to_string()))
                            }
                            _ => (None, Some("Usage: /set voice fish|say|off".to_string())),
                        }
                    }
                    "glyphs" => {
                        let mode = parts.get(2).copied().unwrap_or("");
                        match mode {
                            "braille" => {
                                self.aura.set_glyph_mode(crate::aura::AuraGlyphMode::Braille);
                                (None, Some("Aura glyphs set to braille.".to_string()))
                            }
                            "taz" => {
                                self.aura.set_glyph_mode(crate::aura::AuraGlyphMode::Taz);
                                (None, Some("Aura glyphs set to taz.".to_string()))
                            }
                            "math" => {
                                self.aura.set_glyph_mode(crate::aura::AuraGlyphMode::Math);
                                (None, Some("Aura glyphs set to math.".to_string()))
                            }
                            "mahjong" => {
                                self.aura.set_glyph_mode(crate::aura::AuraGlyphMode::Mahjong);
                                (None, Some("Aura glyphs set to mahjong.".to_string()))
                            }
                            "dominoes" => {
                                self.aura.set_glyph_mode(crate::aura::AuraGlyphMode::Dominoes);
                                (None, Some("Aura glyphs set to dominoes.".to_string()))
                            }
                            "cards" => {
                                self.aura.set_glyph_mode(crate::aura::AuraGlyphMode::Cards);
                                (None, Some("Aura glyphs set to cards.".to_string()))
                            }
                            _ => {
                                let msg = "Usage: /set glyphs braille|taz|math|mahjong|dominoes|cards".to_string();
                                (None, Some(msg))
                            }
                        }
                    }
                    _ => (None, Some("Usage: /set color|pace|voice|glyphs ...".to_string())),
                }
            }
            "/get" => {
                let key = parts.get(1).copied().unwrap_or("");
                match key {
                    "color" => {
                        let hue = theme::current_root_hue();
                        (None, Some(format!("color: {}", hue)))
                    }
                    "pace" => {
                        let pace = if self.pace <= 0.6 {
                            1
                        } else {
                            (((self.pace - 0.6) / (2.4 - 0.6)) * 9.0).round() as i32 + 1
                        };
                        (None, Some(format!("pace: {}", pace)))
                    }
                    "glyphs" => {
                        let mode = match self.aura.glyph_mode() {
                            crate::aura::AuraGlyphMode::Braille => "braille",
                            crate::aura::AuraGlyphMode::Taz => "taz",
                            crate::aura::AuraGlyphMode::Math => "math",
                            crate::aura::AuraGlyphMode::Mahjong => "mahjong",
                            crate::aura::AuraGlyphMode::Dominoes => "dominoes",
                            crate::aura::AuraGlyphMode::Cards => "cards",
                        };
                        (None, Some(format!("glyphs: {}", mode)))
                    }
                    _ => (None, Some("Usage: /get color | /get pace | /get glyphs".to_string())),
                }
            }
            "/sessions" => {
                (None, Some(format!("Sessions completed: {}", self.sessions_completed)))
            }
            "/restart" => {
                let req = self.reset_ui(true);
                (req, Some("Restarted.".to_string()))
            }
            "/reset" => {
                self.reset_ui(false);
                (None, Some("Reset.".to_string()))
            }
            "/token" => {
                let token = self.access_token.as_deref().unwrap_or("none");
                (None, Some(format!("Bearer: {}", token)))
            }
            "/totem" => {
                let sub = parts.get(1).copied().unwrap_or("status");
                match sub {
                    "status" => {
                        let msg = if let Some(t) = &self.totem {
                            format!("Totem: {} (v{})", t.totem_id, t.totem_version)
                        } else if self.totem_path.exists() {
                            "Totem: file exists (not loaded)".to_string()
                        } else {
                            "Totem: none".to_string()
                        };
                        (None, Some(msg))
                    }
                    "init" => {
                        let now = totem_store::now_iso();
                        let totem = Totem {
                            totem_version: "0.1".to_string(),
                            totem_id: random_hex(16),
                            created_at: now.clone(),
                            updated_at: now,
                            seeker_preferences: SeekerPreferences {
                                oracle_flavor: "none".to_string(),
                                timezone: std::env::var("TZ").unwrap_or_else(|_| "UTC".to_string()),
                            },
                            sessions: Vec::new(),
                        };
                        let _ = totem_store::save(&self.totem_path, &totem);
                        self.totem = Some(totem);
                        (None, Some("Totem initialized (unencrypted stub).".to_string()))
                    }
                    "export" => {
                        let path = match parts.get(2) {
                            Some(p) => PathBuf::from(*p),
                            None => return (None, Some("Usage: /totem export <path>".to_string())),
                        };
                        if let Some(t) = &self.totem {
                            let _ = totem_store::save(&path, t);
                            (None, Some(format!("Totem exported to {}", path.display())))
                        } else {
                            (None, Some("Totem not loaded.".to_string()))
                        }
                    }
                    "import" => {
                        let path = match parts.get(2) {
                            Some(p) => PathBuf::from(*p),
                            None => return (None, Some("Usage: /totem import <path>".to_string())),
                        };
                        let loaded = totem_store::load(&path);
                        if let Some(t) = loaded {
                            self.totem = Some(t);
                            (None, Some(format!("Totem imported from {}", path.display())))
                        } else {
                            (None, Some("Totem import failed.".to_string()))
                        }
                    }
                    _ => (None, Some("Usage: /totem status|init|export <path>|import <path>".to_string())),
                }
            }
            "/thread" => {
                let access_token = match &self.access_token {
                    Some(t) => t.clone(),
                    None => return (None, Some("Priestess: No access token. Use /welcome first.".to_string())),
                };
                let seeker_id = match &self.seeker_id {
                    Some(id) => id.clone(),
                    None => return (None, Some("Priestess: No seeker_id. Use /welcome first.".to_string())),
                };
                let req = ApiRequest::FetchThread {
                    base_url: self.base_url.clone(),
                    access_token,
                    seeker_id,
                };
                self.pending = true;
                (Some(req), Some("Priestess: Fetching thread.".to_string()))
            }
            "/delete" => {
                let access_token = match &self.access_token {
                    Some(t) => t.clone(),
                    None => return (None, Some("Priestess: No access token. Use /welcome first.".to_string())),
                };
                let seeker_id = match &self.seeker_id {
                    Some(id) => id.clone(),
                    None => return (None, Some("Priestess: No seeker_id. Use /welcome first.".to_string())),
                };
                let req = ApiRequest::DeleteSeeker {
                    base_url: self.base_url.clone(),
                    access_token,
                    seeker_id,
                };
                self.pending = true;
                (Some(req), Some("Priestess: Deleting seeker.".to_string()))
            }
            "/redact" => {
                let access_token = match &self.access_token {
                    Some(t) => t.clone(),
                    None => return (None, Some("Priestess: No access token. Use /welcome first.".to_string())),
                };
                let seeker_id = match &self.seeker_id {
                    Some(id) => id.clone(),
                    None => return (None, Some("Priestess: No seeker_id. Use /welcome first.".to_string())),
                };
                let session_id = match parts.get(1) {
                    Some(id) => (*id).to_string(),
                    None => return (None, Some("Priestess: Provide a session_id to redact.".to_string())),
                };
                let req = ApiRequest::RedactSession {
                    base_url: self.base_url.clone(),
                    access_token,
                    seeker_id,
                    session_id,
                };
                self.pending = true;
                (Some(req), Some("Priestess: Redacting session.".to_string()))
            }
            "/mouse" => {
                let mode = parts.get(1).copied().unwrap_or("");
                match mode {
                    "on" => {
                        self.mouse_capture = true;
                        self.mouse_capture_dirty = true;
                        (None, Some("Mouse capture: on (scroll enabled, selection disabled)".to_string()))
                    }
                    "off" => {
                        self.mouse_capture = false;
                        self.mouse_capture_dirty = true;
                        (None, Some("Mouse capture: off (selection enabled, scroll disabled)".to_string()))
                    }
                    _ => (None, Some("Usage: /mouse on|off".to_string())),
                }
            }
            "/consent" => {
                self.mode = AppMode::Covenant;
                let req = ApiRequest::GetConsent { base_url: self.base_url.clone() };
                self.pending = true;
                (Some(req), Some("Priestess: Requesting consent disclosures.".to_string()))
            }
            "/covenant-text" => {
                self.mode = AppMode::Covenant;
                let req = ApiRequest::GetCovenant { base_url: self.base_url.clone() };
                self.pending = true;
                (Some(req), Some("Priestess: Requesting covenant text.".to_string()))
            }
            "/welcome" => {
                self.mode = AppMode::Covenant;
                let req = ApiRequest::GetConsent { base_url: self.base_url.clone() };
                self.pending = true;
                (Some(req), Some("The Ouracle listens; a priestess speaks.".to_string()))
            }
            "/covenant" => {
                self.mode = AppMode::Covenant;
                let access_token = match &self.access_token {
                    Some(t) => t.clone(),
                    None => return (None, Some("Priestess: No access token. Use /welcome first.".to_string())),
                };
                let seeker_id = match &self.seeker_id {
                    Some(id) => id.clone(),
                    None => return (None, Some("Priestess: No seeker_id. Use /welcome first.".to_string())),
                };
                let req = ApiRequest::RecordCovenant {
                    base_url: self.base_url.clone(),
                    access_token,
                    seeker_id,
                };
                self.pending = true;
                (Some(req), Some("Priestess: Recording covenant.".to_string()))
            }
            "/begin" => {
                self.mode = AppMode::Covenant;
                let access_token = match &self.access_token {
                    Some(t) => t.clone(),
                    None => return (None, Some("Priestess: No access token. Use /welcome then /covenant.".to_string())),
                };
                let req = ApiRequest::GetCovenant { base_url: self.base_url.clone() };
                self.pending = true;
                self.pending_begin_after_covenant = true;
                self.ritual_opened_at = Some(std::time::Instant::now());
                self.begin_allowed = false;
                self.queued_request = Some(ApiRequest::BeginInquiry {
                    base_url: self.base_url.clone(),
                    access_token,
                });
                (Some(req), Some("Priestess: Requesting covenant text. Type /intromit to proceed.".to_string()))
            }
            "/intromit" => {
                self.mode = AppMode::Covenant;
                self.begin_allowed = true;
                (None, Some("Priestess: Covenant sealed. Temple opens.".to_string()))
            }
            "/prescribe" => {
                if self.stage != "inquiry_complete" {
                    return (None, Some("Priestess: Inquiry not complete yet.".to_string()));
                }
                let access_token = match &self.access_token {
                    Some(t) => t.clone(),
                    None => return (None, Some("Priestess: No access token. Use /welcome then /covenant.".to_string())),
                };
                let session_id = match &self.session_id {
                    Some(id) => id.clone(),
                    None => return (None, Some("Priestess: No session_id. Use /begin first.".to_string())),
                };
                let divination_source = parts.get(1).map(|v| v.to_string());
                let req = ApiRequest::Prescribe {
                    base_url: self.base_url.clone(),
                    access_token,
                    session_id,
                    divination_source,
                };
                self.mode = AppMode::Prescribed;
                self.pending = true;
                (Some(req), Some("Priestess: Requesting prescription.".to_string()))
            }
            "/reintegrate" => {
                let access_token = match &self.access_token {
                    Some(t) => t.clone(),
                    None => return (None, Some("Priestess: No access token. Use /welcome then /covenant.".to_string())),
                };
                let session_id = match &self.session_id {
                    Some(id) => id.clone(),
                    None => return (None, Some("Priestess: No session_id. Use /begin first.".to_string())),
                };
                let enacted = parts.get(1).map(|v| *v == "yes" || *v == "true").unwrap_or(false);
                let req = ApiRequest::Reintegrate {
                    base_url: self.base_url.clone(),
                    access_token,
                    session_id,
                    enacted,
                };
                self.mode = AppMode::Reintegration;
                self.pending = true;
                (Some(req), Some(format!("Priestess: Sending reintegration report (enacted={}).", enacted)))
            }
            _ => (None, Some(format!("Priestess: Unknown command: {}", line))),
        }
    }

    pub fn handle_api_response(&mut self, resp: ApiResponse) {
        self.pending = false;
        match resp {
            ApiResponse::Consent { disclosures, meta } => {
                self.last_meta = Some(meta);
                self.mode = AppMode::Covenant;
                for d in disclosures {
                    self.push_message(d);
                }
                self.stage = "consent".to_string();
                self.awaiting_consent = true;
                self.push_message("Don't you agree? (y/n)".to_string());
            }
            ApiResponse::CovenantText { version, text, meta } => {
                self.last_meta = Some(meta);
                self.mode = AppMode::Covenant;
                self.push_message(format!("Covenant v{}:", version));
                for line in text {
                    self.push_message(format!("- {}", line));
                }
                if self.pending_record_covenant {
                    self.pending_record_covenant = false;
                    let access_token = match &self.access_token {
                        Some(t) => t.clone(),
                        None => {
                            self.push_message("No access token. Use /welcome first.".to_string());
                            return;
                        }
                    };
                    let seeker_id = match &self.seeker_id {
                        Some(id) => id.clone(),
                        None => {
                            self.push_message("No seeker_id. Use /welcome first.".to_string());
                            return;
                        }
                    };
                    self.queued_request = Some(ApiRequest::RecordCovenant {
                        base_url: self.base_url.clone(),
                        access_token,
                        seeker_id,
                    });
                    self.pending = true;
                    self.push_message("Recording covenant.".to_string());
                }
                if self.pending_begin_after_covenant {
                    self.pending_begin_after_covenant = false;
                }
            }
            ApiResponse::SeekerCreated { seeker_id, access_token, refresh_token, meta } => {
                self.last_meta = Some(meta);
                self.mode = AppMode::Covenant;
                self.seeker_id = Some(seeker_id.clone());
                self.access_token = Some(access_token);
                self.refresh_token = Some(refresh_token);
                self.stage = "seeker_ready".to_string();
                self.awaiting_password = true;
                self.push_message("We will remember you. Choose a password.".to_string());
            }
            ApiResponse::PasswordSet { meta } => {
                self.last_meta = Some(meta);
                self.push_message("Password set.".to_string());
                if self.pending_covenant_after_name {
                    self.pending_covenant_after_name = false;
                    self.pending_record_covenant = true;
                    self.queued_request = Some(ApiRequest::GetCovenant { base_url: self.base_url.clone() });
                    self.pending = true;
                }
            }
            ApiResponse::CovenantRecorded { covenant_at, meta } => {
                self.last_meta = Some(meta);
                self.mode = AppMode::Covenant;
                self.stage = "covenanted".to_string();
                // self.push_message(format!("Covenant recorded at {}", covenant_at));
                self.push_message(format!("The covenant is sealed."));
            }
            ApiResponse::InquiryQuestion { session_id, turn, question, greeting, meta } => {
                self.last_meta = Some(meta);
                self.mode = AppMode::Inquiry;
                self.session_id = Some(session_id);
                self.stage = "inquiry".to_string();
                self.last_turn = Some(turn);
                if turn == 0 && self.sessions_completed == 0 {
                    self.push_message("Priestess: Welcome as you are.".to_string());
                }
                if let Some(g) = greeting {
                    self.push_message(format!("Priestess: {}", g));
                }
                self.push_message(format!("Priestess (turn {}): {}", turn, question));
            }
            ApiResponse::InquiryComplete { session_id, turn, quality_sense, meta } => {
                self.last_meta = Some(meta);
                self.mode = AppMode::Inquiry;
                self.session_id = Some(session_id);
                self.stage = "inquiry_complete".to_string();
                self.last_turn = Some(turn);
                if let Some(q) = quality_sense {
                    self.push_message(format!("Priestess: {} (turn {})", q, turn));
                } else {
                    self.push_message(format!("Priestess: Inquiry complete (turn {}). Use /prescribe.", turn));
                }
            }
            ApiResponse::Session { session_id, stage, turn, priestess_lines, meta } => {
                self.last_meta = Some(meta);
                self.mode = AppMode::Inquiry;
                self.session_id = Some(session_id);
                if let Some(stage) = stage {
                    self.stage = stage;
                } else {
                    self.stage = "inquiry".to_string();
                }
                self.last_turn = turn;
                self.push_message("Welcome, traveler...".to_string());
                if let Some(last) = priestess_lines.last() {
                    self.push_message(last.to_string());
                }
            }
            ApiResponse::Prescribed { rite, reintegration_window, meta } => {
                self.last_meta = Some(meta);
                self.mode = AppMode::Prescribed;
                self.stage = "prescribed".to_string();
                self.push_message("Rite Card".to_string());
                self.push_message(format!("Name: {}", rite.rite_name));
                self.push_message(format!("Act: {}", rite.act));
                self.push_message(format!("Invocation: {}", rite.invocation));
                if !rite.textures.is_empty() {
                    self.push_message(format!("Textures: {}", rite.textures.join(" | ")));
                }
                if let Some(divination) = rite.divination {
                    match divination.source.as_str() {
                        "tarot" => {
                            if let Some(card) = divination.card {
                                let mut label = card.name;
                                if let Some(suit) = card.suit {
                                    label = format!("{label} ({suit})");
                                }
                                if let Some(rank) = card.rank {
                                    label = format!("{label} — {rank}");
                                }
                                self.push_message(format!("Divination: Tarot — {}", label));
                            }
                        }
                        "iching" => {
                            if let Some(hex) = divination.hexagram {
                                self.push_message(format!("Divination: I Ching — {} {}", hex.number, hex.name));
                            }
                        }
                        _ => {
                            self.push_message(format!("Divination: {}", divination.source));
                        }
                    }
                }
                if let Some(context) = rite.context {
                    self.push_message(format!("Context: {}", context));
                }
                if let Some(duration) = rite.duration {
                    self.push_message(format!("Duration: {}", duration));
                }
                if let Some(window) = reintegration_window {
                    self.push_message(format!("Reintegration window: {}", window));
                }
                self.push_message("May this mantra instruct you.".to_string());
            }
            ApiResponse::Thread { items, meta } => {
                self.last_meta = Some(meta);
                self.push_message("Thread:".to_string());
                for item in items {
                    let label = item.rite_name.clone().unwrap_or_else(|| "Unprescribed".to_string());
                    let quality = item.quality.clone().unwrap_or_else(|| "unknown".to_string());
                    let enacted = item.enacted.map(|e| if e { "enacted" } else { "not enacted" }).unwrap_or("unknown");
                    let when = item.completed_at.or(item.created_at).unwrap_or_else(|| "".to_string());
                    self.push_message(format!("- {} | {} | {} | {} | {}", item.id, label, quality, enacted, when));
                }
            }
            ApiResponse::SeekerDeleted { seeker_id, meta } => {
                self.last_meta = Some(meta);
                self.mode = AppMode::Complete;
                self.push_message(format!("Priestess: Seeker deleted: {}", seeker_id));
                self.seeker_id = None;
                self.access_token = None;
                self.refresh_token = None;
                self.session_id = None;
                self.stage = "deleted".to_string();
            }
            ApiResponse::SessionRedacted { session_id, meta } => {
                self.last_meta = Some(meta);
                self.push_message(format!("Priestess: Session redacted: {}", session_id));
            }
            ApiResponse::ReintegrationComplete { witness, what_shifted, next, meta } => {
                self.last_meta = Some(meta);
                self.mode = AppMode::Complete;
                self.stage = "reintegration_complete".to_string();
                self.sessions_completed = self.sessions_completed.saturating_add(1);
                self.push_message(format!("Witness: {}", witness));
                self.push_message(format!("Shift: {}", what_shifted));
                self.push_message(format!("Next: {}", next));
            }
            ApiResponse::Error { message, meta } => {
                self.last_meta = Some(meta.clone());
                self.push_message(format!("Error ({}): {}", meta.status, message));
            }
            ApiResponse::ShutdownAck => {}
        }
    }

    pub fn take_queued_request(&mut self) -> Option<ApiRequest> {
        self.queued_request.take()
    }

    fn push_message(&mut self, msg: String) {
        let is_seeker = msg.starts_with("You:");
        if !is_seeker {
            if let Some(line) = normalize_priestess_line(&msg) {
                self.queue_priestess_line(line);
            }
        } else if msg.starts_with("You:") {
            self.voice_target = 0.0;
        }
        self.messages.push(msg);
        if self.history_offset == 0 {
            self.history_offset = 0;
        }
    }

    fn push_history(&mut self, line: &str) {
        if self.submit_history.last().map(|v| v.as_str()) == Some(line) {
            self.history_index = None;
            return;
        }
        self.submit_history.push(line.to_string());
        self.seeker_last_line = line.to_string();
        self.history_index = None;
    }

    fn load_prev_history(&mut self) {
        if self.submit_history.is_empty() {
            return;
        }
        let next_idx = match self.history_index {
            Some(idx) => idx.saturating_sub(1),
            None => self.submit_history.len().saturating_sub(1),
        };
        self.history_index = Some(next_idx);
        if let Some(val) = self.submit_history.get(next_idx) {
            self.input = val.clone();
        }
    }

    fn load_next_history(&mut self) {
        let Some(idx) = self.history_index else {
            return;
        };
        let next_idx = idx + 1;
        if next_idx >= self.submit_history.len() {
            self.history_index = None;
            self.input.clear();
            return;
        }
        self.history_index = Some(next_idx);
        if let Some(val) = self.submit_history.get(next_idx) {
            self.input = val.clone();
        }
    }
}

impl App {
    fn queue_priestess_line(&mut self, line: String) {
        if self.priestess_typing || !self.priestess_queue.is_empty() {
            self.priestess_line_queue.push_back(line);
            return;
        }
        if self.priestess_transition_ms > 0.0 {
            self.priestess_line_queue.push_back(line);
            return;
        }
        self.start_priestess_line(line);
    }

    fn start_priestess_line(&mut self, line: String) {
        self.voice_target = 1.0;
        self.aura.launch_ripples(0.7, self.pace);
        match self.voice_mode {
            VoiceMode::Off => {}
            VoiceMode::Say => {
                speak_line(&line);
            }
            VoiceMode::Fish => {
                self.tts_error = None;
                self.tts_duration_rx = spawn_tts(line.clone());
                if self.tts_duration_rx.is_none() {
                    let msg = "Fish TTS spawn failed.".to_string();
                    log_tts_error(&msg);
                    self.tts_error = Some(msg);
                    speak_line(&line);
                }
            }
        }
        if !self.priestess_display.is_empty() {
            self.priestess_prev = self.priestess_display.clone();
            self.priestess_transition_ms = 1.0;
        }
        self.priestess_display.clear();
        self.priestess_queue = line.chars().collect();
        self.priestess_accum_ms = 0.0;
        self.priestess_typing = true;
        self.priestess_next_delay_ms = 0.0;
        self.priestess_target_duration_ms = None;
        self.priestess_line_chars = line.chars().count().max(1);
        self.priestess_elapsed_ms = 0.0;
    }

    fn handle_consent_reply(&mut self, line: &str) -> (Option<ApiRequest>, Option<String>) {
        let reply = line.trim().to_lowercase();
        if reply == "y" || reply == "yes" {
            self.awaiting_consent = false;
            self.awaiting_name = true;
            return (None, Some("Pleased to receive you, seeker.\nWhat shall we call you?".to_string()));
        }
        if reply == "n" || reply == "no" {
            self.awaiting_consent = false;
            self.stage = "consent_declined".to_string();
            return (None, Some("Consent declined.".to_string()));
        }
        (None, Some("Don't you agree? (y/n)".to_string()))
    }

    fn handle_name_reply(&mut self, line: &str) -> (Option<ApiRequest>, Option<String>) {
        let name = line.trim();
        if name.is_empty() {
            return (None, Some("What shall we call you?".to_string()));
        }
        self.seeker_name = Some(name.to_string());
        self.awaiting_name = false;

        let device_id = random_hex(16);
        let timezone = std::env::var("TZ").unwrap_or_else(|_| "UTC".to_string());
        let req = ApiRequest::CreateSeeker {
            base_url: self.base_url.clone(),
            device_id,
            timezone,
            name: name.to_string(),
        };
        self.pending = true;
        self.pending_covenant_after_name = true;
        (Some(req), Some("Creating seeker...".to_string()))
    }

    fn handle_password_reply(&mut self, line: &str) -> (Option<ApiRequest>, Option<String>) {
        let password = line.trim();
        if password.is_empty() {
            return (None, Some("Password cannot be empty.".to_string()));
        }
        let access_token = match &self.access_token {
            Some(t) => t.clone(),
            None => return (None, Some("No access token. Use /welcome again.".to_string())),
        };
        let seeker_id = match &self.seeker_id {
            Some(id) => id.clone(),
            None => return (None, Some("No seeker_id. Use /welcome again.".to_string())),
        };
        self.awaiting_password = false;
        let req = ApiRequest::SetPassword {
            base_url: self.base_url.clone(),
            access_token,
            seeker_id,
            password: password.to_string(),
        };
        self.pending = true;
        (Some(req), Some("Setting password...".to_string()))
    }

    fn reset_ui(&mut self, keep_session: bool) -> Option<ApiRequest> {
        self.input.clear();
        self.messages.clear();
        self.submit_history.clear();
        self.history_index = None;
        self.history_offset = 0;

        self.priestess_display.clear();
        self.priestess_prev.clear();
        self.priestess_queue.clear();
        self.priestess_accum_ms = 0.0;
        self.priestess_typing = false;
        self.priestess_line_queue.clear();
        self.priestess_transition_ms = 0.0;
        self.priestess_next_delay_ms = 0.0;
        self.priestess_target_duration_ms = None;
        self.priestess_line_chars = 0;
        self.priestess_elapsed_ms = 0.0;
        self.tts_duration_rx = None;

        self.seeker_last_line.clear();
        self.seeker_fade_line.clear();
        self.seeker_fade_ms = 0.0;

        self.voice_intensity = 0.0;
        self.voice_target = 0.0;

        self.start_priestess_line("Welcome, traveler...".to_string());

        self.pending = false;
        self.queued_request = None;
        self.pending_begin_after_covenant = false;
        self.ritual_opened_at = None;
        self.begin_allowed = false;

        self.awaiting_consent = false;
        self.awaiting_name = false;
        self.awaiting_password = false;
        self.pending_covenant_after_name = false;
        self.pending_record_covenant = false;

        let session_id = if keep_session {
            self.session_id.clone()
        } else {
            None
        };

        if !keep_session {
            self.session_id = None;
            self.last_turn = None;
        }

        if session_id.is_some() {
            self.mode = AppMode::Inquiry;
            self.stage = "inquiry".to_string();
        } else if self.seeker_id.is_some() {
            self.mode = AppMode::Covenant;
            self.stage = "seeker_ready".to_string();
        } else {
            self.mode = AppMode::Covenant;
            self.stage = "disconnected".to_string();
        }

        if let (Some(access_token), Some(session_id)) = (self.access_token.clone(), session_id) {
            return Some(ApiRequest::GetSession {
                base_url: self.base_url.clone(),
                access_token,
                session_id,
            });
        }
        None
    }

    fn current_char_interval_ms(&self) -> f32 {
        if let Some(target_ms) = self.priestess_target_duration_ms {
            let typed = self.priestess_display.chars().count();
            let remaining_chars = self.priestess_line_chars.saturating_sub(typed).max(1) as f32;
            let remaining_ms = (target_ms - self.priestess_elapsed_ms).max(0.0);
            let per_char = remaining_ms / remaining_chars;
            return per_char.clamp(15.0, 220.0);
        }
        pace_to_char_ms(self.pace)
    }
}

fn normalize_priestess_line(msg: &str) -> Option<String> {
    let mut line = msg.trim().to_string();
    let prefixes = ["Priestess:", "Rite:", "Witness:", "Shift:", "Next:", "Priestess (turn"];
    if prefixes.iter().any(|p| line.starts_with(p)) {
        if let Some(idx) = line.find(":") {
            line = line[idx + 1..].trim().to_string();
        } else if let Some(idx) = line.find(")") {
            line = line[idx + 1..].trim().to_string();
        }
    }
    if line.is_empty() { None } else { Some(line) }
}

fn is_ptt_key(code: KeyCode, modifiers: KeyModifiers) -> bool {
    let mod_only = modifiers.contains(KeyModifiers::SUPER) || modifiers.contains(KeyModifiers::ALT);
    matches!(code, KeyCode::F(9))
        || (mod_only && matches!(code, KeyCode::Char(' ')))
        || (mod_only && matches!(code, KeyCode::Null))
}

fn stt_record_dir() -> PathBuf {
    if let Ok(dir) = std::env::var("OURACLE_STT_DIR") {
        return PathBuf::from(dir);
    }
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    root.join("data").join("stt_recordings")
}

fn stt_transcript_dir() -> PathBuf {
    if let Ok(dir) = std::env::var("OURACLE_STT_TRANSCRIPT_DIR") {
        return PathBuf::from(dir);
    }
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    root.join("data").join("stt_transcripts")
}

fn stt_record_path() -> PathBuf {
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let key = random_hex(4);
    stt_record_dir().join(format!("stt_{}_{}.wav", ts, key))
}

fn spawn_stt_recorder(path: &Path) -> Result<Child, String> {
    let cmd = std::env::var("OURACLE_STT_RECORDER").unwrap_or_else(|_| "sox".to_string());
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| format!("stt record dir error: {e}"))?;
    }
    let mut command = Command::new(&cmd);
    if cmd == "sox" {
        command.args(["-d", "-c", "1", "-r", "16000", "-b", "16", "-e", "signed-integer"]);
    } else if let Ok(args) = std::env::var("OURACLE_STT_RECORDER_ARGS") {
        command.args(args.split_whitespace());
    }
    command.arg(path);
    command.spawn().map_err(|e| format!("stt record spawn error: {e}"))
}

fn spawn_stt_transcribe(path: PathBuf) -> Option<Receiver<Result<String, String>>> {
    let (tx, rx) = mpsc::channel();
    thread::spawn(move || {
        let result = whisper_transcribe(&path);
        let _ = tx.send(result);
    });
    Some(rx)
}

fn whisper_transcribe(path: &Path) -> Result<String, String> {
    let cmd = whisper_cmd()?;
    let model_path = whisper_model_path()?;
    let out_dir = stt_transcript_dir();
    fs::create_dir_all(&out_dir).map_err(|e| format!("stt transcript dir error: {e}"))?;
    let key = random_hex(5);
    let out_base = out_dir.join(format!("stt_{}", key));
    let mut command = Command::new(cmd);
    command
        .arg("-m")
        .arg(model_path)
        .arg("-f")
        .arg(path)
        .arg("-otxt")
        .arg("-of")
        .arg(&out_base);
    if let Ok(lang) = std::env::var("OURACLE_WHISPER_LANG") {
        let lang = lang.trim();
        if !lang.is_empty() {
            command.arg("-l").arg(lang);
        }
    }
    let status = command.status().map_err(|e| format!("whisper spawn error: {e}"))?;
    if !status.success() {
        return Err(format!("whisper exited with status {}", status));
    }
    let out_txt = out_base.with_extension("txt");
    let text = fs::read_to_string(&out_txt).map_err(|e| format!("whisper output read error: {e}"))?;
    Ok(clean_transcript(&text))
}

fn whisper_cmd() -> Result<String, String> {
    if let Ok(cmd) = std::env::var("OURACLE_WHISPER_CMD") {
        return Ok(cmd);
    }
    for candidate in ["whisper", "whisper-cpp"] {
        if Command::new(candidate).arg("--help").output().is_ok() {
            return Ok(candidate.to_string());
        }
    }
    Err("Whisper command not found. Install whisper.cpp or set OURACLE_WHISPER_CMD.".to_string())
}

fn whisper_model_path() -> Result<PathBuf, String> {
    if let Ok(path) = std::env::var("OURACLE_WHISPER_MODEL") {
        return Ok(PathBuf::from(path));
    }
    let mut candidates = Vec::new();
    candidates.push(PathBuf::from("/opt/homebrew/share/whisper.cpp/models/ggml-base.en.bin"));
    candidates.push(PathBuf::from("/usr/local/share/whisper.cpp/models/ggml-base.en.bin"));
    if let Ok(home) = std::env::var("HOME") {
        candidates.push(PathBuf::from(home).join(".local/share/whisper.cpp/models/ggml-base.en.bin"));
    }
    for path in candidates {
        if path.exists() {
            return Ok(path);
        }
    }
    Err("Whisper model not found. Set OURACLE_WHISPER_MODEL to a ggml model path.".to_string())
}

fn clean_transcript(text: &str) -> String {
    text.lines()
        .map(|line| line.trim())
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}

fn pace_to_scalar(pace: u8) -> f32 {
    let p = pace.clamp(1, 10) as f32;
    0.6 + (p - 1.0) * (2.4 - 0.6) / 9.0
}

fn pace_to_char_ms(pace: f32) -> f32 {
    let p = pace.clamp(0.6, 2.4);
    61.803399 / p
}

fn random_hex(bytes_len: usize) -> String {
    let mut bytes = vec![0u8; bytes_len];
    OsRng.fill_bytes(&mut bytes);
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

fn speak_line(line: &str) {
    let text = line.trim();
    if text.is_empty() {
        return;
    }
    let _ = Command::new("say").arg(text).spawn();
}

fn log_tts_error(msg: &str) {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let log_dir = root.join("logs");
    let _ = fs::create_dir_all(&log_dir);
    let log_path = log_dir.join("tts.log");
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    if let Ok(mut file) = fs::OpenOptions::new().create(true).append(true).open(log_path) {
        let _ = writeln!(file, "[{}] {}", ts, msg);
    }
}

fn tts_cache_dir() -> PathBuf {
    if let Ok(dir) = std::env::var("OURACLE_TTS_CACHE_DIR") {
        return PathBuf::from(dir);
    }
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    root.join("data").join("tts_cache")
}

fn tts_cache_key(text: &str, model: &str, model_id: Option<&str>) -> String {
    let mut hasher = Sha256::new();
    hasher.update(model.as_bytes());
    hasher.update(b"\n");
    if let Some(id) = model_id {
        hasher.update(id.as_bytes());
    }
    hasher.update(b"\n");
    hasher.update(text.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn tts_cache_path(text: &str, model: &str, model_id: Option<&str>) -> PathBuf {
    let key = tts_cache_key(text, model, model_id);
    tts_cache_dir().join(format!("fish_{}.mp3", key))
}

fn spawn_tts(line: String) -> Option<Receiver<Result<f32, String>>> {
    let api_key = match std::env::var("FISH_AUDIO_API_KEY") {
        Ok(v) => v,
        Err(_) => {
            log_tts_error("Fish TTS disabled: FISH_AUDIO_API_KEY not set.");
            return None;
        }
    };
    let model = std::env::var("FISH_AUDIO_MODEL").unwrap_or_else(|_| "s1".to_string());
    let model_id = std::env::var("FISH_AUDIO_VOICE_OPRAH").ok();
    let (tx, rx) = mpsc::channel();
    thread::spawn(move || {
        let duration = match fish_tts(&line, &api_key, &model, model_id.as_deref()) {
            Ok(v) => v,
            Err(err) => {
                let _ = tx.send(Err(err));
                return;
            }
        };
        let _ = tx.send(Ok(duration));
    });
    Some(rx)
}

fn fish_tts(text: &str, api_key: &str, model: &str, model_id: Option<&str>) -> Result<f32, String> {
    let cache_path = tts_cache_path(text, model, model_id);
    if cache_path.exists() {
        let duration = afinfo_duration_seconds(&cache_path).unwrap_or_else(|| estimate_tts_seconds(text));
        let _ = Command::new("afplay").arg(&cache_path).spawn();
        return Ok(duration);
    }

    let client = Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| format!("fish client error: {e}"))?;
    let url = "https://api.fish.audio/v1/tts";
    let backend = if model == "s2" { "s2-pro" } else { model };
    let body = if let Some(reference_id) = model_id {
        json!({
            "text": text,
            "reference_id": reference_id,
            "format": "mp3",
        })
    } else {
        json!({
            "text": text,
            "format": "mp3",
        })
    };
    let resp = client
        .post(url)
        .bearer_auth(api_key)
        .header("model", backend)
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .map_err(|e| format!("fish http error: {e}"))?;
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().unwrap_or_else(|_| "<no body>".to_string());
        return Err(format!("fish http {}: {}", status.as_u16(), body));
    }
    let bytes = resp.bytes().map_err(|e| format!("fish read error: {e}"))?;
    let cache_dir = tts_cache_dir();
    fs::create_dir_all(&cache_dir).map_err(|e| format!("fish cache dir error: {e}"))?;
    fs::write(&cache_path, &bytes).map_err(|e| format!("fish write error: {e}"))?;

    let duration = afinfo_duration_seconds(&cache_path).unwrap_or_else(|| estimate_tts_seconds(text));
    let _ = Command::new("afplay").arg(&cache_path).spawn();
    Ok(duration)
}

fn estimate_tts_seconds(text: &str) -> f32 {
    let chars = text.chars().count().max(1) as f32;
    chars / 13.0
}

fn afinfo_duration_seconds(path: &std::path::Path) -> Option<f32> {
    let output = Command::new("afinfo").arg(path).output().ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    for line in stdout.lines() {
        let line = line.trim();
        if let Some(rest) = line.strip_prefix("estimated duration:") {
            let token = rest.trim().split_whitespace().next()?;
            if let Ok(val) = token.parse::<f32>() {
                return Some(val);
            }
        }
    }
    None
}
