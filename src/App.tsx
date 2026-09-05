import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar/Sidebar";
import { ChatView } from "@/components/Chat/ChatView";
import { MemoryEditor } from "@/components/Memory/MemoryEditor";
import { SettingsDialog } from "@/components/Settings/SettingsDialog";
import { api } from "@/api/tauri";

function App() {
  const [memoriesOpen, setMemoriesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    api.getSettings().then((s) => {
      document.documentElement.classList.toggle("dark", s.theme !== "light");
    });
  }, []);

  return (
    <div className="h-screen w-screen flex bg-[#0a0a0a] text-zinc-100 overflow-hidden select-none">
      <Sidebar
        onToggleMemories={() => setMemoriesOpen((v) => !v)}
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
