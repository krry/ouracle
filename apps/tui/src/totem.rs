use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Totem {
    pub totem_version: String,
    pub totem_id: String,
    pub created_at: String,
    pub updated_at: String,
    pub seeker_preferences: SeekerPreferences,
    pub sessions: Vec<TotemSession>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeekerPreferences {
    pub oracle_flavor: String,
    pub timezone: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TotemSession {
    pub session_id: String,
    pub created_at: String,
    pub completed_at: Option<String>,
    pub rite_name: Option<String>,
    pub octave_quality: Option<String>,
}

pub fn default_path() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join(".ouracle").join("totem.json")
}

pub fn now_iso() -> String {
    let secs = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
    format!("{}", secs)
}

pub fn load(path: &PathBuf) -> Option<Totem> {
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

pub fn save(path: &PathBuf, totem: &Totem) -> std::io::Result<()> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)?;
    }
    let raw = serde_json::to_string_pretty(totem).unwrap_or_else(|_| "{}".to_string());
    fs::write(path, raw)
}
