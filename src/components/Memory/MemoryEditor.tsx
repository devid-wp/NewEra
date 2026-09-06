import { useEffect, useState, useRef } from "react";
import { api, type Memory } from "@/api/tauri";
import { useAppStore } from "@/stores/useAppStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, Trash2, X, Brain, Inbox } from "lucide-react";

const CATEGORIES = ["preference", "project", "fact", "skill"] as const;

export function MemoryEditor({ onClose }: { onClose: () => void }) {
  const { activeSpaceId, spaces } = useAppStore();
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<string>("fact");
  const activeSpaceIdRef = useRef(activeSpaceId);

  // Keep ref in sync
  activeSpaceIdRef.current = activeSpaceId;

  const activeSpace = spaces.find((s) => s.id === activeSpaceId);

  const refresh = async (targetSpaceId?: string | null) => {
    const spaceId = targetSpaceId ?? activeSpaceIdRef.current;
    if (!spaceId) return;
    setLoading(true);
    try {
      const data = await api.listMemories(spaceId);
      // Only apply if this is still the active space
      if (activeSpaceIdRef.current === spaceId) {
        setMemories(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (activeSpaceIdRef.current === spaceId) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    setMemories([]);
    setShowForm(false);
    refresh(activeSpaceId);
  }, [activeSpaceId]);

  const handleAdd = async () => {
    if (!content.trim() || !activeSpaceId) return;
    const mem = await api.addMemory(activeSpaceId, content.trim(), category);
    setMemories((prev) => [mem, ...prev]);
    setContent("");
    setShowForm(false);
  };

  const handleDelete = async (id: string) => {
    await api.deleteMemory(id);
    setMemories((prev) => prev.filter((m) => m.id !== id));
  };

  if (!activeSpaceId) {
    return (
      <div className="w-[340px] shrink-0 h-screen bg-[#0f0f0f] border-l border-zinc-800 flex flex-col">
        <Header name="Memory" onClose={onClose} />
        <div className="flex-1 grid place-items-center text-zinc-600 text-sm p-8 text-center">
          Select a Space to view its memory
        </div>
      </div>
    );
  }

  return (
    <div className="w-[340px] shrink-0 h-screen bg-[#0f0f0f] border-l border-zinc-800 flex flex-col">
      <Header name="Memory" onClose={onClose} />

      <div className="px-4 py-3 border-b border-zinc-800/60">
        <div className="text-xs text-zinc-500 leading-relaxed">
          {activeSpace?.icon} <span className="text-zinc-300">{activeSpace?.name}</span>
          <br />
          These facts are injected into the system prompt for every chat in this Space.
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading && <div className="text-xs text-zinc-600 text-center py-4">Loading…</div>}
        {!loading && memories.length === 0 && (
          <div className="flex flex-col items-center gap-2 text-zinc-600 py-8 text-center">
            <Inbox size={20} className="opacity-50" />
            <div className="text-xs">No memories yet</div>
          </div>
        )}
        {memories.map((m) => (
          <div
            key={m.id}
            className="group flex items-start gap-2 px-3 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm text-zinc-100 whitespace-pre-wrap break-words">{m.content}</div>
              <div className="mt-1.5 flex items-center gap-1.5">
                <span
                  className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded-full",
                    m.category === "preference" && "bg-violet-500/20 text-violet-300",
                    m.category === "project" && "bg-blue-500/20 text-blue-300",
                    m.category === "fact" && "bg-emerald-500/20 text-emerald-300",
                    m.category === "skill" && "bg-amber-500/20 text-amber-300"
                  )}
                >
                  {m.category ?? "fact"}
                </span>
              </div>
            </div>
            <Trash2
              size={13}
              className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 shrink-0 cursor-pointer mt-0.5"
              onClick={() => handleDelete(m.id)}
            />
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-zinc-800">
        {showForm ? (
          <div className="space-y-2">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="e.g. Prefers concise answers with code examples"
              rows={3}
              autoFocus
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-2.5 text-sm outline-none focus:border-zinc-500 placeholder:text-zinc-600 resize-none"
            />
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={cn(
                    "text-[11px] px-2 py-1 rounded-full border transition-colors",
                    category === c
                      ? "bg-zinc-200 text-zinc-900 border-zinc-200"
                      : "bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-zinc-200"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)} className="gap-1">
                <X size={12} /> Cancel
              </Button>
              <Button size="sm" onClick={handleAdd} disabled={!content.trim()} className="gap-1">
                <Plus size={12} /> Save
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" className="w-full gap-1.5" onClick={() => setShowForm(true)}>
            <Brain size={14} /> Add memory
          </Button>
        )}
      </div>
    </div>
  );
}

function Header({ name, onClose }: { name: string; onClose: () => void }) {
  return (
    <div className="h-[56px] shrink-0 flex items-center justify-between px-4 border-b border-zinc-800">
      <span className="text-sm font-semibold text-zinc-100">{name}</span>
      <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200 p-1">
        <X size={16} />
      </button>
    </div>
  );
}
