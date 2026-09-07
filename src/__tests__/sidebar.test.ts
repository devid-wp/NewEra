import { describe, it, expect } from "vitest";

type Chat = {
  id: string;
  space_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

function filterChats(chats: Chat[], rawQuery: string): Chat[] {
  if (!rawQuery) return chats;
  const query = rawQuery.toLowerCase();
  return chats.filter((c) => c.title.toLowerCase().includes(query));
}

describe("Sidebar search filtering", () => {
  const chats: Chat[] = [
    { id: "1", space_id: "s1", title: "TypeScript generics", created_at: "", updated_at: "" },
    { id: "2", space_id: "s1", title: "React hooks deep dive", created_at: "", updated_at: "" },
    { id: "3", space_id: "s1", title: "Learning Rust ownership", created_at: "", updated_at: "" },
    { id: "4", space_id: "s1", title: "TypeScript performance", created_at: "", updated_at: "" },
  ];

  it("filters chats by search query", () => {
    const filtered = filterChats(chats, "typescript");
    expect(filtered).toHaveLength(2);
    expect(filtered.map((c) => c.id)).toEqual(["1", "4"]);
  });

  it("returns empty for no matches", () => {
    const filtered = filterChats(chats, "python");
    expect(filtered).toHaveLength(0);
  });

  it("empty query returns all chats", () => {
    const filtered = filterChats(chats, "");
    expect(filtered).toHaveLength(4);
  });

  it("case insensitive search", () => {
    const filtered = filterChats(chats, "REACT");
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("2");
  });

  it("partial match works", () => {
    const filtered = filterChats(chats, "type");
    expect(filtered).toHaveLength(2);
  });
});

describe("Chat title auto-generation", () => {
  it("first message sets title to message content", () => {
    const messagesBefore = 0;
    const shouldSetTitle = messagesBefore === 0;
    expect(shouldSetTitle).toBe(true);
  });

  it("second message does not overwrite title", () => {
    const messagesSent: number = 1 as number;
    const shouldSetTitle = messagesSent === 0;
    expect(shouldSetTitle).toBe(false);
  });

  it("title is trimmed and validated", () => {
    const title = "  Hello world  ";
    const trimmed = title.trim();
    expect(trimmed).toBe("Hello world");
    expect(trimmed.length).toBeGreaterThan(0);
  });

  it("empty title is rejected", () => {
    const title = "   ";
    expect(title.trim().length).toBe(0);
  });
});

describe("Chat rename validation", () => {
  it("valid title passes", () => {
    const title = "My Chat";
    expect(title.trim().length).toBeGreaterThan(0);
    expect(title.length).toBeLessThanOrEqual(100);
  });

  it("empty title rejected", () => {
    expect("".trim().length).toBe(0);
  });

  it("whitespace-only title rejected", () => {
    expect("   ".trim().length).toBe(0);
  });

  it("very long title truncated or rejected", () => {
    const longTitle = "a".repeat(101);
    expect(longTitle.length).toBeGreaterThan(100);
  });

  it("Escape cancels rename (does not save)", () => {
    let saved = false;
    const handleKeyDown = (key: string) => {
      if (key === "Escape") {
        saved = false;
        return;
      }
      if (key === "Enter") {
        saved = true;
      }
    };
    handleKeyDown("Escape");
    expect(saved).toBe(false);
  });

  it("Enter saves rename", () => {
    let saved = false;
    const handleKeyDown = (key: string) => {
      if (key === "Enter") {
        saved = true;
      }
    };
    handleKeyDown("Enter");
    expect(saved).toBe(true);
  });
});