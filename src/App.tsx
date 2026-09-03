import { Sidebar } from "@/components/Sidebar/Sidebar";
import { ChatView } from "@/components/Chat/ChatView";

function App() {
  return (
    <div className="h-screen w-screen flex bg-[#0a0a0a] text-zinc-100 overflow-hidden select-none">
      <Sidebar />
      <ChatView />
    </div>
  );
}

export default App;
