use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::time::{Duration, Instant};
use chrono::Utc;

#[derive(Debug, Clone)]
pub enum ApiRequest {
    GetConsent { base_url: String },
    GetCovenant { base_url: String },
    CreateSeeker { base_url: String, device_id: String, timezone: String },
    RecordCovenant { base_url: String, access_token: String, seeker_id: String },
    BeginInquiry { base_url: String, access_token: String },
    ContinueInquiry { base_url: String, access_token: String, session_id: String, response: String },
    Prescribe { base_url: String, access_token: String, session_id: String, divination_source: Option<String> },
    FetchThread { base_url: String, access_token: String, seeker_id: String },
    DeleteSeeker { base_url: String, access_token: String, seeker_id: String },
    RedactSession { base_url: String, access_token: String, seeker_id: String, session_id: String },
    Reintegrate { base_url: String, access_token: String, session_id: String, enacted: bool },
    Shutdown,
}

#[derive(Debug, Clone)]
pub enum ApiResponse {
    Consent { disclosures: Vec<String>, meta: ApiMeta },
    CovenantText { version: String, text: Vec<String>, meta: ApiMeta },
    SeekerCreated { seeker_id: String, access_token: String, refresh_token: String, meta: ApiMeta },
    CovenantRecorded { covenant_at: String, meta: ApiMeta },
    InquiryQuestion { session_id: String, turn: u32, question: String, greeting: Option<String>, meta: ApiMeta },
    InquiryComplete { session_id: String, turn: u32, quality_sense: Option<String>, meta: ApiMeta },
    Prescribed { rite: Rite, reintegration_window: Option<String>, meta: ApiMeta },
    Thread { items: Vec<ThreadItem>, meta: ApiMeta },
    SeekerDeleted { seeker_id: String, meta: ApiMeta },
    SessionRedacted { session_id: String, meta: ApiMeta },
    ReintegrationComplete { witness: String, what_shifted: String, next: String, meta: ApiMeta },
    Error { message: String, meta: ApiMeta },
    ShutdownAck,
}

#[derive(Debug, Clone)]
pub struct ApiMeta {
    pub endpoint: String,
    pub status: u16,
    pub duration_ms: u128,
    pub request: Option<String>,
    pub response: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Rite {
    pub rite_name: String,
    pub act: String,
    pub invocation: String,
    pub textures: Vec<String>,
    pub orientation: String,
    pub context: Option<String>,
    pub duration: Option<String>,
    pub divination: Option<Divination>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct Divination {
    pub source: String,
    pub quality: Option<String>,
    pub score: Option<f64>,
    pub card: Option<DivinationCard>,
    pub hexagram: Option<DivinationHexagram>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct DivinationCard {
    pub name: String,
    pub suit: Option<String>,
    pub rank: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct DivinationHexagram {
    pub number: u32,
    pub name: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ThreadItem {
    pub id: String,
    pub stage: Option<String>,
    pub quality: Option<String>,
    pub enacted: Option<bool>,
    pub rite_name: Option<String>,
    pub created_at: Option<String>,
    pub completed_at: Option<String>,
}

pub fn execute(req: ApiRequest) -> ApiResponse {
    if matches!(req, ApiRequest::Shutdown) {
        return ApiResponse::ShutdownAck;
    }

    let client = Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .unwrap_or_else(|_| Client::new());
    match req {
        ApiRequest::GetConsent { base_url } => {
            let started = Instant::now();
            let endpoint = "/consent".to_string();
            let url = format!("{base_url}/consent");
            match client.get(url).send() {
                Ok(resp) => {
                    let status = resp.status().as_u16();
                    match resp.json::<Value>() {
                        Ok(json) => {
                            let meta = build_meta(endpoint, status, started.elapsed().as_millis(), None, Some(&json));
                        let disclosures = json
                            .get("disclosures")
                            .and_then(|v| v.as_array())
                            .map(|arr| {
                                arr.iter()
                                    .filter_map(|s| s.as_str().map(|x| x.to_string()))
                                    .collect::<Vec<_>>()
                            })
                            .unwrap_or_default();
                            ApiResponse::Consent { disclosures, meta }
                        }
                        Err(err) => ApiResponse::Error {
                            message: format!("Invalid JSON: {err}"),
                            meta: build_meta(endpoint, status, started.elapsed().as_millis(), None, None),
                        },
                    }
                }
                Err(err) => ApiResponse::Error {
                    message: err.to_string(),
                    meta: build_meta(endpoint, 0, started.elapsed().as_millis(), None, None),
                },
            }
        }
        ApiRequest::GetCovenant { base_url } => {
            let started = Instant::now();
            let endpoint = "/covenant/current".to_string();
            let url = format!("{base_url}/covenant/current");
            match client.get(url).send() {
                Ok(resp) => {
                    let status = resp.status().as_u16();
                    match resp.json::<Value>() {
                        Ok(json) if status < 400 => {
                            let meta = build_meta(endpoint, status, started.elapsed().as_millis(), None, Some(&json));
                            let version = json.get("version").and_then(|v| v.as_i64()).map(|v| v.to_string()).unwrap_or_else(|| "unknown".to_string());
                            let text = json.get("text")
                                .and_then(|v| v.as_array())
                                .map(|arr| arr.iter().filter_map(|s| s.as_str().map(|x| x.to_string())).collect::<Vec<_>>())
                                .unwrap_or_default();
                            ApiResponse::CovenantText { version, text, meta }
                        }
                        Ok(json) => {
                            let msg = json.get("error").and_then(|v| v.as_str()).unwrap_or("Request failed.");
                            ApiResponse::Error {
                                message: msg.to_string(),
                                meta: build_meta(endpoint, status, started.elapsed().as_millis(), None, Some(&json)),
                            }
                        }
                        Err(err) => ApiResponse::Error {
                            message: format!("Invalid JSON: {err}"),
                            meta: build_meta(endpoint, status, started.elapsed().as_millis(), None, None),
                        },
                    }
                }
                Err(err) => ApiResponse::Error {
                    message: err.to_string(),
                    meta: build_meta(endpoint, 0, started.elapsed().as_millis(), None, None),
                },
            }
        }
        ApiRequest::CreateSeeker { base_url, device_id, timezone } => {
            let started = Instant::now();
            let endpoint = "/seeker/new".to_string();
            let url = format!("{base_url}/seeker/new");
            let body = serde_json::json!({
                "device_id": device_id,
                "email_hash": null,
                "timezone": timezone,
                "consented": true,
                "consent_version": "1.0"
            });
            match client.post(url).json(&body).send() {
                Ok(resp) => {
                    let status = resp.status().as_u16();
                    match resp.json::<Value>() {
                        Ok(json) if status < 400 => {
                            let meta = build_meta(endpoint, status, started.elapsed().as_millis(), Some(&body), Some(&json));
                            let seeker_id = json.get("seeker_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                            let access_token = json.get("access_token").and_then(|v| v.as_str()).unwrap_or("").to_string();
                            let refresh_token = json.get("refresh_token").and_then(|v| v.as_str()).unwrap_or("").to_string();
                            if seeker_id.is_empty() || access_token.is_empty() || refresh_token.is_empty() {
                                ApiResponse::Error {
                                    message: "Seeker created response missing tokens or seeker_id.".to_string(),
                                    meta,
                                }
                            } else {
                                ApiResponse::SeekerCreated { seeker_id, access_token, refresh_token, meta }
                            }
                        }
                        Ok(json) => {
                            let msg = json.get("error").and_then(|v| v.as_str()).unwrap_or("Request failed.");
                            ApiResponse::Error {
                                message: msg.to_string(),
                                meta: build_meta(endpoint, status, started.elapsed().as_millis(), Some(&body), Some(&json)),
                            }
                        }
                        Err(err) => ApiResponse::Error {
                            message: format!("Invalid JSON: {err}"),
                            meta: build_meta(endpoint, status, started.elapsed().as_millis(), Some(&body), None),
                        },
                    }
                }
                Err(err) => ApiResponse::Error {
                    message: err.to_string(),
                    meta: build_meta(endpoint, 0, started.elapsed().as_millis(), Some(&body), None),
                },
            }
        }
        ApiRequest::RecordCovenant { base_url, access_token, seeker_id } => {
            let started = Instant::now();
            let endpoint = format!("/seeker/{}/covenant", seeker_id);
            let url = format!("{base_url}/seeker/{seeker_id}/covenant");
            let body = serde_json::json!({ "covenant_version": "1.0" });
            match client.post(url).bearer_auth(access_token).json(&body).send() {
                Ok(resp) => {
                    let status = resp.status().as_u16();
                    match resp.json::<Value>() {
                        Ok(json) if status < 400 => {
                            let meta = build_meta(endpoint, status, started.elapsed().as_millis(), Some(&body), Some(&json));
                            let covenant_at = json.get("covenant_at").and_then(|v| v.as_str()).unwrap_or("").to_string();
                            ApiResponse::CovenantRecorded { covenant_at, meta }
                        }
                        Ok(json) => {
                            let msg = json.get("error").and_then(|v| v.as_str()).unwrap_or("Request failed.");
                            ApiResponse::Error {
                                message: msg.to_string(),
                                meta: build_meta(endpoint, status, started.elapsed().as_millis(), Some(&body), Some(&json)),
                            }
                        }
                        Err(err) => ApiResponse::Error {
                            message: format!("Invalid JSON: {err}"),
                            meta: build_meta(endpoint, status, started.elapsed().as_millis(), Some(&body), None),
                        },
                    }
                }
                Err(err) => ApiResponse::Error {
                    message: err.to_string(),
                    meta: build_meta(endpoint, 0, started.elapsed().as_millis(), Some(&body), None),
                },
            }
        }
        ApiRequest::BeginInquiry { base_url, access_token } => {
            let started = Instant::now();
            let endpoint = "/session/new".to_string();
            let url = format!("{base_url}/session/new");
            let body = serde_json::json!({
                "covenant": {
                    "version": 1,
                    "accepted": true,
                    "timestamp": Utc::now().to_rfc3339(),
                }
            });
            match client.post(url).bearer_auth(access_token).json(&body).send() {
                Ok(resp) => {
                    let status = resp.status().as_u16();
                    match resp.json::<Value>() {
                        Ok(json) if status < 400 => {
                            let meta = build_meta(endpoint, status, started.elapsed().as_millis(), Some(&body), Some(&json));
                            let session_id = json.get("session_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                            let turn = json.get("turn").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                            let question = json.get("question").and_then(|v| v.as_str()).unwrap_or("...").to_string();
                            let greeting = json.get("greeting").and_then(|v| v.as_str()).map(|s| s.to_string());
                            ApiResponse::InquiryQuestion { session_id, turn, question, greeting, meta }
                        }
                        Ok(json) => {
                            let msg = json.get("error").and_then(|v| v.as_str()).unwrap_or("Request failed.");
                            ApiResponse::Error {
                                message: msg.to_string(),
                                meta: build_meta(endpoint, status, started.elapsed().as_millis(), Some(&body), Some(&json)),
                            }
                        }
                        Err(err) => ApiResponse::Error {
                            message: format!("Invalid JSON: {err}"),
                            meta: build_meta(endpoint, status, started.elapsed().as_millis(), Some(&body), None),
                        },
                    }
                }
                Err(err) => ApiResponse::Error {
                    message: err.to_string(),
                    meta: build_meta(endpoint, 0, started.elapsed().as_millis(), Some(&body), None),
                },
            }
        }
        ApiRequest::ContinueInquiry { base_url, access_token, session_id, response } => {
            let started = Instant::now();
            let endpoint = "/inquire".to_string();
            let url = format!("{base_url}/inquire");
            let body = serde_json::json!({ "session_id": session_id, "response": response });
            match client.post(url).bearer_auth(access_token).json(&body).send() {
                Ok(resp) => {
                    let status = resp.status().as_u16();
                    match resp.json::<Value>() {
                        Ok(json) if status < 400 => {
                            let meta = build_meta(endpoint, status, started.elapsed().as_millis(), Some(&body), Some(&json));
                            let stage = json.get("stage").and_then(|v| v.as_str()).unwrap_or("");
                            let session_id = json.get("session_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                            let turn = json.get("turn").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                            if stage == "inquiry_complete" {
                                let quality_sense = json.get("quality_sense").and_then(|v| v.as_str()).map(|s| s.to_string());
                                ApiResponse::InquiryComplete { session_id, turn, quality_sense, meta }
                            } else {
                                let question = json.get("question").and_then(|v| v.as_str()).unwrap_or("...").to_string();
                                ApiResponse::InquiryQuestion { session_id, turn, question, greeting: None, meta }
                            }
                        }
                        Ok(json) => {
                            let msg = json.get("error").and_then(|v| v.as_str()).unwrap_or("Request failed.");
                            ApiResponse::Error {
                                message: msg.to_string(),
                                meta: build_meta(endpoint, status, started.elapsed().as_millis(), Some(&body), Some(&json)),
                            }
                        }
                        Err(err) => ApiResponse::Error {
                            message: format!("Invalid JSON: {err}"),
                            meta: build_meta(endpoint, status, started.elapsed().as_millis(), Some(&body), None),
                        },
                    }
                }
                Err(err) => ApiResponse::Error {
                    message: err.to_string(),
                    meta: build_meta(endpoint, 0, started.elapsed().as_millis(), Some(&body), None),
                },
            }
        }
        ApiRequest::Prescribe { base_url, access_token, session_id, divination_source } => {
            let started = Instant::now();
            let endpoint = "/prescribe".to_string();
            let url = format!("{base_url}/prescribe");
            let body = serde_json::json!({
                "session_id": session_id,
                "divination_source": divination_source
            });
            match client.post(url).bearer_auth(access_token).json(&body).send() {
                Ok(resp) => {
                    let status = resp.status().as_u16();
                    match resp.json::<Value>() {
                        Ok(json) if status < 400 => {
                            let meta = build_meta(endpoint, status, started.elapsed().as_millis(), Some(&body), Some(&json));
                            match json.get("rite") {
                                Some(rite) => {
                                    let rite: Rite = serde_json::from_value(rite.clone()).unwrap_or(Rite {
                                        rite_name: "Unknown Rite".to_string(),
                                        act: "No act returned.".to_string(),
                                        invocation: "No invocation.".to_string(),
                                        textures: vec![],
                                        orientation: "unknown".to_string(),
                                        context: None,
                                        duration: None,
                                        divination: None,
                                    });
                                    let reintegration_window = json.get("reintegration_window").and_then(|v| v.as_str()).map(|s| s.to_string());
                                    ApiResponse::Prescribed { rite, reintegration_window, meta }
                                }
                                None => ApiResponse::Error {
                                    message: "No rite returned.".to_string(),
                                    meta,
                                },
                            }
                        }
                        Ok(json) => {
                            let msg = json.get("error").and_then(|v| v.as_str()).unwrap_or("Request failed.");
                            ApiResponse::Error {
                                message: msg.to_string(),
                                meta: build_meta(endpoint, status, started.elapsed().as_millis(), Some(&body), Some(&json)),
                            }
                        }
                        Err(err) => ApiResponse::Error {
                            message: format!("Invalid JSON: {err}"),
                            meta: build_meta(endpoint, status, started.elapsed().as_millis(), Some(&body), None),
                        },
                    }
                }
                Err(err) => ApiResponse::Error {
                    message: err.to_string(),
                    meta: build_meta(endpoint, 0, started.elapsed().as_millis(), Some(&body), None),
                },
            }
        }
        ApiRequest::FetchThread { base_url, access_token, seeker_id } => {
            let started = Instant::now();
            let endpoint = format!("/seeker/{}/thread", seeker_id);
            let url = format!("{base_url}/seeker/{seeker_id}/thread");
            match client.get(url).bearer_auth(access_token).send() {
                Ok(resp) => {
                    let status = resp.status().as_u16();
                    match resp.json::<Value>() {
                        Ok(json) if status < 400 => {
                            let meta = build_meta(endpoint, status, started.elapsed().as_millis(), None, Some(&json));
                            let items = json.get("thread")
                                .and_then(|v| v.as_array())
                                .map(|arr| {
                                    arr.iter().filter_map(|item| {
                                        serde_json::from_value::<ThreadItem>(item.clone()).ok()
                                    }).collect::<Vec<_>>()
                                })
                                .unwrap_or_default();
                            ApiResponse::Thread { items, meta }
                        }
                        Ok(json) => {
                            let msg = json.get("error").and_then(|v| v.as_str()).unwrap_or("Request failed.");
                            ApiResponse::Error {
                                message: msg.to_string(),
                                meta: build_meta(endpoint, status, started.elapsed().as_millis(), None, Some(&json)),
                            }
                        }
                        Err(err) => ApiResponse::Error {
                            message: format!("Invalid JSON: {err}"),
                            meta: build_meta(endpoint, status, started.elapsed().as_millis(), None, None),
                        },
                    }
                }
                Err(err) => ApiResponse::Error {
                    message: err.to_string(),
                    meta: build_meta(endpoint, 0, started.elapsed().as_millis(), None, None),
                },
            }
        }
        ApiRequest::DeleteSeeker { base_url, access_token, seeker_id } => {
            let started = Instant::now();
            let endpoint = format!("/seeker/{}", seeker_id);
            let url = format!("{base_url}/seeker/{seeker_id}");
            match client.delete(url).bearer_auth(access_token).send() {
                Ok(resp) => {
                    let status = resp.status().as_u16();
                    match resp.json::<Value>() {
                        Ok(json) if status < 400 => {
                            let meta = build_meta(endpoint, status, started.elapsed().as_millis(), None, Some(&json));
                            let seeker_id = json.get("seeker_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                            ApiResponse::SeekerDeleted { seeker_id, meta }
                        }
                        Ok(json) => {
                            let msg = json.get("error").and_then(|v| v.as_str()).unwrap_or("Request failed.");
                            ApiResponse::Error {
                                message: msg.to_string(),
                                meta: build_meta(endpoint, status, started.elapsed().as_millis(), None, Some(&json)),
                            }
                        }
                        Err(err) => ApiResponse::Error {
                            message: format!("Invalid JSON: {err}"),
                            meta: build_meta(endpoint, status, started.elapsed().as_millis(), None, None),
                        },
                    }
                }
                Err(err) => ApiResponse::Error {
                    message: err.to_string(),
                    meta: build_meta(endpoint, 0, started.elapsed().as_millis(), None, None),
                },
            }
        }
        ApiRequest::RedactSession { base_url, access_token, seeker_id, session_id } => {
            let started = Instant::now();
            let endpoint = format!("/seeker/{}/thread/{}/redact", seeker_id, session_id);
            let url = format!("{base_url}/seeker/{seeker_id}/thread/{session_id}/redact");
            match client.patch(url).bearer_auth(access_token).send() {
                Ok(resp) => {
                    let status = resp.status().as_u16();
                    match resp.json::<Value>() {
                        Ok(json) if status < 400 => {
                            let meta = build_meta(endpoint, status, started.elapsed().as_millis(), None, Some(&json));
                            let session_id = json.get("session_id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                            ApiResponse::SessionRedacted { session_id, meta }
                        }
                        Ok(json) => {
                            let msg = json.get("error").and_then(|v| v.as_str()).unwrap_or("Request failed.");
                            ApiResponse::Error {
                                message: msg.to_string(),
                                meta: build_meta(endpoint, status, started.elapsed().as_millis(), None, Some(&json)),
                            }
                        }
                        Err(err) => ApiResponse::Error {
                            message: format!("Invalid JSON: {err}"),
                            meta: build_meta(endpoint, status, started.elapsed().as_millis(), None, None),
                        },
                    }
                }
                Err(err) => ApiResponse::Error {
                    message: err.to_string(),
                    meta: build_meta(endpoint, 0, started.elapsed().as_millis(), None, None),
                },
            }
        }
        ApiRequest::Reintegrate { base_url, access_token, session_id, enacted } => {
            let started = Instant::now();
            let endpoint = "/reintegrate".to_string();
            let url = format!("{base_url}/reintegrate");
            let body = serde_json::json!({
                "session_id": session_id,
                "report": { "enacted": enacted }
            });
            match client.post(url).bearer_auth(access_token).json(&body).send() {
                Ok(resp) => {
                    let status = resp.status().as_u16();
                    match resp.json::<Value>() {
                        Ok(json) if status < 400 => {
                            let meta = build_meta(endpoint, status, started.elapsed().as_millis(), Some(&body), Some(&json));
                            let witness = json.get("witness").and_then(|v| v.as_str()).unwrap_or("").to_string();
                            let what_shifted = json.get("what_shifted").and_then(|v| v.as_str()).unwrap_or("").to_string();
                            let next = json.get("next").and_then(|v| v.as_str()).unwrap_or("").to_string();
                            ApiResponse::ReintegrationComplete { witness, what_shifted, next, meta }
                        }
                        Ok(json) => {
                            let msg = json.get("error").and_then(|v| v.as_str()).unwrap_or("Request failed.");
                            ApiResponse::Error {
                                message: msg.to_string(),
                                meta: build_meta(endpoint, status, started.elapsed().as_millis(), Some(&body), Some(&json)),
                            }
                        }
                        Err(err) => ApiResponse::Error {
                            message: format!("Invalid JSON: {err}"),
                            meta: build_meta(endpoint, status, started.elapsed().as_millis(), Some(&body), None),
                        },
                    }
                }
                Err(err) => ApiResponse::Error {
                    message: err.to_string(),
                    meta: build_meta(endpoint, 0, started.elapsed().as_millis(), Some(&body), None),
                },
            }
        }
        ApiRequest::Shutdown => ApiResponse::ShutdownAck,
    }
}

fn build_meta(endpoint: String, status: u16, duration_ms: u128, request: Option<&Value>, response: Option<&Value>) -> ApiMeta {
    ApiMeta {
        endpoint,
        status,
        duration_ms,
        request: request.and_then(|v| serde_json::to_string_pretty(v).ok()),
        response: response.and_then(|v| serde_json::to_string_pretty(v).ok()),
    }
}
