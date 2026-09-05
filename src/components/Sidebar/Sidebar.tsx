import { useEffect, useState } from "react";
import { api, type Space, type Chat } from "@/api/tauri";
import { useAppStore } from "@/stores/useAppStore";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NoveraLogo } from "@/components/Brand/NoveraLogo";
import { Plus, MessageSquare, Settings, Trash2, Search, X, Check, Brain } from "lucide-react";

export function Sidebar({
  onToggleMemories,
  memoriesOpen,
  onOpenSettings,
}: {
  onToggleMemories: () => void;
  memoriesOpen: boolean;
  onOpenSettings: () => void;
}) {
  const { spaces, activeSpaceId, chats, activeChatId, setSpaces, setActiveSpace, setChats, setActiveChat } =
    useAppStore();
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null);
  const [dbOnline, setDbOnline] = useState<boolean | null>(null);
  const [showNewSpace, setShowNewSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [newSpaceIcon, setNewSpaceIcon] = useState("🧠");

  const refreshSpaces = async () => {
    const list = await api.listSpaces();
    setSpaces(list);
    if (list.length > 0) {
      const exists = list.some((s) => s.id === activeSpaceId);
      if (!activeSpaceId || !exists) {
        setActiveSpace(list[0].id);
      }
    }
  };

  useEffect(() => {
    refreshSpaces().catch(console.error);
    api.healthCheck()
      .then((h) => {
        setOllamaOnline(h.ollama);
        setDbOnline(h.db);
      })
      .catch(() => {
        setOllamaOnline(false);
        setDbOnline(false);
      });
  }, []);

  useEffect(() => {
    if (activeSpaceId) {
      api.listChats(activeSpaceId).then(setChats).catch(console.error);
    }
  }, [activeSpaceId]);

  const handleCreateSpace = async () => {
    if (!newSpaceName.trim()) return;
    const space = await api.createSpace({
      name: newSpaceName.trim(),
      icon: newSpaceIcon,
    });
    const updated = [...spaces, space];
    setSpaces(updated);
    setActiveSpace(space.id);
    setNewSpaceName("");
    setShowNewSpace(false);
  };

  const handleDeleteSpace = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete Space? All chats and memory inside will be permanently removed.")) return;
    await api.deleteSpace(id);
    const remaining = spaces.filter((s) => s.id !== id);
    setSpaces(remaining);
    if (activeSpaceId === id) {
      setActiveSpace(remaining[0]?.id ?? null);
      setChats([]);
    }
  };

  return (
    <aside className="w-[300px] shrink-0 bg-[#0f0f0f] border-r border-zinc-800 flex flex-col h-screen">
      {/* Header — Novera branding from provided logo */}
      <div className="h-[64px] flex items-center justify-between px-4 border-b border-zinc-800/60">
        <NoveraLogo />
        <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500">
          <Search size={14} />
        </Button>
      </div>

      {/* Spaces */}
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold tracking-widest text-zinc-500">SPACES</span>
          <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => setShowNewSpace((v) => !v)}>
            <Plus size={12} /> New
          </Button>
        </div>

        {showNewSpace && (
          <div className="mb-3 p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2">
            <div className="flex gap-2">
              <input
                value={newSpaceIcon}
                onChange={(e) => setNewSpaceIcon(e.target.value)}
                className="w-10 h-9 text-center bg-zinc-800 border border-zinc-700 rounded-lg text-sm outline-none focus:border-zinc-600"
                maxLength={2}
              />
              <input
                value={newSpaceName}
                onChange={(e) => setNewSpaceName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateSpace()}
                placeholder="Name, e.g. Research"
                autoFocus
                className="flex-1 h-9 px-3 bg-zinc-800 border border-zinc-700 rounded-lg text-sm outline-none focus:border-zinc-600 placeholder:text-zinc-500"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowNewSpace(false)} className="gap-1">
                <X size={12} /> Cancel
              </Button>
              <Button size="sm" onClick={handleCreateSpace} disabled={!newSpaceName.trim()} className="gap-1">
                <Check size={12} /> Create
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-1">
          {spaces.map((s: Space) => (
            <div
              key={s.id}
              onClick={() => setActiveSpace(s.id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors text-left cursor-pointer group",
                activeSpaceId === s.id
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
              )}
            >
              <span className="text-base leading-none">{s.icon}</span>
              <span className="flex-1 truncate font-medium">{s.name}</span>
              <span className="text-[10px] text-zinc-500 truncate hidden xl:block">{s.model}</span>
              <Trash2
                size={12}
                className="opacity-0 group-hover:opacity-100 hover:text-red-400 shrink-0"
                onClick={(e) => handleDeleteSpace(s.id, e)}
              />
            </div>
          ))}
          {spaces.length === 0 && <div className="text-xs text-zinc-600 py-2">No spaces yet</div>}
        </div>
      </div>

      {/* Chats */}
      <div className="flex-1 flex flex-col min-h-0 px-3 pt-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold tracking-widest text-zinc-500">CHATS</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs gap-1"
            onClick={async () => {
              if (!activeSpaceId) return;
              const c = await api.createChat(activeSpaceId, "New chat");
              setChats([c, ...chats]);
              setActiveChat(c.id);
            }}
          >
            <Plus size={12} /> New chat
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 pr-1 -mr-1">
          {chats.length === 0 ? (
            <div className="text-xs text-zinc-600 py-6 text-center">
              {activeSpaceId ? "No chats yet — create your first one" : "Select a Space"}
            </div>
          ) : (
            chats.map((c: Chat) => (
              <button
                key={c.id}
                onClick={() => setActiveChat(c.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-2.5 py-2.5 rounded-lg text-sm text-left group",
                  activeChatId === c.id ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                )}
              >
                <MessageSquare size={14} className="shrink-0 opacity-60" />
                <span className="flex-1 truncate">{c.title}</span>
                <Trash2
                  size={12}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-400 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!confirm("Delete this chat?")) return;
                    api.deleteChat(c.id).then(() => {
                      setChats(chats.filter((x) => x.id !== c.id));
                      if (activeChatId === c.id) setActiveChat(null);
                    });
                  }}
                />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-zinc-800 space-y-2">
        <div className="flex flex-col gap-1.5 text-xs">
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
            <span className={cn("w-2 h-2 rounded-full", ollamaOnline ? "bg-emerald-500" : "bg-red-500")} />
            <span className="text-zinc-400">Ollama</span>
            <span className={cn("ml-auto text-[11px]", ollamaOnline ? "text-emerald-400" : "text-red-400")}>
              {ollamaOnline === null ? "checking..." : ollamaOnline ? "online" : "offline"}
            </span>
          </div>
          <div className="flex items-center gap-2 px-2 py-1 rounded-lg bg-zinc-900/50 border border-zinc-800/50">
            <span className={cn("w-2 h-2 rounded-full", dbOnline ? "bg-emerald-500" : "bg-amber-500")} />
            <span className="text-zinc-500 text-[11px]">SQLite</span>
            <span className="ml-auto text-[11px] text-zinc-500">{dbOnline ? "ready" : "..."}</span>
          </div>
        </div>
        <Button
          variant={memoriesOpen ? "default" : "secondary"}
          className="w-full justify-start gap-2 text-zinc-300"
          onClick={onToggleMemories}
        >
          <Brain size={14} /> Memory
        </Button>
        <Button variant="secondary" className="w-full justify-start gap-2 text-zinc-300" onClick={onOpenSettings}>
          <Settings size={14} /> Settings
        </Button>
      </div>
    </aside>
  );
}
