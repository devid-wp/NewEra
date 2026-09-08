import { useEffect, useRef, useState, useCallback } from "react";
import { api, onChatChunk, type Message } from "@/api/tauri";
import { useAppStore } from "@/stores/useAppStore";
import { Button } from "@/components/ui/button";
import { MessageBubble } from "@/components/Chat/MessageBubble";
import { Send, Square, Cpu, Sparkles, Download, BrainCircuit } from "lucide-react";

function StreamingBubble({ text }: { text: string }) {
  const hasText = text.trim().length > 0;
  return (
    <div className="flex justify-start nr-fade-up">
      <div className="max-w-[85%] bg-zinc-900 border border-zinc-800 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-zinc-100 nr-glow">
        {hasText ? (
          <p className="my-1.5 leading-relaxed whitespace-pre-wrap break-words text-zinc-100">
            {text}
            <span className="nr-caret" />
          </p>
        ) : (
          <div className="flex items-center gap-3 py-1">
            <BrainCircuit size={15} className="text-blue-400 animate-pulse shrink-0" />
            <div className="nr-dots text-zinc-400">
              <span /><span /><span />
            </div>
            <span className="text-xs text-zinc-500">thinking</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatView() {
  const { activeSpaceId, activeChatId, spaces } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportText, setExportText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const streamingTextRef = useRef("");
  const messagesSentRef = useRef(0);

  const activeSpace = spaces.find((s) => s.id === activeSpaceId);

  const loadMessages = useCallback((chatId: string) => {
    api.listMessages(chatId).then(setMessages).catch(console.error);
  }, []);

  // Load messages when chat changes
  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      return;
    }
    messagesSentRef.current = 0;
    loadMessages(activeChatId);
  }, [activeChatId, loadMessages]);

  // Auto-scroll on new messages or streaming
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  // Listen for streaming chunks
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    onChatChunk((c) => {
      if (c.chatId !== activeChatId) return;
      if (c.done) {
        // Backend saved the message — reload from DB to get the real one
        streamingTextRef.current = "";
        setStreaming("");
        setIsStreaming(false);
        loadMessages(c.chatId);
      } else {
        streamingTextRef.current += c.delta;
        setStreaming(streamingTextRef.current);
      }
    }).then((fn) => (unlisten = fn));
    return () => unlisten?.();
  }, [activeChatId, loadMessages]);

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
    streamingTextRef.current = "";
    await api.sendMessage(activeSpaceId, activeChatId, text);
    if (messagesSentRef.current === 0) {
      await api.setChatTitle(activeChatId, text);
    }
    messagesSentRef.current++;
  };

  const handleAbort = async () => {
    if (!activeChatId) return;
    // Tell backend to stop — it saves partial text to DB
    api.abortGeneration(activeChatId);
    // Keep streaming text visible while backend saves
    // Reload from DB after a short delay to let the save complete
    setTimeout(() => loadMessages(activeChatId), 500);
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
            <p className="text-xs text-zinc-500">Chats are stored locally in SQLite and isolated per Space.</p>
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
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          {messages.length} messages · SQLite
          <Button
            variant="ghost"
            size="icon"
            onClick={async () => {
              if (!activeChatId) return;
              try {
                const text = await api.exportChat(activeChatId);
                setExportText(text);
                setShowExport(true);
              } catch (e) {
                console.error("Export failed:", e);
              }
            }}
            title="Export chat"
          >
            <Download size={12} />
          </Button>
        </div>
      </header>

      {showExport && (
        <div className="fixed inset-0 z-10 bg-black/80 flex items-center justify-center p-4 nr-backdrop-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 max-w-lg w-full nr-modal-in">
            <h3 className="text-lg font-semibold mb-4">Export Chat</h3>
            <textarea
              rows={10}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg p-3 text-sm font-mono outline-none resize-none focus:border-zinc-500 focus:shadow-[0_0_0_3px_rgba(139,92,246,0.12)] select-text"
              value={exportText}
              onFocus={(e) => e.target.select()}
              readOnly
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowExport(false)}>Close</Button>
              <Button onClick={() => { navigator.clipboard.writeText(exportText); setShowExport(false); }}>Copy</Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto w-full px-6 py-8 space-y-6">
          {messages.map((m) => (
            <MessageBubble key={m.id} role={m.role} content={m.content} />
          ))}
          {isStreaming && (
            <StreamingBubble text={streaming} />
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="shrink-0 p-4 border-t border-zinc-800 bg-[#0a0a0a]">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-end gap-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-2 focus-within:border-zinc-600 focus-within:shadow-[0_0_0_3px_rgba(139,92,246,0.12)] transition-all duration-150">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
              rows={1}
              className="flex-1 bg-transparent resize-none outline-none text-sm placeholder:text-zinc-500 px-3 py-2.5 max-h-32"
            />
            <Button
              size="icon"
              className="shrink-0 h-9 w-9 rounded-xl"
              onClick={() => {
                if (isStreaming) {
                  handleAbort();
                } else {
                  send();
                }
              }}
              disabled={!input.trim() && !isStreaming}
            >
              {isStreaming ? <Square size={16} /> : <Send size={16} />}
            </Button>
          </div>
          <div className="text-[11px] text-zinc-500 text-center mt-2">
            Novera runs locally · Space: {activeSpace?.name} · Streamed via Ollama
          </div>
        </div>
      </div>
    </div>
  );
}
