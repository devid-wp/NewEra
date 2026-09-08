use crate::models::{Memory, Message, Space};

// Assistant replies that claim to be an AI without memory/identity, or that dodge the
// question instead of answering from the stored facts, contradict the user profile.
// Keeping them in history poisons the model's continuation, so they are dropped
// together with the user turn that triggered them.
fn contradicts_user_profile(text: &str) -> bool {
    let t = text.to_lowercase();
    [
        "i am an ai",
        "i'm an ai",
        "i am a language model",
        "i'm a language model",
        "as an ai",
        "i don't have memories",
        "i don't have a memory",
        "i have no personal identity",
        "no personal identity",
        "i have no memories",
        "i do not have memories",
        "without a memory",
        "i am developed by microsoft",
        "developed by microsoft",
        // Russian: hard AI-persona claims
        "как ии",
        "я ии",
        "я являюсь ии",
        "я не имею личной идентичности",
        "не имею личной идентичности",
        "я не имею воспоминаний",
        "не имею воспоминаний",
        "у меня нет памяти",
        "я не обладаю памятью",
        "я не помню",
        "я не могу помнить",
        // Russian: evasive non-answers about the user's identity
        "вы кажетесь",
        "вы ищете информацию о себе",
        "вы в состоянии",
        "я ваш помощник",
        "я – ваш помощник",
        "я - ваш помощник",
        "являюсь виртуальным помощником",
        "звучит так, будто вы упоминаете",
        "не знаю кто вы",
    ]
    .iter()
    .any(|pat| t.contains(pat))
}

fn clean_history(history: &[Message]) -> Vec<Message> {
    let mut cleaned: Vec<Message> = Vec::with_capacity(history.len());
    for msg in history {
        if msg.role == "assistant" && contradicts_user_profile(&msg.content) {
            // drop this stale reply plus the user turn that prompted it
            if let Some(last) = cleaned.last() {
                if last.role == "user" {
                    cleaned.pop();
                }
            }
            continue;
        }
        cleaned.push(msg.clone());
    }
    cleaned
}

// Stage 1 stub — real prompt building in Stage 3
pub fn build_prompt(
    space: &Space,
    memories: &[Memory],
    history: &[Message],
    user_message: &str,
) -> Vec<crate::providers::ChatMessage> {
    let mut messages = Vec::new();

    let mut system_content = space.system_prompt.clone();
    if !memories.is_empty() {
        system_content.push_str(
            "\n\n## Background context about the person you are talking to\n\
             These are stored notes about your conversation partner. Use them to personalize \
             your replies and remember details about them. Never quote these notes verbatim \
             in your responses — instead, talk about them naturally as you would about someone \
             you know.\n",
        );
        for m in memories.iter().take(10) {
            system_content.push_str(&format!("- {}\n", m.content));
        }
        system_content.push_str(
            "\nRules for using these notes:\n\
             - When the user asks about themselves, describe what you know in natural language, \
             do not copy-paste the notes.\n\
             - Never respond with a raw list of facts as your entire answer.\n\
             - Never say \"according to my notes\" or \"the stored facts say\" — just talk naturally.\n\
             - Never claim to be the user or say you have no memory.",
        );
    }

    messages.push(crate::providers::ChatMessage {
        role: "system".to_string(),
        content: system_content,
    });

    let history_src: Vec<Message> = if memories.is_empty() {
        history.to_vec()
    } else {
        clean_history(history)
    };
    for msg in history_src.iter().take(20) {
        messages.push(crate::providers::ChatMessage {
            role: msg.role.clone(),
            content: msg.content.clone(),
        });
    }

    messages.push(crate::providers::ChatMessage {
        role: "user".to_string(),
        content: user_message.to_string(),
    });

    messages
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn msg(role: &str, content: &str) -> Message {
        Message {
            id: "1".into(),
            chat_id: "1".into(),
            role: role.into(),
            content: content.into(),
            created_at: Utc::now(),
        }
    }

    fn mem(content: &str) -> Memory {
        Memory {
            id: "1".into(),
            space_id: "1".into(),
            content: content.into(),
            category: Some("fact".into()),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    fn space() -> Space {
        Space {
            id: "1".into(),
            name: "test".into(),
            icon: "🤖".into(),
            system_prompt: "You are a helpful assistant.".into(),
            model: "phi4-mini:latest".into(),
            temperature: 0.7,
            provider: "ollama".into(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    #[test]
    fn clean_history_removes_ai_personas_with_memory() {
        let history = vec![
            msg("user", "кто я"),
            msg("assistant", "Как ИИ, разработанный Microsoft, я не имею личной идентичности"),
            msg("user", "кто я повторно"),
            msg("assistant", "как ии я не обладаю памятью"),
        ];
        let cleaned = clean_history(&history);
        assert!(cleaned.is_empty());
    }

    #[test]
    fn clean_history_keeps_normal_messages() {
        let history = vec![
            msg("user", "расскажи про Rust"),
            msg("assistant", "Rust — системный язык программирования..."),
            msg("user", "а что такое borrow checker"),
        ];
        let cleaned = clean_history(&history);
        assert_eq!(cleaned.len(), 3);
    }

    #[test]
    fn build_prompt_includes_memory_facts() {
        let msgs = build_prompt(&space(), &[mem("пользователь изучает Rust")], &[], "привет");
        let system = &msgs[0].content;
        assert!(system.contains("пользователь изучает Rust"));
        assert!(system.contains("Background context"));
    }

    #[test]
    fn build_prompt_drops_poisoned_history_when_memory_exists() {
        let history = vec![
            msg("user", "кто я"),
            msg("assistant", "Как ИИ я не имею личной идентичности"),
            msg("user", "привет"),
        ];
        let msgs = build_prompt(&space(), &[mem("пользователь учится программировать")], &history, "пока");
        let roles: Vec<&str> = msgs.iter().map(|m| m.role.as_str()).collect();
        // poisoned user+assistant pair removed; orphaned user("привет") and final user("пока") remain
        assert_eq!(roles, vec!["system", "user", "user"]);
    }

    #[test]
    fn build_prompt_keeps_history_without_memory() {
        let history = vec![
            msg("user", "привет"),
            msg("assistant", "Как ИИ я не имею личной идентичности"),
        ];
        let msgs = build_prompt(&space(), &[], &history, "пока");
        // no memory → history kept unfiltered
        assert!(msgs.len() >= 4); // system + 2 history + user
    }
}
