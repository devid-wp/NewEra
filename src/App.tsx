import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/stores/useAppStore";
import { Sidebar } from "@/components/Sidebar/Sidebar";
import { ChatView } from "@/components/Chat/ChatView";
import { MemoryEditor } from "@/components/Memory/MemoryEditor";
import { SettingsDialog } from "@/components/Settings/SettingsDialog";
import { api } from "@/api/tauri";

function App() {
  const { memoriesOpen, setMemoriesOpen, openSpacePalette } = useAppStore();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const [firstRun, setFirstRun] = useState(true);
  const [setupStep, setSetupStep] = useState<string>("checking_ollama");
  const [setupProgress, setSetupProgress] = useState("");
  const [setupError, setSetupError] = useState(false);
  const [setupErrorDetail, setSetupErrorDetail] = useState("");

  // Check first-run status on mount
  useEffect(() => {
    api.getSettings().then((s) => {
      const isFirstRun = !s.first_run_complete || s.first_run_complete !== "true";
      setFirstRun(isFirstRun);
    }).catch(() => {
      setFirstRun(true);
    });
  }, []);

  // First-run setup flow
  const runSetup = useCallback(async () => {
    setSetupError(false);
    try {
      setSetupStep("checking_ollama");
      setSetupProgress("Checking Ollama availability...");
      const status = await api.checkOllamaStatus();
      if (status !== "ollama_running") {
        setSetupStep("starting_ollama");
        setSetupProgress("Starting Ollama...");
        const result = await api.startOllama();
        if (result.includes("failed")) throw new Error(result);
      }

      setSetupStep("checking_model");
      setSetupProgress("Checking qwen2.5:3b model...");
      const modelExists = await api.checkModelExists("qwen2.5:3b");
      if (!modelExists) {
        setSetupStep("installing_model");
        setSetupProgress("Model not found. Installing qwen2.5:3b (1.8GB)...");
        const result = await api.installModel("qwen2.5:3b");
        if (result.includes("failed") || result.includes("error")) {
          throw new Error("Model download failed or timed out");
        }
      }

      setSetupStep("verifying");
      setSetupProgress("Verifying installation...");
      const modelReady = await api.checkModelExists("qwen2.5:3b");
      if (!modelReady) throw new Error("Model verification failed");

      setSetupStep("complete");
      setSetupProgress("Everything is ready!");
      await api.setSettings("first_run_complete", "true");
      setFirstRun(false);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      console.error("[setup] Error:", detail);
      setSetupErrorDetail(detail);
      setSetupError(true);
      setSetupStep("error");
      setSetupProgress("NewEra couldn't start the local AI.");
    }
  }, []);

  // Run setup on first launch
  useEffect(() => {
    if (firstRun) {
      runSetup();
    }
  }, [firstRun, runSetup]);

  const handleRetry = () => {
    setSetupError(false);
    setSetupErrorDetail("");
    setSetupStep("checking_ollama");
    setSetupProgress("");
    runSetup();
  };

  // Hotkeys
  useEffect(() => {
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

  // Main app UI
  if (!firstRun) {
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

  // First-run setup UI
  const progressPercent =
    setupStep === "checking_ollama" ? 15 :
    setupStep === "starting_ollama" ? 35 :
    setupStep === "checking_model" ? 55 :
    setupStep === "installing_model" ? 80 :
    setupStep === "verifying" ? 95 :
    setupStep === "complete" ? 100 : 0;

  return (
    <div className="h-screen w-screen flex bg-[#0a0a0a] text-zinc-100 overflow-hidden select-none">
      {/* Setup overlay */}
      <div className="absolute inset-0 z-50 flex items-center justify-center p-8 bg-[#0a0a0a]/95">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 max-w-md w-full">
          {/* Header */}
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center">
              <svg className="text-zinc-400 text-xl" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M9 18V5l12-6L9 18z" />
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-zinc-100">NewEra</h2>
            <p className="text-sm text-zinc-400 mt-1">Preparing your workspace...</p>
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Status steps */}
          <div className="space-y-2 mb-6">
            {["checking_ollama", "starting_ollama", "checking_model", "installing_model", "verifying"].map((key) => {
              const labels: Record<string, string> = {
                checking_ollama: "Checking Ollama",
                starting_ollama: "Starting Ollama",
                checking_model: "Checking qwen2.5:3b",
                installing_model: "Installing model",
                verifying: "Verifying",
              };
              const isActive = setupStep === key;
              const stepKeys = ["checking_ollama", "starting_ollama", "checking_model", "installing_model", "verifying"];
              const currentIdx = stepKeys.indexOf(setupStep);
              const stepIdx = stepKeys.indexOf(key);
              const isDone = currentIdx > stepIdx || setupStep === "complete";
              return (
                <div key={key} className="flex items-center gap-2 text-sm">
                  <span className={isDone ? "text-green-400" : isActive ? "text-blue-400" : "text-zinc-600"}>
                    {isDone ? "✓" : isActive ? "●" : "○"}
                  </span>
                  <span className={isActive ? "text-zinc-100" : "text-zinc-500"}>{labels[key]}</span>
                  {isActive && <span className="text-zinc-500 animate-pulse ml-auto">...</span>}
                </div>
              );
            })}
          </div>

          {/* Current status */}
          <p className="text-center text-sm text-zinc-400 mb-4">{setupProgress}</p>

          {/* Error state */}
          {setupError && (
            <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 mb-4 text-sm text-red-300">
              <p className="text-center font-medium">NewEra couldn't start the local AI.</p>
              {setupErrorDetail && (
                <p className="mt-2 text-xs text-red-400/80 break-all font-mono bg-red-950/50 rounded p-2">
                  {setupErrorDetail}
                </p>
              )}
              <p className="text-zinc-500 text-xs mt-2 text-center">Click Retry to try again.</p>
            </div>
          )}

          {/* Retry button */}
          {setupError && (
            <button
              onClick={handleRetry}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Retry
            </button>
          )}

          {/* Complete button */}
          {setupStep === "complete" && !setupError && (
            <button
              onClick={() => setFirstRun(false)}
              className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Enter NewEra
            </button>
          )}

          {/* Cancel during setup */}
          {!setupError && setupStep !== "complete" && (
            <button
              onClick={() => setFirstRun(false)}
              className="w-full mt-2 py-2 text-zinc-400 hover:text-zinc-300 text-sm transition-colors"
            >
              Skip setup
            </button>
          )}
        </div>
      </div>

      {/* Background Sidebar (subtle) */}
      <div className="opacity-30 pointer-events-none">
        <Sidebar
          onToggleMemories={() => {}}
          memoriesOpen={false}
          onOpenSettings={() => {}}
        />
      </div>
    </div>
  );
}

export default App;