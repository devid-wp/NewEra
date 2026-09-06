pub mod ollama;

use serde::{Deserialize, Serialize};
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatOptions {
    pub temperature: Option<f64>,
    pub num_ctx: Option<u32>,
}

// Trait for future extensibility (Ollama, llama.cpp, etc.)
#[allow(async_fn_in_trait)]
pub trait AiProvider: Send + Sync {
    fn name(&self) -> &str;
    async fn list_models(&self) -> Result<Vec<String>, String>;
    async fn health(&self) -> bool;
    async fn chat_stream(
        &self,
        model: &str,
        messages: Vec<ChatMessage>,
        options: ChatOptions,
        on_chunk: Box<dyn Fn(String) + Send + 'static>,
        abort: Option<Arc<AtomicBool>>,
    ) -> Result<(), String>;
}
