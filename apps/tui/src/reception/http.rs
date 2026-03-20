//! Blocking HTTP helpers for Ouracle reception.

use std::time::Duration;

use color_eyre::eyre::{Result, bail};
use reqwest::blocking::Client;
use serde_json::Value;

// ─── Credentials ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct Credentials {
    pub seeker_id: String,
    pub access_token: String,
    pub refresh_token: String,
}

pub struct RotateResult {
    pub credentials: Credentials,
    pub stage: String,
}

// ─── Client ───────────────────────────────────────────────────────────────────

pub fn make_client() -> Client {
    Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .unwrap_or_else(|_| Client::new())
}

// ─── Low-level HTTP ───────────────────────────────────────────────────────────

fn post_json(client: &Client, url: &str, body: &Value, token: Option<&str>) -> Result<Value> {
    let mut req = client.post(url).json(body);
    if let Some(t) = token {
        req = req.bearer_auth(t);
    }
    let resp = req.send()?;
    let status = resp.status().as_u16();
    let json: Value = resp.json()?;
    if status >= 400 {
        let msg = json
            .get("message")
            .or_else(|| json.get("error"))
            .and_then(|v| v.as_str())
            .unwrap_or("request failed");
        bail!("{msg}");
    }
    Ok(json)
}

fn get_json(client: &Client, url: &str) -> Result<Value> {
    let resp = client.get(url).send()?;
    let status = resp.status().as_u16();
    let json: Value = resp.json()?;
    if status >= 400 {
        let msg = json
            .get("message")
            .or_else(|| json.get("error"))
            .and_then(|v| v.as_str())
            .unwrap_or("request failed");
        bail!("{msg}");
    }
    Ok(json)
}

// ─── Auth calls ───────────────────────────────────────────────────────────────

/// Attempt to rotate a saved refresh token. Returns credentials + stage.
pub fn rotate_token(base_url: &str, refresh_token: &str) -> Result<RotateResult> {
    let c = make_client();
    let body = serde_json::json!({ "refresh_token": refresh_token });
    let resp = post_json(&c, &format!("{base_url}/auth/refresh"), &body, None)?;
    extract_credentials_and_stage(resp)
}

/// Register a new seeker. Returns (credentials, assigned_handle).
/// Errors include "handle_exhausted" if the name is saturated.
pub fn register_seeker(
    base_url: &str,
    name: &str,
    password: &str,
) -> Result<(Credentials, String)> {
    let c = make_client();
    let body = serde_json::json!({
        "name": name,
        "password": password,
        "device_id": hostname(),
        "timezone": iana_timezone(),
    });
    let resp = post_json(&c, &format!("{base_url}/seeker/new"), &body, None)?;
    let handle = resp
        .get("handle")
        .and_then(|v| v.as_str())
        .unwrap_or("?")
        .to_string();
    let creds = extract_credentials(resp)?;
    Ok((creds, handle))
}

/// Sign in a returning seeker. Returns credentials + stage.
pub fn sign_in(base_url: &str, handle: &str, password: &str) -> Result<RotateResult> {
    let c = make_client();
    let body = serde_json::json!({ "handle": handle, "password": password });
    let resp = post_json(&c, &format!("{base_url}/auth/token"), &body, None)?;
    extract_credentials_and_stage(resp)
}

/// Fetch the current covenant. Returns (version, text_lines).
pub fn fetch_covenant(base_url: &str) -> Result<(String, Vec<String>)> {
    let c = make_client();
    let resp = get_json(&c, &format!("{base_url}/covenant/current"))?;
    let version = resp
        .get("version")
        .and_then(|v| v.as_str())
        .unwrap_or("1.0")
        .to_string();
    let lines = resp
        .get("text")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(str::to_string))
                .collect()
        })
        .unwrap_or_default();
    Ok((version, lines))
}

/// Accept the current covenant.
pub fn accept_covenant(base_url: &str, access_token: &str) -> Result<()> {
    let c = make_client();
    post_json(
        &c,
        &format!("{base_url}/covenant"),
        &serde_json::json!({}),
        Some(access_token),
    )?;
    Ok(())
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

fn extract_credentials(json: Value) -> Result<Credentials> {
    let seeker_id = json
        .get("seeker_id")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let access_token = json
        .get("access_token")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let refresh_token = json
        .get("refresh_token")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if seeker_id.is_empty() || access_token.is_empty() {
        bail!("missing credentials in response");
    }
    Ok(Credentials {
        seeker_id,
        access_token,
        refresh_token,
    })
}

fn extract_credentials_and_stage(json: Value) -> Result<RotateResult> {
    let stage = json
        .get("stage")
        .and_then(|v| v.as_str())
        .unwrap_or("covenanted")
        .to_string();
    let credentials = extract_credentials(json)?;
    Ok(RotateResult { credentials, stage })
}

pub fn hostname() -> String {
    std::process::Command::new("hostname")
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .unwrap_or_else(|| "unknown".to_string())
}

pub fn iana_timezone() -> String {
    std::fs::read_link("/etc/localtime")
        .ok()
        .and_then(|p| {
            let s = p.to_string_lossy().into_owned();
            s.find("zoneinfo/").map(|i| s[i + 9..].to_string())
        })
        .unwrap_or_else(|| "UTC".to_string())
}
