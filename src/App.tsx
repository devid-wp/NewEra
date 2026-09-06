import { useEffect, useState } from "react";
import { useAppStore } from "@/stores/useAppStore";
import { Sidebar } from "@/components/Sidebar/Sidebar";
import { ChatView } from "@/components/Chat/ChatView";
import { MemoryEditor } from "@/components/Memory/MemoryEditor";
import { SettingsDialog } from "@/components/Settings/SettingsDialog";
import { api } from "@/api/tauri";

function App() {
  const { memoriesOpen, setMemoriesOpen, openSpacePalette } = useAppStore();
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    api.getSettings().then((s) => {
      document.documentElement.classList.toggle("dark", s.theme !== "light");
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (settingsOpen) setSettingsOpen(false);
        else if (memoriesOpen) setMemoriesOpen(false);
      }
      if (e.ctrlKey && e.key === "n") {
        e.preventDefault();
        setMemoriesOpen(!memoriesOpen);
      }
      if (e.key === "K" && e.ctrlKey) {
        e.preventDefault();
        openSpacePalette();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [settingsOpen, memoriesOpen]);

  return (
    <div className="h-screen w-screen flex bg-[#0a0a0a] text-zinc-100 overflow-hidden select-none">
      <Sidebar
        onToggleMemories={() => setMemoriesOpen(!memoriesOpen)}
        memoriesOpen={memoriesOpen}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <ChatView />
      {memoriesOpen && <MemoryEditor onClose={() => setMemoriesOpen(false)} />}
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

export default App;