use super::{AiProvider, ChatMessage, ChatOptions};

// Stub for Stage 1 — real HTTP streaming in Stage 3
pub struct OllamaProvider {
    pub base_url: String,
}

impl OllamaProvider {
    pub fn new(base_url: String) -> Self {
        Self { base_url }
    }
}

impl AiProvider for OllamaProvider {
    fn name(&self) -> &str {
        "ollama"
    }

    async fn list_models(&self) -> Result<Vec<String>, String> {
        // TODO Stage 3: GET {base_url}/api/tags
        Ok(vec!["qwen2.5:3b".to_string()])
    }

    async fn health(&self) -> bool {
        // TODO Stage 3: check connectivity
        false
    }

    async fn chat_stream(
        &self,
        _model: &str,
        _messages: Vec<ChatMessage>,
        _options: ChatOptions,
        _on_chunk: Box<dyn Fn(String) + Send + 'static>,
    ) -> Result<(), String> {
        Err("Not implemented in Stage 1".to_string())
    }
}

// Future: LlamaCppProvider stub
pub struct LlamaCppProvider;
impl AiProvider for LlamaCppProvider {
    fn name(&self) -> &str {
        "llamacpp"
    }
    async fn list_models(&self) -> Result<Vec<String>, String> {
        Err("llama.cpp not implemented yet".to_string())
    }
    async fn health(&self) -> bool {
        false
    }
    async fn chat_stream(
        &self,
        _model: &str,
        _messages: Vec<ChatMessage>,
        _options: ChatOptions,
        _on_chunk: Box<dyn Fn(String) + Send + 'static>,
    ) -> Result<(), String> {
        Err("llama.cpp not implemented yet".to_string())
    }
}
