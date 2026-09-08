import { useEffect, useState } from "react";
import { api } from "@/api/tauri";
import { useAppStore } from "@/stores/useAppStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { X, RefreshCw } from "lucide-react";

const THEMES = ["dark", "light", "system"] as const;

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { spaces, activeSpaceId, setSpaces } = useAppStore();
  const activeSpace = spaces.find((s) => s.id === activeSpaceId);

  const [ollamaUrl, setOllamaUrl] = useState("");
  const [theme, setTheme] = useState("dark");
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [ollamaOnline, setOllamaOnline] = useState<boolean | null>(null);
  const [saved, setSaved] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    api.getSettings().then((s) => {
      setOllamaUrl(s.ollama_url ?? "http://localhost:11434");
      if (s.theme) setTheme(s.theme);
    });
    api.listModels().then(setModels).catch(() => setModels([]));
    if (activeSpace) {
      setModel(activeSpace.model);
      setTemperature(activeSpace.temperature);
      setSystemPrompt(activeSpace.system_prompt);
    }
  }, [activeSpaceId]);

  const refreshOllama = async () => {
    setRefreshing(true);
    try {
      setModels(await api.listModels());
      const h = await api.healthCheck();
      setOllamaOnline(h.ollama);
    } catch {
      setModels([]);
      setOllamaOnline(false);
    } finally {
      setRefreshing(false);
    }
  };

  const save = async () => {
    await api.setSettings("ollama_url", ollamaUrl);
    await api.setSettings("theme", theme);
    if (activeSpace && (model !== activeSpace.model || temperature !== activeSpace.temperature || systemPrompt !== activeSpace.system_prompt)) {
      const updated = await api.updateSpace(activeSpace.id, {
        model,
        temperature,
        system_prompt: systemPrompt,
      });
      setSpaces(spaces.map((s) => (s.id === updated.id ? updated : s)));
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center nr-backdrop-in" onClick={onClose}>
      <div
        className="w-[520px] max-h-[85vh] overflow-y-auto bg-[#0f0f0f] border border-zinc-800 rounded-2xl p-6 space-y-6 nr-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="btn-press text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 active:bg-zinc-800/80 p-1.5 rounded-md transition-colors"
            aria-label="Close settings"
          >
            <X size={18} />
          </button>
        </div>

        {/* Ollama */}
        <section className="space-y-2">
          <Label>Ollama server</Label>
          <div className="flex gap-2">
            <input
              value={ollamaUrl}
              onChange={(e) => setOllamaUrl(e.target.value)}
              placeholder="http://localhost:11434"
              className="flex-1 h-9 px-3 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-100 outline-none focus:border-zinc-500 focus:shadow-[0_0_0_3px_rgba(139,92,246,0.15)] placeholder:text-zinc-600 transition-colors hover:border-zinc-600"
            />
            <Button variant="secondary" size="icon" onClick={refreshOllama} disabled={refreshing} title="Refresh models">
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            </Button>
          </div>
          <div className="flex items-center gap-2 text-xs nr-pop-in">
            <span className={cn("w-2 h-2 rounded-full", ollamaOnline ? "bg-emerald-500" : "bg-red-500")} />
            <span className="text-zinc-500">{ollamaOnline === null ? "not checked" : ollamaOnline ? "Online" : "Offline"}</span>
            <span className="text-zinc-600">· {models.length} models</span>
          </div>
        </section>

        {/* Current Space */}
        <section className="space-y-2">
          <Label>
            Space — {activeSpace?.icon} {activeSpace?.name}
          </Label>

          <div>
            <div className="text-xs text-zinc-500 mb-1">Model</div>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full h-9 px-3 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-100 outline-none focus:border-zinc-500 focus:shadow-[0_0_0_3px_rgba(139,92,246,0.15)] cursor-pointer"
            >
              {models.length === 0 && <option value={model}>{model || "No models found"}</option>}
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex justify-between text-xs text-zinc-500 mb-1">
              <span>Temperature</span>
              <span className="text-zinc-300">{temperature.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-violet-500"
            />
          </div>

          <div>
            <div className="text-xs text-zinc-500 mb-1">System prompt</div>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={3}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2.5 text-sm text-zinc-100 outline-none focus:border-zinc-500 focus:shadow-[0_0_0_3px_rgba(139,92,246,0.15)] placeholder:text-zinc-600 resize-none transition-colors hover:border-zinc-600"
            />
          </div>
        </section>

        {/* Appearance */}
        <section className="space-y-2">
          <Label>Theme</Label>
          <div className="flex gap-2">
            {THEMES.map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={cn(
                  "btn-press flex-1 h-9 rounded-lg border text-sm capitalize transition-colors",
                  theme === t
                    ? "bg-violet-600/90 text-white border-violet-500/50"
                    : "bg-zinc-900 text-zinc-400 border-zinc-700 hover:bg-zinc-800 hover:text-zinc-200 hover:border-zinc-600 active:bg-zinc-900"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </section>

        <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button onClick={save}>{saved ? "Saved ✓" : "Save"}</Button>
        </div>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs font-semibold tracking-widest text-zinc-500 uppercase">{children}</div>;
}
