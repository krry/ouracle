// src/app.rs

use std::time::Duration;

use crossterm::event::{Event, KeyCode, KeyEvent, MouseEventKind};
use rand::{RngCore, rngs::OsRng};

use crate::aura::Aura;
use crate::api::{ApiMeta, ApiRequest, ApiResponse};
use crate::totem::{Totem, SeekerPreferences};
use crate::totem as totem_store;
use std::path::PathBuf;

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
    pub messages: Vec<String>, // later becomes structured Priestess/Seeker turns
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
    pub history_offset: usize, // lines up from bottom (0 = pinned to latest)
    pub mouse_capture: bool,
    pub mouse_capture_dirty: bool,
    pub pending_seeker_after_consent: bool,
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
}

impl App {
    pub fn new() -> Self {
        App {
            mode: AppMode::Covenant,
            input: String::new(),
            messages: Vec::new(),
            aura: Aura::new(),
            base_url: std::env::var("OURACLE_API_URL").unwrap_or_else(|_| "http://127.0.0.1:3737".to_string()),
            access_token: None,
            refresh_token: None,
            seeker_id: None,
            session_id: None,
            stage: "disconnected".to_string(),
            last_turn: None,
            pending: false,
            dev_mode: false,
            last_meta: None,
            submit_history: Vec::new(),
            history_index: None,
            history_offset: 0,
            mouse_capture: true,
            mouse_capture_dirty: false,
            pending_seeker_after_consent: false,
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
        }
    }

    // Called on each key event
    pub fn on_event(&mut self, event: &Event) -> (bool, Option<ApiRequest>) {
        match event {
            Event::Key(KeyEvent { code, .. }) => match code {
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
            },
            Event::Mouse(mouse) => {
                match mouse.kind {
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

    // Called on each tick (for animations)
    pub fn on_tick(&mut self, delta: Duration) {
        self.aura.tick(delta);
        let dt_s = delta.as_secs_f32();
        let rate = 4.0;
        let factor = (dt_s * rate).clamp(0.0, 1.0);
        self.voice_intensity =
            self.voice_intensity + factor * (self.voice_target - self.voice_intensity);
    }

    fn parse_input(&mut self, line: &str) -> (Option<ApiRequest>, Option<String>) {
        if line.starts_with('/') {
            return self.parse_command(line);
        }

        if self.session_id.is_none() {
            return (None, Some("Priestess: Use /begin to start an inquiry.".to_string()));
        }

        let access_token = match &self.access_token {
            Some(t) => t.clone(),
            None => return (None, Some("Priestess: No access token. Use /welcome then /covenant.".to_string())),
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
                let msg = "Commands: /consent, /covenant-text, /welcome, /covenant, /begin, /intromit, /prescribe [tarot|iching], /thread, /redact <session_id>, /delete, /reintegrate yes|no, /totem status|init|export <path>|import <path>, /token, /mouse on|off, /dev on|off, /status, /help".to_string();
                (None, Some(msg))
            }
            "/dev" => {
                let mode = parts.get(1).copied().unwrap_or("toggle");
                match mode {
                    "on" => self.dev_mode = true,
                    "off" => self.dev_mode = false,
                    _ => self.dev_mode = !self.dev_mode,
                }
                (None, None)
            }
            "/status" => {
                let msg = format!(
                    "Status: base_url={} seeker_id={} session_id={} stage={} pending={} mouse_capture={} sessions_completed={} totem={}",
                    self.base_url,
                    self.seeker_id.as_deref().unwrap_or("none"),
                    self.session_id.as_deref().unwrap_or("none"),
                    self.stage,
                    self.pending,
                    if self.mouse_capture { "on" } else { "off" },
                    self.sessions_completed,
                    if self.totem.is_some() { "loaded" } else { "none" }
                );
                (None, Some(msg))
            }
            "/sessions" => {
                (None, Some(format!("Sessions completed: {}", self.sessions_completed)))
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
                self.pending_seeker_after_consent = true;
                (Some(req), Some("Priestess: Requesting consent disclosures.".to_string()))
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
                self.push_message("Consent disclosures:".to_string());
                for d in disclosures {
                    self.push_message(format!("- {}", d));
                }
                self.stage = "consent".to_string();
                if self.pending_seeker_after_consent {
                    let device_id = random_hex(16);
                    let timezone = std::env::var("TZ").unwrap_or_else(|_| "UTC".to_string());
                    self.queued_request = Some(ApiRequest::CreateSeeker {
                        base_url: self.base_url.clone(),
                        device_id,
                        timezone,
                    });
                    self.pending = true;
                    self.pending_seeker_after_consent = false;
                    self.push_message("Priestess: Consent received. Creating seeker...".to_string());
                }
            }
            ApiResponse::CovenantText { version, text, meta } => {
                self.last_meta = Some(meta);
                self.mode = AppMode::Covenant;
                self.push_message(format!("Covenant v{}:", version));
                for line in text {
                    self.push_message(format!("- {}", line));
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
                self.push_message(format!("Priestess: Seeker created: {}", seeker_id));
            }
            ApiResponse::CovenantRecorded { covenant_at, meta } => {
                self.last_meta = Some(meta);
                self.mode = AppMode::Covenant;
                self.stage = "covenanted".to_string();
                self.push_message(format!("Priestess: Covenant recorded at {}", covenant_at));
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
        let is_priestess = msg.starts_with("Priestess")
            || msg.starts_with("Rite:")
            || msg.starts_with("Witness:")
            || msg.starts_with("Shift:")
            || msg.starts_with("Next:");
        if is_priestess {
            self.voice_target = 1.0;
            self.aura.launch_ripples(0.7);
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

fn random_hex(bytes_len: usize) -> String {
    let mut bytes = vec![0u8; bytes_len];
    OsRng.fill_bytes(&mut bytes);
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}
