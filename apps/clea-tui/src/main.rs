mod provider;
mod reception;

use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use ripl::RunOptions;

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
        let ambient_cmd = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../api/scripts/ambient-runner.js");
        let voice_id = std::env::var("FISH_AUDIO_VOICE_ONDREA").ok()
            .or_else(|| std::env::var("FISH_AUDIO_VOICE_GALADRIEL").ok())
            .or_else(|| std::env::var("FISH_AUDIO_VOICE_ID").ok());
        ripl::run_in_terminal(terminal, RunOptions {
            provider: Some(provider),
            label: Some("Ouracle".to_string()),
            ambient_cmd: Some(ambient_cmd),
            voice_id,
        })
    })
}
