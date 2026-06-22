use crate::types::{ChatMessage, Usage};
use futures_util::StreamExt;
use tauri::{AppHandle, Emitter};

#[tauri::command]
pub async fn chat(
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