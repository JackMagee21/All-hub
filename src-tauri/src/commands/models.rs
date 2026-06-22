use crate::types::{ModelsResponse, RemoteModel};

#[tauri::command]
pub async fn fetch_models() -> Result<Vec<RemoteModel>, String> {
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