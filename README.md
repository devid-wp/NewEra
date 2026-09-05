# NewEra — Local AI Workspace (Tauri 2)

> Красивый desktop-клиент для локальных моделей через Ollama. Главная фишка — **Memory Spaces**.

![Stage](https://img.shields.io/badge/stage-4_memory-green) ![Tauri](https://img.shields.io/badge/Tauri-2-blue) ![React](https://img.shields.io/badge/React-19-61dafb)

## Этап 1 — Скелет ✅
- Tauri 2 + React + TS + Tailwind + Rust Core + IPC mock
- Проверено: `npm run build` ✅ `cargo check` ✅

## Этап 2 — SQLite ✅
- `rusqlite 0.32 bundled` + WAL + FK, миграции `ARCHITECTURE.md:5` → `spaces/chats/messages/memories/settings`
- `src-tauri/src/db/mod.rs:13` — path `app_data_dir()/newera.db`, сиды 4 Spaces
- Rust CRUD: `spaces.rs:7`, `chats.rs:7`, `memory.rs:7`, `chat_stream.rs:13` (user+assistant persist)
- Frontend: auto-select Space, создание/удаление Spaces/Chats, `Sidebar.tsx:18` + индикатор DB
- Проверено: `npm run build` ✅ `cargo check` ✅ данные переживают рестарт

## Этап 3 — Ollama Streaming ✅
- `OllamaProvider` (`providers/ollama.rs`) — реальный `GET /api/tags` + `POST /api/chat` (NDJSON, `stream:true`)
- `send_message` (`chat_stream.rs`) собирает промпт через `prompt.rs` и стримит `chat:chunk` в UI, по завершению пишет ассистента в SQLite
- `abort_generation` — отмена по `chat_id` через `AbortRegistry` (AtomicBool)
- `list_models` / `health_check` — реальные запросы к Ollama
- Frontend: markdown-рендеринг (`MessageBubble.tsx`), стриминг-пузырь, кнопка Stop
- Проверено: `npm run build` ✅ `cargo check` ✅

## Этап 4 — Memory ✅ (текущий)
- В `services/prompt.rs` память инжектится в system prompt (top 10 фактов по Space)
- `MemoryEditor.tsx` — боковая панель: просмотр/добавление/удаление фактов, категории (preference/project/fact/skill)
- Панель открывается из сайдбара (кнопка Memory), память изолирована по Space
- Проверено: `npm run build` ✅

```bash
npm install
cargo tauri dev      # dev с hot-reload
npm run build        # фронт
cargo tauri build    # релиз .deb/.AppImage
ollama serve & ollama pull qwen2.5:3b
```

Архитектура: см. [ARCHITECTURE.md](ARCHITECTURE.md) v0.2 + [ROADMAP.md](ROADMAP.md)

## Следующий этап

**Этап 5 — Polish** — Settings (модель/temperature/ollama_url/theme), авто-титул чата, поиск, экспорт .md, хоткеи

## Scripts

- `npm run dev` — только фронт (Vite 1420)
- `npm run tauri dev` — фронт + Tauri window
- `npm run build` — прод сборка фронта
