use std::io::{BufRead, BufReader};
use std::sync::{mpsc, Mutex};
use std::time::Duration;

use reqwest::blocking::Client;
use serde_json::Value;

use ripl::providers::{ApiResponse, Message, Provider, Role};

pub struct OuracleProvider {
    pub base_url: String,
    pub access_token: String,
    pub session_id: Mutex<Option<String>>,
    pub stub: bool,
}

impl OuracleProvider {
    pub fn new(base_url: String, access_token: String, session_id: Option<String>) -> Self {
        let stub = std::env::var("OURACLE_STUB").is_ok();
        Self {
            base_url,
            access_token,
            session_id: Mutex::new(session_id),
            stub,
        }
    }
}

impl Provider for OuracleProvider {
    fn stream(&self, messages: &[Message], tx: mpsc::Sender<ApiResponse>) {
        if self.stub {
            let question = messages
                .iter()
                .rev()
                .find(|m| m.role == Role::User)
                .map(|m| m.content.as_str())
                .unwrap_or("…");
            let reply = format!("[stub] received: {question}");
            let _ = tx.send(ApiResponse::TokenChunk { token: reply });
            let _ = tx.send(ApiResponse::TurnComplete);
            return;
        }

        let client = match Client::builder()
            // No timeout — SSE streams can run for several seconds.
            .timeout(Duration::from_secs(90))
            .build()
        {
            Ok(c) => c,
            Err(e) => {
                let _ = tx.send(ApiResponse::Error { message: e.to_string() });
                return;
            }
        };

        let current_session_id = self.session_id.lock().unwrap().clone();
        let Some(session_id) = current_session_id else {
            let _ = tx.send(ApiResponse::Error {
                message: "No active session. Restart ripltui to open a new session.".to_string(),
            });
            return;
        };

        let last_user = messages
            .iter()
            .rev()
            .find(|m| m.role == Role::User)
            .map(|m| m.content.as_str())
            .unwrap_or("");

        let body = serde_json::json!({ "session_id": session_id, "message": last_user });

        let resp = match client
            .post(format!("{}/chat", self.base_url))
            .bearer_auth(&self.access_token)
            .json(&body)
            .send()
        {
            Ok(r) => r,
            Err(e) => {
                let _ = tx.send(ApiResponse::Error { message: e.to_string() });
                return;
            }
        };

        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let body = resp.text().unwrap_or_default();
            let _ = tx.send(ApiResponse::Error {
                message: format!("HTTP {status}: {body}"),
            });
            return;
        }

        let reader = BufReader::new(resp);
        for line in reader.lines().flatten() {
            let Some(json_str) = line.strip_prefix("data: ") else {
                continue;
            };
            let Ok(event) = serde_json::from_str::<Value>(json_str) else {
                continue;
            };
            match event.get("type").and_then(|t| t.as_str()) {
                Some("session") => {
                    if let Some(sid) = event.get("session_id").and_then(|s| s.as_str()) {
                        *self.session_id.lock().unwrap() = Some(sid.to_string());
                    }
                }
                Some("token") => {
                    if let Some(token) = event.get("token").and_then(|t| t.as_str()) {
                        let _ = tx.send(ApiResponse::TokenChunk { token: token.to_string() });
                    }
                }
                Some("break") => {
                    let _ = tx.send(ApiResponse::TokenChunk { token: "\n\n".to_string() });
                }
                Some("complete") => {
                    let stage = event.get("stage").and_then(|s| s.as_str()).unwrap_or("");
                    if let Some(sid) = event.get("session_id").and_then(|s| s.as_str()) {
                        *self.session_id.lock().unwrap() = Some(sid.to_string());
                    }
                    if stage == "complete" {
                        *self.session_id.lock().unwrap() = None;
                    }
                    let _ = tx.send(ApiResponse::TurnComplete);
                    break;
                }
                Some("error") => {
                    let msg = event
                        .get("message")
                        .and_then(|m| m.as_str())
                        .unwrap_or("API error")
                        .to_string();
                    let _ = tx.send(ApiResponse::Error { message: msg });
                    break;
                }
                _ => {}
            }
        }
    }

    fn handle_command(&self, cmd: &str, tx: mpsc::Sender<ApiResponse>) {
        if cmd == "/signout" {
            let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
            let config_path = std::path::PathBuf::from(home).join(".ouracle").join("ripl.toml");
            let _ = std::fs::remove_file(&config_path);
            let _ = tx.send(ApiResponse::TokenChunk { token: "Signing out…".to_string() });
            let _ = tx.send(ApiResponse::TurnComplete);
            std::thread::sleep(std::time::Duration::from_millis(800));
            let _ = tx.send(ApiResponse::Exit);
            return;
        }
        if cmd != "/reset" {
            return;
        }

        if self.stub {
            let _ = tx.send(ApiResponse::TokenChunk { token: "[stub] session reset.".to_string() });
            let _ = tx.send(ApiResponse::TurnComplete);
            return;
        }

        let client = match Client::builder()
            .timeout(Duration::from_secs(12))
            .build()
        {
            Ok(c) => c,
            Err(e) => {
                let _ = tx.send(ApiResponse::Error { message: e.to_string() });
                return;
            }
        };

        // Fetch current covenant version.
        let covenant = match client
            .get(format!("{}/covenant/current", self.base_url))
            .send()
            .and_then(|r| r.json::<Value>())
        {
            Ok(v) => v,
            Err(e) => {
                let _ = tx.send(ApiResponse::Error { message: e.to_string() });
                return;
            }
        };
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

        let resp = match client
            .post(format!("{}/session/new", self.base_url))
            .bearer_auth(&self.access_token)
            .json(&body)
            .send()
        {
            Ok(r) => r,
            Err(e) => {
                let _ = tx.send(ApiResponse::Error { message: e.to_string() });
                return;
            }
        };

        let json: Value = match resp.json() {
            Ok(v) => v,
            Err(e) => {
                let _ = tx.send(ApiResponse::Error { message: e.to_string() });
                return;
            }
        };

        if let Some(sid) = json.get("session_id").and_then(|v| v.as_str()) {
            *self.session_id.lock().unwrap() = Some(sid.to_string());
        }

        // Send greeting + opening question as the new turn.
        if let Some(greeting) = json.get("greeting").and_then(|v| v.as_str()) {
            let _ = tx.send(ApiResponse::TokenChunk { token: greeting.to_string() });
            let _ = tx.send(ApiResponse::TokenChunk { token: "\n\n".to_string() });
        }
        if let Some(question) = json.get("question").and_then(|v| v.as_str()) {
            let _ = tx.send(ApiResponse::TokenChunk { token: question.to_string() });
        }
        let _ = tx.send(ApiResponse::TurnComplete);
    }
}
