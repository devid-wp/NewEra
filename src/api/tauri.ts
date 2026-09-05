import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type Space = {
  id: string;
  name: string;
  icon: string;
  system_prompt: string;
  model: string;
  temperature: number;
  provider: string;
  created_at: string;
  updated_at: string;
};

export type Chat = {
  id: string;
  space_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  chat_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

export type Memory = {
  id: string;
  space_id: string;
  content: string;
  category: string | null;
  created_at: string;
  updated_at: string;
};

export const api = {
  listSpaces: () => invoke<Space[]>("list_spaces"),
  createSpace: (payload: { name: string; icon?: string; system_prompt?: string; model?: string; temperature?: number }) =>
    invoke<Space>("create_space", { payload }),
  updateSpace: (id: string, payload: { name?: string; icon?: string; system_prompt?: string; model?: string; temperature?: number }) =>
    invoke<Space>("update_space", { id, payload }),
  deleteSpace: (id: string) => invoke<void>("delete_space", { id }),

  listChats: (spaceId: string) => invoke<Chat[]>("list_chats", { spaceId }),
  createChat: (spaceId: string, title?: string) => invoke<Chat>("create_chat", { spaceId, title }),
  deleteChat: (chatId: string) => invoke<void>("delete_chat", { chatId }),
  renameChat: (chatId: string, title: string) => invoke<Chat>("rename_chat", { chatId, title }),
  listMessages: (chatId: string) => invoke<Message[]>("list_messages", { chatId }),

  sendMessage: (spaceId: string, chatId: string, content: string) =>
    invoke<void>("send_message", { spaceId, chatId, content }),
  abortGeneration: (chatId: string) => invoke<void>("abort_generation", { chatId }),

  listMemories: (spaceId: string) => invoke<Memory[]>("list_memories", { spaceId }),
  addMemory: (spaceId: string, content: string, category?: string) =>
    invoke<Memory>("add_memory", { spaceId, content, category }),
  deleteMemory: (id: string) => invoke<void>("delete_memory", { id }),

  listModels: () => invoke<string[]>("list_models"),
  healthCheck: () => invoke<{ ollama: boolean; db: boolean }>("health_check"),
  getSettings: () => invoke<Record<string, string>>("get_settings"),
  setSettings: (key: string, value: string) => invoke<void>("set_settings", { key, value }),
  setChatTitle: (chatId: string, title: string) => invoke<void>("set_chat_title", { chatId, title }),
  exportChat: (chatId: string) => invoke<string>("export_chat", { chatId }),
};

export type ChatChunk = { chatId: string; delta: string; done: boolean };

export function onChatChunk(cb: (c: ChatChunk) => void) {
  return listen<ChatChunk>("chat:chunk", (e) => cb(e.payload));
}
