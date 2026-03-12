// src/app.rs

use std::time::Duration;

use crossterm::event::{Event, KeyCode, KeyEvent};
use rand::{RngCore, rngs::OsRng};

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
    pub history_offset: usize,
}

impl App {
    pub fn new() -> Self {
        App {
            mode: AppMode::Inquiry, // you’ll add Covenant gate later
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
            dev_mode: true,
            last_meta: None,
            submit_history: Vec::new(),
            history_index: None,
            history_offset: 0,
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
                    self.history_offset = self.history_offset.saturating_sub(5);
                }
                KeyCode::PageDown => {
                    self.history_offset = self.history_offset.saturating_add(5);
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
            _ => {}
        }
        (false, None)
    }

    // Called on each tick (for animations)
    pub fn on_tick(&mut self, delta: Duration) {
        let _ = delta;
        self.aura.tick();
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
            None => return (None, Some("Priestess: No access token. Use /seeker then /covenant.".to_string())),
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
                let msg = "Commands: /consent, /seeker, /covenant, /begin, /prescribe [tarot|iching], /reintegrate yes|no, /dev on|off, /status, /help".to_string();
                (None, Some(msg))
            }
            "/dev" => {
                let mode = parts.get(1).copied().unwrap_or("toggle");
                match mode {
                    "on" => self.dev_mode = true,
                    "off" => self.dev_mode = false,
                    _ => self.dev_mode = !self.dev_mode,
                }
                (None, Some(format!("Dev panel: {}", if self.dev_mode { "on" } else { "off" })))
            }
            "/status" => {
                let msg = format!(
                    "Status: base_url={} seeker_id={} session_id={} stage={} pending={}",
                    self.base_url,
                    self.seeker_id.as_deref().unwrap_or("none"),
                    self.session_id.as_deref().unwrap_or("none"),
                    self.stage,
                    self.pending
                );
                (None, Some(msg))
            }
            "/consent" => {
                let req = ApiRequest::GetConsent { base_url: self.base_url.clone() };
                self.pending = true;
                (Some(req), Some("Priestess: Requesting consent disclosures.".to_string()))
            }
            "/seeker" => {
                let device_id = random_hex(16);
                let timezone = std::env::var("TZ").unwrap_or_else(|_| "UTC".to_string());
                let req = ApiRequest::CreateSeeker { base_url: self.base_url.clone(), device_id, timezone };
                self.pending = true;
                (Some(req), Some("Priestess: Creating seeker.".to_string()))
            }
            "/covenant" => {
                let access_token = match &self.access_token {
                    Some(t) => t.clone(),
                    None => return (None, Some("Priestess: No access token. Use /seeker first.".to_string())),
                };
                let seeker_id = match &self.seeker_id {
                    Some(id) => id.clone(),
                    None => return (None, Some("Priestess: No seeker_id. Use /seeker first.".to_string())),
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
                let access_token = match &self.access_token {
                    Some(t) => t.clone(),
                    None => return (None, Some("Priestess: No access token. Use /seeker then /covenant.".to_string())),
                };
                let req = ApiRequest::BeginInquiry {
                    base_url: self.base_url.clone(),
                    access_token,
                };
                self.pending = true;
                (Some(req), Some("Priestess: Opening inquiry (covenant included).".to_string()))
            }
            "/prescribe" => {
                let access_token = match &self.access_token {
                    Some(t) => t.clone(),
                    None => return (None, Some("Priestess: No access token. Use /seeker then /covenant.".to_string())),
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
                self.pending = true;
                (Some(req), Some("Priestess: Requesting prescription.".to_string()))
            }
            "/reintegrate" => {
                let access_token = match &self.access_token {
                    Some(t) => t.clone(),
                    None => return (None, Some("Priestess: No access token. Use /seeker then /covenant.".to_string())),
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
                self.push_message("Consent disclosures:".to_string());
                for d in disclosures {
                    self.push_message(format!("- {}", d));
                }
                self.stage = "consent".to_string();
            }
            ApiResponse::SeekerCreated { seeker_id, access_token, refresh_token, meta } => {
                self.last_meta = Some(meta);
                self.seeker_id = Some(seeker_id.clone());
                self.access_token = Some(access_token);
                self.refresh_token = Some(refresh_token);
                self.stage = "seeker_ready".to_string();
                self.push_message(format!("Priestess: Seeker created: {}", seeker_id));
            }
            ApiResponse::CovenantRecorded { covenant_at, meta } => {
                self.last_meta = Some(meta);
                self.stage = "covenanted".to_string();
                self.push_message(format!("Priestess: Covenant recorded at {}", covenant_at));
            }
            ApiResponse::InquiryQuestion { session_id, turn, question, meta } => {
                self.last_meta = Some(meta);
                self.session_id = Some(session_id);
                self.stage = "inquiry".to_string();
                self.last_turn = Some(turn);
                self.push_message(format!("Priestess (turn {}): {}", turn, question));
            }
            ApiResponse::InquiryComplete { session_id, turn, quality_sense, meta } => {
                self.last_meta = Some(meta);
                self.session_id = Some(session_id);
                self.stage = "inquiry_complete".to_string();
                self.last_turn = Some(turn);
                if let Some(q) = quality_sense {
                    self.push_message(format!("Priestess: {} (turn {})", q, turn));
                } else {
                    self.push_message(format!("Priestess: Inquiry complete (turn {}). Use /prescribe.", turn));
                }
            }
            ApiResponse::Prescribed { rite, meta } => {
                self.last_meta = Some(meta);
                self.stage = "prescribed".to_string();
                self.push_message(format!("Rite: {}", rite.rite_name));
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
                self.push_message("May this mantra instruct you.".to_string());
            }
            ApiResponse::ReintegrationComplete { witness, what_shifted, next, meta } => {
                self.last_meta = Some(meta);
                self.stage = "reintegration_complete".to_string();
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

    fn push_message(&mut self, msg: String) {
        self.messages.push(msg);
        self.history_offset = self.messages.len();
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
