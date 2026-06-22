use serde::{Deserialize, Serialize};

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
#[serde(rename_all = "camelCase")]
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