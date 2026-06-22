use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use keyring::Entry;

const SERVICE: &str = "ai-hub";
const ACCOUNT: &str = "openrouter";

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Serialize, Clone)]
pub struct Usage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ModelPricing {
    pub prompt: String,
    pub completion: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ModelArchitecture {
    pub modality: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RemoteModel {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub context_length: Option<u32>,
    pub pricing: Option<ModelPricing>,
    pub architecture: Option<ModelArchitecture>,
}

#[derive(Deserialize)]
pub struct ModelsResponse {
    pub data: Vec<RemoteModel>,
}

#[tauri::command]
fn save_key(key: String) -> Result<(), String> {
    Entry::new(SERVICE, ACCOUNT)
        .map_err(|e| e.to_string())?
        .set_password(&key)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_key() -> Result<Option<String>, String> {
    match Entry::new(SERVICE, ACCOUNT)
        .map_err(|e| e.to_string())?
        .get_password()
    {
        Ok(key) => Ok(Some(key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn delete_key() -> Result<(), String> {
    match Entry::new(SERVICE, ACCOUNT)
        .map_err(|e| e.to_string())?
        .delete_password()
    {
        Ok(_) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
async fn fetch_models() -> Result<Vec<RemoteModel>, String> {
    let client = reqwest::Client::new();

    let response = client
        .get("https://openrouter.ai/api/v1/models")
        .header("User-Agent", "AI-Hub/0.1.0")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }

    let parsed: ModelsResponse = response.json().await.map_err(|e| e.to_string())?;
    Ok(parsed.data)
}

#[tauri::command]
async fn chat(
    app: AppHandle,
    model_id: String,
    messages: Vec<ChatMessage>,
    api_key: String,
) -> Result<(), String> {
    let client = reqwest::Client::new();

    let body = serde_json::json!({
        "model": model_id,
        "messages": messages,
        "stream": true,
        "max_tokens": 1024,
        "stream_options": { "include_usage": true }
    });

    let response = client
        .post("https://openrouter.ai/api/v1/chat/completions")
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("HTTP {}: {}", status, body));
    }

    let mut stream = response.bytes_stream();
    let mut usage: Option<Usage> = None;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        let text = String::from_utf8_lossy(&chunk);

        for line in text.lines() {
            if let Some(data) = line.strip_prefix("data: ") {
                if data == "[DONE]" {
                    app.emit("chat-done", usage.clone()).ok();
                    return Ok(());
                }
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(data) {
                    if let Some(u) = val.get("usage") {
                        if !u.is_null() {
                            usage = Some(Usage {
                                prompt_tokens: u["prompt_tokens"].as_u64().unwrap_or(0) as u32,
                                completion_tokens: u["completion_tokens"].as_u64().unwrap_or(0) as u32,
                            });
                        }
                    }
                    if let Some(token) = val["choices"][0]["delta"]["content"].as_str() {
                        app.emit("chat-token", token).ok();
                    }
                }
            }
        }
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![chat, fetch_models, save_key, get_key, delete_key])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}