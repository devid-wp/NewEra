import { describe, it, expect } from "vitest";

describe("Prompt Builder Logic", () => {
  const testSpace = {
    id: "1",
    name: "Test",
    icon: "test",
    system_prompt: "You are a helpful assistant.",
    model: "qwen2.5:3b",
    temperature: 0.7,
    provider: "ollama",
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
  };

  const testMemories = [
    { id: "1", space_id: "1", content: "Remember to be concise", category: "preference", created_at: "2024-01-01", updated_at: "2024-01-01" },
    { id: "2", space_id: "1", content: "Use TypeScript for code", category: "skill", created_at: "2024-01-01", updated_at: "2024-01-01" },
  ];

  const testHistory = [
    { id: "1", chat_id: "1", role: "user", content: "Hello", created_at: "2024-01-01" },
    { id: "2", chat_id: "1", role: "assistant", content: "Hi there!", created_at: "2024-01-01" },
  ];

  function buildPrompt(space: any, memories: any[], history: any[], userMessage: string) {
    const messages = [];

    let systemContent = space.system_prompt;
    if (memories.length > 0) {
      systemContent += "\n\n## Long-term memory:\n";
      for (const m of memories.slice(0, 10)) {
        systemContent += `- ${m.content}\n`;
      }
    }

    messages.push({ role: "system", content: systemContent });

    for (const msg of history.slice(0, 20)) {
      messages.push({ role: msg.role, content: msg.content });
    }

    messages.push({ role: "user", content: userMessage });

    return messages;
  }

  it("builds prompt with system message, memories, and history", () => {
    const result = buildPrompt(testSpace, testMemories, testHistory, "How are you?");

    // System + 2 history messages + new user message = 4
    expect(result.length).toBe(4);
    expect(result[0].role).toBe("system");
    expect(result[0].content).toContain("You are a helpful assistant.");
    expect(result[0].content).toContain("Long-term memory:");
    expect(result[0].content).toContain("Remember to be concise");
    expect(result[0].content).toContain("Use TypeScript for code");
    // History messages at indices 1 and 2
    expect(result[1].role).toBe("user");
    expect(result[1].content).toBe("Hello");
    expect(result[2].role).toBe("assistant");
    expect(result[2].content).toBe("Hi there!");
    // New user message at index 3
    expect(result[3].role).toBe("user");
    expect(result[3].content).toBe("How are you?");
  });

  it("builds prompt without memories", () => {
    const result = buildPrompt(testSpace, [], testHistory, "Test message");

    // System + 2 history messages + new user message = 4
    expect(result.length).toBe(4);
    expect(result[0].content).toBe("You are a helpful assistant.");
    expect(result[1].role).toBe("user");
    expect(result[1].content).toBe("Hello");
    expect(result[2].role).toBe("assistant");
    expect(result[2].content).toBe("Hi there!");
    expect(result[3].role).toBe("user");
    expect(result[3].content).toBe("Test message");
  });

  it("builds prompt with empty history", () => {
    const result = buildPrompt(testSpace, testMemories, [], "Test message");

    // System + new user message = 2 (memories are included in system)
    expect(result.length).toBe(2);
    expect(result[0].role).toBe("system");
    expect(result[0].content).toContain("Long-term memory:");
    expect(result[1].role).toBe("user");
    expect(result[1].content).toBe("Test message");
  });
});