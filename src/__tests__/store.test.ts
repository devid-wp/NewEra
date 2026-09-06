import { describe, it, expect } from "vitest";
import { useAppStore } from "@/stores/useAppStore";

describe("App Store", () => {
  it("has initial state", () => {
    const store = useAppStore.getState();
    expect(store.spaces).toEqual([]);
    expect(store.activeSpaceId).toBeNull();
    expect(store.chats).toEqual([]);
    expect(store.activeChatId).toBeNull();
    expect(store.messages).toEqual([]);
    expect(store.memoriesOpen).toBe(false);
  });

  it("can set memories open", () => {
    useAppStore.setState({ memoriesOpen: true });
    expect(useAppStore.getState().memoriesOpen).toBe(true);
    useAppStore.setState({ memoriesOpen: false });
    expect(useAppStore.getState().memoriesOpen).toBe(false);
  });

  it("can open space palette", () => {
    useAppStore.setState({ activeSpaceId: "1" });
    expect(useAppStore.getState().activeSpaceId).toBe("1");
    useAppStore.setState({ activeSpaceId: null });
    expect(useAppStore.getState().activeSpaceId).toBeNull();
  });
});