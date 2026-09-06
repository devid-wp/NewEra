use super::{AiProvider, ChatMessage, ChatOptions};
use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

#[derive(Debug, Deserialize)]
struct OllamaTags {
    models: Vec<OllamaModel>,
}

#[derive(Debug, Deserialize)]
struct OllamaModel {
    name: String,
}

#[derive(Debug, Deserialize)]
struct OllamaChunk {
    message: Option<OllamaChatMessage>,
    done: Option<bool>,
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct OllamaChatMessage {
    content: String,
}

#[derive(Debug, Serialize)]
struct ChatRequest<'a> {
    model: &'a str,
    messages: Vec<ChatRequestMessage<'a>>,
    stream: bool,
    options: ChatRequestOptions,
}

#[derive(Debug, Serialize)]
struct ChatRequestMessage<'a> {
    role: &'a str,
    content: &'a str,
}

#[derive(Debug, Serialize, Default)]
struct ChatRequestOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    num_ctx: Option<u32>,
}

pub struct OllamaProvider {
    pub base_url: String,
    client: Client,
}

impl OllamaProvider {
    pub fn new(base_url: String) -> Self {
        Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            client: Client::builder()
                .connect_timeout(Duration::from_secs(10))
                .timeout(Duration::from_secs(300)) // 5 min max per request
                .build()
                .unwrap_or_else(|_| Client::new()),
        }
    }

    fn url(&self, path: &str) -> String {
        format!("{}{}", self.base_url, path)
    }
}

impl AiProvider for OllamaProvider {
    fn name(&self) -> &str {
        "ollama"
    }

    async fn list_models(&self) -> Result<Vec<String>, String> {
        let resp = self
            .client
            .get(self.url("/api/tags"))
            .send()
            .await
            .map_err(|e| format!("Ollama request failed: {}", e))?;
        if !resp.status().is_success() {
            return Err(format!("Ollama returned status {}", resp.status()));
        }
        let tags: OllamaTags = resp
            .json()
            .await
            .map_err(|e| format!("Failed to parse /api/tags: {}", e))?;
        Ok(tags.models.into_iter().map(|m| m.name).collect())
    }

    async fn health(&self) -> bool {
        let url = self.url("/api/tags");
        match self.client.get(&url).send().await {
            Ok(resp) => {
                let ok = resp.status().is_success();
                if !ok {
                    eprintln!("[ollama] health check failed: url={} status={}", url, resp.status());
                }
                ok
            }
            Err(e) => {
                eprintln!("[ollama] health check error: url={} error={}", url, e);
                false
            }
        }
    }

    async fn chat_stream(
        &self,
        model: &str,
        messages: Vec<ChatMessage>,
        options: ChatOptions,
        on_chunk: Box<dyn Fn(String) + Send + 'static>,
        abort: Option<Arc<AtomicBool>>,
    ) -> Result<(), String> {
        let req_messages: Vec<ChatRequestMessage> = messages
            .iter()
            .map(|m| ChatRequestMessage {
                role: &m.role,
                content: &m.content,
            })
            .collect();

        let body = ChatRequest {
            model,
            messages: req_messages,
            stream: true,
            options: ChatRequestOptions {
                temperature: options.temperature,
                num_ctx: options.num_ctx,
            },
        };

        let resp = self
            .client
            .post(self.url("/api/chat"))
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Ollama chat request failed: {}", e))?;
        if !resp.status().is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("Ollama returned status: {text}"));
        }

        let mut byte_stream = resp.bytes_stream();
        let mut _saw_done = false;

        while let Some(chunk_res) = byte_stream.next().await {
            // Check abort flag before processing each chunk
            if let Some(ref flag) = abort {
                if flag.load(Ordering::Relaxed) {
                    eprintln!("[ollama] abort flag set — stopping stream");
                    return Ok(());
                }
            }

            match chunk_res {
                Ok(chunk) => {
                    let text = String::from_utf8_lossy(&chunk);
                    for line in text.lines() {
                        let line = line.trim();
                        if line.is_empty() {
                            continue;
                        }
                        match serde_json::from_str::<OllamaChunk>(line) {
                            Ok(parsed) => {
                                if let Some(err) = parsed.error {
                                    return Err(err);
                                }
                                if let Some(msg) = parsed.message {
                                    if !msg.content.is_empty() {
                                        on_chunk(msg.content);
                                    }
                                }
                                if parsed.done.unwrap_or(false) {
                                    _saw_done = true;
                                    return Ok(());
                                }
                            }
                            Err(e) => {
                                // Don't kill the stream on a single malformed line —
                                // log and continue (Ollama sometimes sends partial JSON)
                                eprintln!("[ollama] skipping malformed chunk: {} | line: {}", e, &line[..line.len().min(120)]);
                            }
                        }
                    }
                }
                Err(e) => {
                    // Stream read error — log and break gracefully
                    // (partial response is already in the DB placeholder)
                    eprintln!("[ollama] stream read error (partial response saved): {}", e);
                    return Err(format!("Stream interrupted: {}", e));
                }
            }
        }

        // Stream ended without `done: true` — Ollama closed connection early
        // Return Ok so the caller saves whatever we got
        if !_saw_done {
            eprintln!("[ollama] stream ended without done=true (partial response)");
        }
        Ok(())
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
        _abort: Option<Arc<AtomicBool>>,
    ) -> Result<(), String> {
        Err("llama.cpp not implemented yet".to_string())
    }
}
