import { useState } from "react";
import { Sidebar } from "@/components/Sidebar/Sidebar";
import { ChatView } from "@/components/Chat/ChatView";
import { MemoryEditor } from "@/components/Memory/MemoryEditor";

function App() {
  const [memoriesOpen, setMemoriesOpen] = useState(false);

  return (
    <div className="h-screen w-screen flex bg-[#0a0a0a] text-zinc-100 overflow-hidden select-none">
      <Sidebar onToggleMemories={() => setMemoriesOpen((v) => !v)} memoriesOpen={memoriesOpen} />
      <ChatView />
      {memoriesOpen && <MemoryEditor onClose={() => setMemoriesOpen(false)} />}
    </div>
  );
}

export default App;
