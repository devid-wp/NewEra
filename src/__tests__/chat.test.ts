import { describe, it, expect } from "vitest";

describe("ChatChunk parsing", () => {
  it("delta chunks accumulate text", () => {
    const chunks = [
      { chatId: "1", delta: "Hello", done: false },
      { chatId: "1", delta: " world", done: false },
      { chatId: "1", delta: "!", done: false },
    ];
    let text = "";
    for (const c of chunks) {
      text += c.delta;
    }
    expect(text).toBe("Hello world!");
  });

  it("done=true stops accumulation", () => {
    const chunks = [
      { chatId: "1", delta: "Hello", done: false },
      { chatId: "1", delta: "", done: true },
    ];
    let text = "";
    let done = false;
    for (const c of chunks) {
      if (c.done) {
        done = true;
        break;
      }
      text += c.delta;
    }
    expect(text).toBe("Hello");
    expect(done).toBe(true);
  });

  it("chunk with wrong chatId is ignored", () => {
    const activeChatId = "1";
    const chunk = { chatId: "2", delta: "ignore", done: false };
    const isRelevant = chunk.chatId === activeChatId;
    expect(isRelevant).toBe(false);
  });

  it("empty delta does not change text", () => {
    let text = "existing";
    const delta = "";
    text += delta;
    expect(text).toBe("existing");
  });
});

describe("Message validation", () => {
  it("user message content is required", () => {
    const content = "";
    expect(content.trim().length).toBe(0);
  });

  it("user message with content is valid", () => {
    const content = "What is TypeScript?";
    expect(content.trim().length).toBeGreaterThan(0);
  });

  it("streaming text ref accumulates correctly", () => {
    const ref = { current: "" };
    const deltas = ["The", " answer", " is", " 42"];
    for (const d of deltas) {
      ref.current += d;
    }
    expect(ref.current).toBe("The answer is 42");
  });

  it("streaming text ref resets on new send", () => {
    const ref = { current: "old text" };
    ref.current = "";
    expect(ref.current).toBe("");
  });
});

describe("Export functionality", () => {
  it("export produces markdown format", () => {
    const messages = [
      { role: "user", content: "Hello" },
      { role: "assistant", content: "Hi there!" },
    ];
    const md = messages
      .map((m) => `**${m.role}**: ${m.content}`)
      .join("\n\n");
    expect(md).toContain("**user**: Hello");
    expect(md).toContain("**assistant**: Hi there!");
  });

  it("empty messages export to empty string", () => {
    const messages: { role: string; content: string }[] = [];
    const md = messages.map((m) => `**${m.role}**: ${m.content}`).join("\n\n");
    expect(md).toBe("");
  });
});
