use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Space {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub system_prompt: String,
    pub model: String,
    pub temperature: f64,
    pub provider: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateSpacePayload {
    pub name: String,
    pub icon: Option<String>,
    pub system_prompt: Option<String>,
    pub model: Option<String>,
    pub temperature: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateSpacePayload {
    pub name: Option<String>,
    pub icon: Option<String>,
    pub system_prompt: Option<String>,
    pub model: Option<String>,
    pub temperature: Option<f64>,
}
