import { create } from "zustand";
import type { Space, Chat, Message } from "@/api/tauri";

type State = {
  spaces: Space[];
  activeSpaceId: string | null;
  chats: Chat[];
  activeChatId: string | null;
  messages: Message[];
  setSpaces: (s: Space[]) => void;
  setActiveSpace: (id: string) => void;
  setChats: (c: Chat[]) => void;
  setActiveChat: (id: string | null) => void;
  setMessages: (m: Message[]) => void;
};

export const useAppStore = create<State>((set) => ({
  spaces: [],
  activeSpaceId: null,
  chats: [],
  activeChatId: null,
  messages: [],
  setSpaces: (spaces) => set({ spaces }),
  setActiveSpace: (activeSpaceId) => set({ activeSpaceId, activeChatId: null, chats: [], messages: [] }),
  setChats: (chats) => set({ chats }),
  setActiveChat: (activeChatId) => set({ activeChatId }),
  setMessages: (messages) => set({ messages }),
}));
