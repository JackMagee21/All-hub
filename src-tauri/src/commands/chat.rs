use crate::types::Usage;
use futures_util::StreamExt;
use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Serialize, Clone, Debug, Default)]
pub struct ToolCall {
    pub id: String,
    pub name: String,
    pub arguments: String,
}

#[tauri::command]
pub async fn chat(
    app: AppHandle,
    model_id: String,
    messages: Vec<serde_json::Value>,
    api_key: String,
    max_tokens: u32,
    tools_enabled: bool,
) -> Result<(), String> {
    let client = reqwest::Client::new();

    let mut body = serde_json::json!({
        "model": model_id,
        "messages": messages,
        "stream": true,
        "max_tokens": max_tokens,
        "stream_options": { "include_usage": true }
    });

    if tools_enabled {
        body["tools"] = serde_json::json!([
            {
                "type": "function",
                "function": {
                    "name": "create_file",
                    "description": "Create or overwrite a file on the user's computer. Use when the user asks you to create, write, or save a file.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "path": {
                                "type": "string",
                                "description": "File path e.g. 'hello.py' or 'src/utils.ts'"
                            },
                            "content": {
                                "type": "string",
                                "description": "The complete content to write to the file"
                            },
                            "description": {
                                "type": "string",
                                "description": "One-line description of what this file does"
                            }
                        },
                        "required": ["path", "content"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "read_file",
                    "description": "Read the contents of an existing file on the user's computer.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "path": {
                                "type": "string",
                                "description": "The file path to read"
                            }
                        },
                        "required": ["path"]
                    }
                }
            }
        ]);
    }

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
    let mut tool_calls: Vec<ToolCall> = Vec::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        let text = String::from_utf8_lossy(&chunk);

        for line in text.lines() {
            if let Some(data) = line.strip_prefix("data: ") {
                if data == "[DONE]" {
                    if !tool_calls.is_empty() {
                        app.emit("chat-tool-calls", tool_calls.clone()).ok();
                    }
                    app.emit("chat-done", usage.clone()).ok();
                    return Ok(());
                }

                if let Ok(val) = serde_json::from_str::<serde_json::Value>(data) {
                    if let Some(u) = val.get("usage") {
                        if !u.is_null() {
                            usage = Some(Usage {
                                prompt_tokens: u["prompt_tokens"].as_u64().unwrap_or(0) as u32,
                                completion_tokens: u["completion_tokens"].as_u64().unwrap_or(0)
                                    as u32,
                            });
                        }
                    }

                    let choice = &val["choices"][0];

                    if let Some(token) = choice["delta"]["content"].as_str() {
                        app.emit("chat-token", token).ok();
                    }

                    // Accumulate tool call fragments
                    if let Some(calls) = choice["delta"]["tool_calls"].as_array() {
                        for call in calls {
                            let index = call["index"].as_u64().unwrap_or(0) as usize;
                            while tool_calls.len() <= index {
                                tool_calls.push(ToolCall::default());
                            }
                            if let Some(id) = call["id"].as_str() {
                                tool_calls[index].id = id.to_string();
                            }
                            if let Some(name) = call["function"]["name"].as_str() {
                                tool_calls[index].name.push_str(name);
                            }
                            if let Some(args) = call["function"]["arguments"].as_str() {
                                tool_calls[index].arguments.push_str(args);
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(())
}
