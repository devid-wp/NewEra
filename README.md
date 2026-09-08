# NewEra — Local AI Workspace (Tauri 2)

> Beautiful desktop client for local AI models via Ollama. The key feature — **Memory Spaces**.

![Stage](https://img.shields.io/badge/stage-5_polish-green) ![Tauri](https://img.shields.io/badge/Tauri-2-blue) ![React](https://img.shields.io/badge/React-19-61dafb)

## Stage 1 — Skeleton ✅
- Tauri 2 + React + TS + Tailwind + Rust Core + IPC mock
- Verified: `npm run build` ✅ `cargo check` ✅

## Stage 2 — SQLite ✅
- `rusqlite 0.32 bundled` + WAL + FK, migrations `ARCHITECTURE.md:5` → `spaces/chats/messages/memories/settings`
- `src-tauri/src/db/mod.rs:13` — path `app_data_dir()/newera.db`, 4 default Spaces
- Rust CRUD: `spaces.rs:7`, `chats.rs:7`, `memory.rs:7`, `chat_stream.rs:13` (user+assistant persist)
- Frontend: auto-select Space, create/delete Spaces/Chats, `Sidebar.tsx:18` + DB indicator
- Verified: `npm run build` ✅ `cargo check` ✅ data survives restart

## Stage 3 — Ollama Streaming ✅
- `OllamaProvider` (`providers/ollama.rs`) — real `GET /api/tags` + `POST /api/chat` (NDJSON, `stream:true`)
- `send_message` (`chat_stream.rs`) gathers prompt via `prompt.rs` and streams `chat:chunk` to UI, writes assistant to SQLite on completion
- `abort_generation` — cancellation by `chat_id` via `AbortRegistry` (AtomicBool)
- `list_models` / `health_check` — real Ollama requests
- Frontend: markdown rendering (`MessageBubble.tsx`), streaming bubble, Stop button
- Verified: `npm run build` ✅ `cargo check` ✅

## Stage 4 — Memory ✅ (current)
- In `services/prompt.rs` memory is injected into system prompt (top 10 facts per Space)
- `MemoryEditor.tsx` — sidebar panel: view/add/delete facts, categories (preference/project/fact/skill)
- Panel opens from sidebar (Memory button), memory isolated per Space
- Verified: `npm run build` ✅

## Stage 5 — Polish ✅
- Settings: model, temperature, ollama_url, theme
- Auto-chat title from first message
- Chat search, export to .md, error handling, offline banner
- Memory CRUD works correctly
- Verified: can be used daily

```bash
npm install
cargo tauri dev      # dev with hot-reload
npm run build        # frontend build
cargo tauri build    # release .deb/.AppImage/.exe
ollama serve & ollama pull qwen3:8b
```

Architecture: see [ARCHITECTURE.md](ARCHITECTURE.md) v0.2 + [ROADMAP.md](ROADMAP.md)

## Next Stage

**Stage 6 — Build** — Tauri bundler, icons, packaging, README

## Deployment

### Build artifacts location

Production build outputs are generated in `src-tauri/target/release/`:

- **Binary**: `src-tauri/target/release/newera`
- **.deb package**: `src-tauri/target/release/bundle/deb/Novera_0.1.0_amd64.deb`
- **.rpm package**: `src-tauri/target/release/bundle/rpm/Novera-0.1.0-1.x86_64.rpm`
- **.AppImage**: `src-tauri/target/release/bundle/appimage/Novera_0.1.0_amd64.AppImage` (requires `cargo tauri build` with `linuxdeploy` dependencies, or use the `AppDir`-based bundle)

### Installing/running the .deb package

```bash
sudo dpkg -i src-tauri/target/release/bundle/deb/Novera_0.1.0_amd64.deb
# If missing dependencies:
sudo apt-get install -f
# Then launch:
newera
```

### Running the AppImage

```bash
chmod +x src-tauri/target/release/bundle/appimage/Novera_0.1.0_amd64.AppImage
./src-tauri/target/release/bundle/appimage/Novera_0.1.0_amd64.AppImage
```

### Running the Windows .exe

The Windows executable is generated via `cargo tauri build` on a Windows system.
Place the resulting `.exe` in the `src-tauri/target/release/bundle/window` directory
and run it double-clicking or from the command line.

> **Note**: Windows packaging and verification requires a Windows host.
Current CI/linux environment cannot produce or test `.exe` runtime behavior.

### Building from source

```bash
# 1. Install dependencies (Linux/Debian example):
# sudo pacman -S webkit2gtk base-devel curl wget file openssl appmenu-gtk-module libappindicator-gtk3 librsvg
# sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev

# 2. Install Node.js dependencies:
npm install

# 3. Start Ollama and pull a model:
ollama serve
ollama pull qwen3:8b

# 4. Start development mode:
cargo tauri dev

# 5. Produce release artifacts:
cargo tauri build
```

## Scripts

- `npm run dev` — only frontend (Vite 1420)
- `npm run tauri dev` — frontend + Tauri window
- `npm run build` — production frontend build

## Development

1. Start Ollama: `ollama serve`
2. Pull a model: `ollama pull qwen3:8b`
3. Verify it's running: `curl http://localhost:11434/api/tags`
4. Start development: `cargo tauri dev`
5. Build: `cargo tauri build`