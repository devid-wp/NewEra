import { useEffect, useRef, useState } from "react";
import { api, onChatChunk, type Message } from "@/api/tauri";
import { useAppStore } from "@/stores/useAppStore";
import { Button } from "@/components/ui/button";
import { Send, Square, Cpu, Sparkles } from "lucide-react";

export function ChatView() {
  const { activeSpaceId, activeChatId, spaces } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeSpace = spaces.find((s) => s.id === activeSpaceId);

  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      return;
    }
    api.listMessages(activeChatId).then(setMessages).catch(console.error);
  }, [activeChatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    onChatChunk((c) => {
      if (c.chatId !== activeChatId) return;
      if (c.done) {
        // commit assistant message
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            chat_id: c.chatId,
            role: "assistant",
            content: streamingRef.current,
            created_at: new Date().toISOString(),
          },
        ]);
        streamingRef.current = "";
        setStreaming("");
        setIsStreaming(false);
      } else {
        streamingRef.current += c.delta;
        setStreaming(streamingRef.current);
      }
    }).then((fn) => (unlisten = fn));
    return () => unlisten?.();
  }, [activeChatId]);

  const streamingRef = useRef("");
  // keep ref in sync for commit
  useEffect(() => {
    streamingRef.current = streaming;
  }, [streaming]);

  const send = async () => {
    if (!input.trim() || !activeSpaceId || !activeChatId) return;
    const userMsg: Message = {
      id: crypto.randomUUID(),
      chat_id: activeChatId,
      role: "user",
      content: input,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, userMsg]);
    const text = input;
    setInput("");
    setIsStreaming(true);
    setStreaming("");
    streamingRef.current = "";
    await api.sendMessage(activeSpaceId, activeChatId, text);
  };

  if (!activeSpaceId) {
    return (
      <div className="flex-1 grid place-items-center bg-[#0a0a0a]">
        <div className="text-zinc-500 text-sm">Select a Space to start</div>
      </div>
    );
  }

  if (!activeChatId) {
    return (
      <div className="flex-1 flex flex-col bg-[#0a0a0a]">
        <header className="h-[56px] flex items-center px-6 border-b border-zinc-800 gap-2">
          <span className="text-sm text-zinc-300">
            {activeSpace?.icon} {activeSpace?.name}
          </span>
          <span className="text-zinc-600">·</span>
          <span className="text-xs text-zinc-500 flex items-center gap-1">
            <Cpu size={12} /> {activeSpace?.model}
          </span>
        </header>
        <div className="flex-1 grid place-items-center p-8">
          <div className="max-w-md text-center space-y-4">
            <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 grid place-items-center mx-auto">
              <Sparkles className="text-zinc-400" size={20} />
            </div>
            <h2 className="text-xl font-semibold">New chat in {activeSpace?.name}</h2>
            <p className="text-sm text-zinc-500">
              System: <span className="text-zinc-400">{activeSpace?.system_prompt}</span>
            </p>
            <p className="text-xs text-zinc-600">Чат сохраняется в SQLite (изолирован по Space). Стриминг Ollama — в Этапе 3, сейчас мок через Rust.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a]">
      <header className="h-[56px] shrink-0 flex items-center justify-between px-6 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <span className="font-medium text-sm">{messages[0]?.content.slice(0, 30) || "Chat"}</span>
          <span className="text-xs px-2 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
            {activeSpace?.icon} {activeSpace?.name} · {activeSpace?.model}
          </span>
        </div>
        <div className="text-xs text-zinc-600">Stage 2 • SQLite persistent • {messages.length} msgs</div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto w-full px-6 py-8 space-y-6">
          {messages.map((m) => (
            <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  m.role === "user"
                    ? "max-w-[80%] bg-white text-black rounded-2xl rounded-br-sm px-4 py-3 text-sm leading-relaxed"
                    : "max-w-[85%] bg-zinc-900 border border-zinc-800 rounded-2xl rounded-bl-sm px-4 py-3 text-sm leading-relaxed text-zinc-100"
                }
              >
                <div className="whitespace-pre-wrap break-words">{m.content}</div>
              </div>
            </div>
          ))}
          {isStreaming && (
            <div className="flex justify-start">
              <div className="max-w-[85%] bg-zinc-900 border border-zinc-800 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-zinc-100">
                <span className="whitespace-pre-wrap break-words">{streaming || "▊"}</span>
                <span className="inline-block w-2 h-4 bg-zinc-500 ml-1 animate-pulse align-middle" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="shrink-0 p-4 border-t border-zinc-800 bg-[#0a0a0a]">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-2 focus-within:border-zinc-700 transition-colors">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Напиши сообщение... (Enter — отправить, Shift+Enter — перенос)"
              rows={1}
              className="flex-1 bg-transparent resize-none outline-none text-sm placeholder:text-zinc-500 px-3 py-2.5 max-h-32"
            />
            <Button
              size="icon"
              className="shrink-0 h-9 w-9 rounded-xl"
              onClick={send}
              disabled={!input.trim() || isStreaming}
            >
              {isStreaming ? <Square size={16} /> : <Send size={16} />}
            </Button>
          </div>
          <div className="text-[11px] text-zinc-600 text-center mt-2">
            NewEra • SQLite ↔ Rust ↔ React • Space: {activeSpace?.name} • Сообщения сохраняются • Ollama Stage 3
          </div>
        </div>
      </div>
    </div>
  );
}
