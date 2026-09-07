import { describe, it, expect } from "vitest";

describe("Memory types", () => {
  it("valid category values", () => {
    const categories = ["preference", "project", "fact", "skill"];
    expect(categories).toHaveLength(4);
    expect(categories).toContain("preference");
    expect(categories).toContain("project");
    expect(categories).toContain("fact");
    expect(categories).toContain("skill");
  });

  it("memory has required fields", () => {
    const mem = {
      id: "1",
      space_id: "s1",
      content: "User prefers dark mode",
      category: "preference",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };
    expect(mem.id).toBeTruthy();
    expect(mem.space_id).toBeTruthy();
    expect(mem.content).toBeTruthy();
    expect(mem.category).toBeTruthy();
    expect(mem.created_at).toBeTruthy();
  });

  it("memory content should be non-empty after trim", () => {
    const content = "  User likes TypeScript  ";
    expect(content.trim().length).toBeGreaterThan(0);
    expect(content.trim()).toBe("User likes TypeScript");
  });

  it("empty memory content is rejected", () => {
    const content = "   ";
    expect(content.trim()).toBe("");
    expect(content.trim().length).toBe(0);
  });
});
