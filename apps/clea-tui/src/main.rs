mod provider;
mod reception;

use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Arc;
use std::time::Duration;

use ripl::RunOptions;

use color_eyre::eyre::{bail, eyre, Result};
use serde::{Deserialize, Serialize};

use provider::OuracleProvider;
use ripl::providers::{Message, Role};
use ripl::session::SessionCache;

// Embedded ambient scripts — written to ~/.ouracle/ by `clea ambiance on`
const AMBIENT_RUNNER: &str = include_str!("../../../api/scripts/ambient-runner.js");
const AMBIENT_PLAYER: &str = include_str!("../../../api/ambient-player.js");

// ─── Config ───────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Default, Clone)]
pub struct Config {
    pub base_url: Option<String>,
    pub seeker_id: Option<String>,
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
    pub voice_id: Option<String>,
    pub ambiance: Option<bool>,
    pub voices: Option<Vec<String>>,
}

const CONFIG_TEMPLATE: &str = r#"# Clea — ~/.ouracle/config.toml

# Ouracle API endpoint
# base_url = "https://api.ouracle.kerry.ink"

# Fish Audio voice ID — find one with `clea voices list`
# voice_id = ""

# Ambient sound during sessions (requires `clea ambiance on` to initialize)
# ambiance = true

# Saved voice IDs — manage with `clea voices add/rm`
# voices = []
"#;

fn ouracle_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".ouracle")
}

fn config_path() -> PathBuf {
    ouracle_dir().join("config.toml")
}

fn ambient_runner_path() -> PathBuf {
    ouracle_dir().join("ambient-runner.js")
}

fn ambient_player_path() -> PathBuf {
    ouracle_dir().join("ambient-player.js")
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

fn resolve_voice_id(cfg: &Config) -> Option<String> {
    cfg.voice_id
        .clone()
        .filter(|v| !v.is_empty())
        .or_else(|| std::env::var("FISH_AUDIO_VOICE_ONDREA").ok())
        .or_else(|| std::env::var("FISH_AUDIO_VOICE_GALADRIEL").ok())
        .or_else(|| std::env::var("FISH_AUDIO_VOICE_ID").ok())
}

fn resolve_ambient_cmd(cfg: &Config) -> Option<PathBuf> {
    if cfg.ambiance == Some(false) {
        return None;
    }
    let path = ambient_runner_path();
    if path.exists() { Some(path) } else { None }
}

// ─── CLI commands ─────────────────────────────────────────────────────────────

fn cmd_config() -> Result<()> {
    let path = config_path();
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)?;
    }
    if !path.exists() {
        fs::write(&path, CONFIG_TEMPLATE)?;
        println!("Created {}", path.display());
    }
    let editor = std::env::var("EDITOR").unwrap_or_else(|_| "open".to_string());
    Command::new(&editor).arg(&path).status()?;
    Ok(())
}

fn cmd_voices_list(cfg: &Config) -> Result<()> {
    let api_key = std::env::var("FISH_AUDIO_API_KEY")
        .or_else(|_| std::env::var("FISH_API_KEY"))
        .map_err(|_| eyre!("FISH_AUDIO_API_KEY not set"))?;

    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()?;

    let resp = client
        .get("https://api.fish.audio/model")
        .bearer_auth(&api_key)
        .query(&[("page_size", "20"), ("self", "false"), ("type", "tts")])
        .send()?;

    if !resp.status().is_success() {
        bail!("Fish Audio API error: {}", resp.status());
    }

    let json: serde_json::Value = resp.json()?;
    let items = json.get("items").and_then(|v| v.as_array());

    let saved = cfg.voices.as_deref().unwrap_or(&[]);
    let active = cfg.voice_id.as_deref().unwrap_or("");

    match items {
        None => println!("No voices found."),
        Some(voices) => {
            println!("{:<38} {}", "ID", "Name");
            println!("{}", "─".repeat(60));
            for v in voices {
                let id = v.get("_id").and_then(|v| v.as_str()).unwrap_or("?");
                let name = v.get("title").and_then(|v| v.as_str()).unwrap_or("?");
                let star = if saved.contains(&id.to_string()) { " ★" } else { "" };
                let dot  = if active == id { " ◆" } else { "" };
                println!("{:<38} {}{}{}", id, name, star, dot);
            }
            println!("\n★ saved  ◆ active");
        }
    }
    Ok(())
}

fn cmd_voices_set(cfg: &mut Config, id: &str) -> Result<()> {
    cfg.voice_id = Some(id.to_string());
    save_config(cfg)?;
    println!("Active voice → {id}");
    Ok(())
}

fn cmd_voices_add(cfg: &mut Config, id: &str) -> Result<()> {
    let voices = cfg.voices.get_or_insert_with(Vec::new);
    if !voices.contains(&id.to_string()) {
        voices.push(id.to_string());
        save_config(cfg)?;
        println!("Saved {id}");
    } else {
        println!("{id} already saved.");
    }
    Ok(())
}

fn cmd_voices_rm(cfg: &mut Config, id: &str) -> Result<()> {
    if let Some(voices) = cfg.voices.as_mut() {
        voices.retain(|v| v != id);
        save_config(cfg)?;
        println!("Removed {id}");
    }
    Ok(())
}

fn cmd_ambiance(cfg: &mut Config, on: bool) -> Result<()> {
    let dir = ouracle_dir();
    fs::create_dir_all(&dir)?;

    if on {
        // Write embedded scripts to ~/.ouracle/
        let runner_path = ambient_runner_path();
        let player_path = ambient_player_path();

        // Patch the runner to use a relative import from the same dir
        let runner = AMBIENT_RUNNER.replace(
            "from '../ambient-player.js'",
            "from './ambient-player.js'",
        );
        fs::write(&runner_path, runner)?;
        fs::write(&player_path, AMBIENT_PLAYER)?;

        cfg.ambiance = Some(true);
        save_config(cfg)?;
        println!("Ambiance on.");
        println!("Note: audio files needed in ~/.ouracle/data/ambient/");
        println!("Run the download script to fetch them:");
        println!("  bun ~/.ouracle/ambient-runner.js --download");
    } else {
        cfg.ambiance = Some(false);
        save_config(cfg)?;
        println!("Ambiance off.");
    }
    Ok(())
}

fn cmd_help() {
    println!(
        r#"Clea — terminal oracle

USAGE
  clea                        start a session
  clea config                 open config in $EDITOR
  clea voices list            list available Fish Audio voices
  clea voices set <id>        set active voice
  clea voices add <id>        save a voice to your list
  clea voices rm <id>         remove a voice from your list
  clea ambiance on|off        toggle ambient sound
  clea help                   show this message"#
    );
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

    let args: Vec<String> = std::env::args().collect();
    let argv: Vec<&str> = args.iter().map(|s| s.as_str()).collect();

    let mut cfg = load_config();

    match argv.as_slice() {
        [_, "config"]                       => return cmd_config(),
        [_, "voices", "list"]               => return cmd_voices_list(&cfg),
        [_, "voices", "set", id]            => return cmd_voices_set(&mut cfg, id),
        [_, "voices", "add", id]            => return cmd_voices_add(&mut cfg, id),
        [_, "voices", "rm", id]             => return cmd_voices_rm(&mut cfg, id),
        [_, "ambiance", "on"]               => return cmd_ambiance(&mut cfg, true),
        [_, "ambiance", "off"]              => return cmd_ambiance(&mut cfg, false),
        [_, "help"] | [_, "--help"] | [_, "-h"] => { cmd_help(); return Ok(()); }
        [_] => {} // fall through to TUI
        _ => { cmd_help(); return Ok(()); }
    }

    let base_url = resolve_base_url(&cfg);

    ripl::with_terminal(|terminal| {
        let creds = reception::tui::ensure_credentials(terminal, &cfg, &base_url)?;
        let Some(creds) = creds else {
            return Ok(());
        };

        cfg.access_token = Some(creds.access_token.clone());
        cfg.refresh_token = Some(creds.refresh_token.clone());
        cfg.seeker_id = Some(creds.seeker_id.clone());
        cfg.base_url = Some(base_url.clone());
        save_config(&cfg)?;

        let bootstrap = bootstrap_session(&base_url, &creds.access_token)?;
        seed_ripl_session(&bootstrap);

        let provider = Arc::new(OuracleProvider::new(
            base_url.clone(),
            creds.access_token.clone(),
            Some(bootstrap.session_id),
        ));

        ripl::run_in_terminal(terminal, RunOptions {
            provider: Some(provider),
            label: Some("Ouracle".to_string()),
            ambient_cmd: resolve_ambient_cmd(&cfg),
            voice_id: resolve_voice_id(&cfg),
        })
    })
}
