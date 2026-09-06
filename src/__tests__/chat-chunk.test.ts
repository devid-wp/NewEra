import { describe, it, expect } from "vitest";

describe("ChatChunk type", () => {
  it("has the correct structure", () => {
    const chunk = { chatId: "1", delta: "Hello", done: false } as const;
    expect(chunk.chatId).toBe("1");
    expect(chunk.delta).toBe("Hello");
    expect(chunk.done).toBe(false);
  });

  it("done can be true", () => {
    const chunk = { chatId: "1", delta: "", done: true } as const;
    expect(chunk.done).toBe(true);
    expect(chunk.delta).toBe("");
  });
});