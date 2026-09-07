use crate::models::{Memory, Message, Space};

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
            "\n\n## User profile / Long-term memory\n\
             The following facts describe the person you are talking to.\n",
        );
        for m in memories.iter().take(10) {
            system_content.push_str(&format!("- {}\n", m.content));
        }
        system_content.push_str(
            "\nUse these facts whenever they are relevant. If asked anything about the user \
             themselves, if a memory fact answers it, use that fact as the authoritative answer.",
        );
    }

    messages.push(crate::providers::ChatMessage {
        role: "system".to_string(),
        content: system_content,
    });

    for msg in history.iter().take(20) {
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
