# NewEra (ex. Novera) — Архитектура и Карта Проекта v0.2 (Tauri Desktop)

> Нативное desktop-приложение. Локальный AI workspace на Tauri 2. Никакого Python/FastAPI/web-сервера. Главная фишка — Memory Spaces.

---

## 1. Концепция

```
Qwen2.5 3B (и любые локальные модели)
   ↓
Ollama API (localhost:11434) ──→ [будущее: llama.cpp / другие провайдеры]
   ↓
NewEra (Tauri 2 + Rust Core + SQLite)
   ↓
React UI (ChatGPT/Codex вайб, темная тема)
```

**Memory Space** = изолированный AI-контекст:
- свои чаты
- своя долгосрочная память (факты)
- свой system prompt
- свои настройки модели (model, temperature, num_ctx)
- логически изолированные данные в SQLite

Переключение Space = полная смена личности AI. Ноль протечек.

Приоритеты: **Скорость -> Красивый UI -> Локальность -> Приватность -> Расширяемость**
Что НЕ делаем в MVP: RAG, векторы, авто-память LLM-ом, облако.

---

## 2. Стек (финальный, без альтернатив)

```
Frontend/Desktop:  Tauri 2 + React 18 + TypeScript 5 + Vite + Tailwind CSS + shadcn/ui
Backend/Core:      Rust (внутри Tauri)
Database:          SQLite (rusqlite + tauri-plugin-sql ИЛИ sqlx) — один файл newera.db
AI:                Ollama API (HTTP) через Rust, абстракция Provider
Packaging:         Tauri bundler -> .deb/.AppImage/.exe/.dmg (нативно)
```

**Почему Tauri 2:**
- Нативный бинарь <15MB (vs Electron 150MB+), мало RAM
- Rust core = скорость + контроль SQLite + стриминга
- IPC вместо HTTP: безопаснее и быстрее чем localhost сервер
- Легко добавить sidecar / system tray / global shortcuts позже

**Запрещено:** Python, FastAPI, отдельный backend-сервер, Electron, облачные API.

---

## 3. Архитектура

```
┌──────────────────────────────────────────────────┐
│                 NewEra (Desktop)                 │
│                                                  │
│  ┌─────────────────────────────────┐             │
│  │ React UI (src/)                 │             │
│  │ Sidebar (Spaces) | ChatList     │             │
│  │ ChatView (stream) | MemoryEditor│             │
│  │ Settings (Model picker)         │             │
│  └──────────────┬──────────────────┘             │
│                 │ invoke / listen (Tauri IPC + Events) │
│  ┌──────────────▼──────────────────┐             │
│  │ Tauri Core (src-tauri/src/)     │             │
│  │  commands/  — IPC handlers      │             │
│  │  services/  — бизнес-логика     │             │
│  │  db/        — SQLite            │             │
│  │  providers/ — Ollama/llama.cpp  │             │
│  └──────┬──────────────┬───────────┘             │
│         │              │                         │
│  ┌──────▼──────┐ ┌─────▼──────────┐              │
│  │ SQLite      │ │ AI Providers   │              │
│  │ newera.db   │ │ ┌────────────┐ │              │
│  │ spaces      │ │ │ Ollama     │ │──→ localhost:11434
│  │ chats       │ │ │ llama.cpp* │ │──→ (будущее)
│  │ messages    │ │ └────────────┘ │              │
│  │ memories    │ │  trait AiProvider             │
│  │ settings    │ │                               │
│  └─────────────┘ └────────────────┘              │
└──────────────────────────────────────────────────┘
* llama.cpp — заглушка интерфейса в MVP, реализация после v0.1
```

### Поток сообщения (стриминг):
1. UI: `invoke('send_message', { spaceId, chatId, content })`
2. Rust: `prompt_service::build(space_id, chat_id)` собирает `system_prompt + memories (top 10) + history (last 20) + user_msg`
3. Rust: `provider.chat_stream(model, messages)` — `reqwest` с `stream=true` к Ollama `/api/chat`
4. Rust: на каждый chunk `app.emit("chat:chunk", { chatId, delta })` + пишет в SQLite по завершению
5. UI: `listen("chat:chunk", cb)` побуквенно рендерит как в ChatGPT, markdown + code copy.

---

## 4. Структура проекта (что создаст агент)

```
NewEra/
├── README.md
├── ARCHITECTURE.md
├── ROADMAP.md
├── .gitignore
├── package.json                 # npm workspaces (root + frontend)
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── index.html
│
├── src/                         # React Frontend
│   ├── main.tsx
│   ├── App.tsx                  # Layout: Sidebar + Main
│   ├── vite-env.d.ts
│   ├── api/
│   │   └── tauri.ts             # обертки над invoke/listen (typed)
│   ├── stores/
│   │   ├── useSpaceStore.ts     # zustand
│   │   ├── useChatStore.ts
│   │   └── useSettingsStore.ts
│   ├── components/
│   │   ├── Sidebar/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── SpaceList.tsx
│   │   │   └── ChatList.tsx
│   │   ├── Chat/
│   │   │   ├── ChatView.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── Composer.tsx
│   │   │   └── StreamingText.tsx
│   │   ├── Memory/
│   │   │   └── MemoryEditor.tsx
│   │   ├── Settings/
│   │   │   └── SettingsDialog.tsx
│   │   └── ui/                  # shadcn (button, dialog, etc)
│   ├── hooks/
│   └── styles/globals.css
│
├── src-tauri/                   # Rust Core
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── build.rs
│   ├── icons/
│   └── src/
│       ├── main.rs              # run tauri app
│       ├── lib.rs               # setup, plugins, invoke_handler
│       ├── db/
│       │   ├── mod.rs           # pool, init, migrations
│       │   └── migrations/      # sql файлы
│       ├── models/
│       │   ├── space.rs
│       │   ├── chat.rs
│       │   ├── message.rs
│       │   └── memory.rs        # serde Serialize/Deserialize
│       ├── commands/
│       │   ├── mod.rs
│       │   ├── spaces.rs        # create_space, list_spaces, delete_space, update_space
│       │   ├── chats.rs         # create_chat, list_chats, delete_chat, rename_chat
│       │   ├── messages.rs      # list_messages
│       │   ├── chat.rs          # send_message (stream), abort_generation
│       │   ├── memory.rs        # list/add/update/delete memories
│       │   └── settings.rs      # get_models, health_check
│       ├── services/
│       │   ├── mod.rs
│       │   ├── prompt.rs        # build_prompt(space, memories, history)
│       │   └── memory.rs
│       └── providers/
│           ├── mod.rs           # trait AiProvider + factory
│           ├── ollama.rs        # OllamaProvider: list_models, chat_stream
│           └── llamacpp.rs      # stub для будущего
│
└── scripts/
    └── seed.sql                 # дефолтные Spaces
```

### Ключевые зависимости

**`src-tauri/Cargo.toml`:**
```toml
tauri = { version = "2", features = [] }
tauri-plugin-sql = "2"
rusqlite = { version = "0.32", features = ["bundled"] } # или через plugin
serde, serde_json, tokio, reqwest = { features = ["json","stream"] }, futures-util, uuid
```

**`package.json`:**
```json
{
  "dependencies": { "react": "^18", "@tauri-apps/api": "^2", "zustand": "^4", "react-markdown": "^9" },
  "devDependencies": { "vite": "^5", "typescript": "^5", "tailwindcss": "^3" }
}
```

---

## 5. Схема БД (SQLite, один файл)

Файл: `~/.local/share/newera/newera.db` (через `tauri::path::app_data_dir`) или `src-tauri/data/newera.db` в dev.

```sql
CREATE TABLE spaces (
  id TEXT PRIMARY KEY, -- uuid v4
  name TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL, -- emoji или lucide name: "code2", "graduation-cap"
  system_prompt TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'qwen3:8b',
  temperature REAL DEFAULT 0.7,
  provider TEXT NOT NULL DEFAULT 'ollama', -- для будущей расширяемости
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE chats (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_chats_space ON chats(space_id, updated_at DESC);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_messages_chat ON messages(chat_id, created_at);

CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  category TEXT CHECK(category IN ('preference','project','fact','skill')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_memories_space ON memories(space_id);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- keys: ollama_url (http://localhost:11434), theme, default_space
```

**Сиды:**
- 🧠 Default — `You are a helpful assistant.`
- 💻 Programming — `You are a senior dev assistant. User: Python, Linux, Novera project. Be concise, show code.`
- 🇬🇧 English — `You are an English tutor. Track level, correct gently, teach words.`
- 🐧 Linux — `You are Linux/Arch expert. Help with terminal, configs.`

Миграции: `tauri-plugin-sql` или `rusqlite` + `refinery`.

---

## 6. Tauri IPC — Контракт (MVP)

Все команды — `#[tauri::command]` в `lib.rs:invoke_handler`.

```rust
// Spaces
list_spaces() -> Vec<Space>
create_space(name, icon, system_prompt, model) -> Space
update_space(id, patch) -> Space
delete_space(id) -> ()

// Chats & Messages
list_chats(space_id) -> Vec<Chat>
create_chat(space_id, title?) -> Chat
delete_chat(chat_id) -> ()
rename_chat(chat_id, title) -> Chat
list_messages(chat_id) -> Vec<Message>

// Chat (stream)
send_message(space_id, chat_id, content) -> () // стримит через events, не return
abort_generation(chat_id) -> ()

// Memory
list_memories(space_id) -> Vec<Memory>
add_memory(space_id, content, category) -> Memory
update_memory(id, content) -> Memory
delete_memory(id) -> ()

// System / Models
list_models() -> Vec<String>          // GET /api/tags через Rust
health_check() -> { ollama: bool, db: bool }
get_settings() -> Settings
set_settings(key, value) -> ()
```

**Events (Rust -> Frontend):**
- `chat:chunk` — `{ chatId, delta: string, done: bool }`
- `chat:error` — `{ chatId, error }`
- `ollama:status` — `{ online: bool }`

---

## 7. Провайдер абстракция (важно для будущего)

```rust
// providers/mod.rs
#[async_trait]
pub trait AiProvider: Send + Sync {
    fn name(&self) -> &str;
    async fn list_models(&self) -> Result<Vec<String>, String>;
    async fn health(&self) -> bool;
    async fn chat_stream(
        &self,
        model: &str,
        messages: Vec<ChatMessage>,
        options: ChatOptions,
        on_chunk: impl Fn(String) + Send + 'static,
    ) -> Result<(), String>;
}

// providers/ollama.rs
pub struct OllamaProvider { base_url: String, client: reqwest::Client }
// реализует AiProvider через POST /api/chat stream:true

// providers/llamacpp.rs (MVP — stub, возвращает NotImplemented)
pub struct LlamaCppProvider { ... }
```

Фабрика:
```rust
fn get_provider(name: &str) -> Box<dyn AiProvider> { match name { "ollama" => Box::new(OllamaProvider), _ => ... } }
```

В `spaces.provider` храним имя провайдера, по умолчанию `ollama`.

---

## 8. UI Layout (темная тема, минимализм)

```
┌─ Sidebar 280px ────────────────┬─ Main ──────────────────────────┐
│ NewEra  [⌘K]                   │  💻 Programming · qwen3:8b   │
│ ─────────────────              │  ─────────────────────────────  │
│ Spaces                         │                                 │
│ ● 🧠 Default                   │   User: Как сделать миграцию?  │
│ ● 💻 Programming ← active      │   AI: Вот пример... ▊ (stream) │
│ ● 🇬🇧 English                   │                                 │
│ ● 🐧 Linux                     │                                 │
│ [+ New Space]                  │                                 │
│ ─────────────────              │                                 │
│ Chats                          │                                 │
│ > Refactor DB layer            │                                 │
│   Fix streaming  (2d ago)      │                                 │
│ [+ New Chat]                   │                                 │
│ ─────────────────              │                                 │
│ ⚙ Settings  ● Ollama online    │  [Textarea autosize + Send ↵]  │
└────────────────────────────────┴─────────────────────────────────┘
```
- Tailwind + shadcn/ui + lucide-react
- `react-markdown` + `shiki` для кода, кнопка Copy
- Виртуализация списка сообщений при >100
- Хоткеи: `⌘N` новый чат, `⌘K` палитра Spaces, `Esc` стоп генерации

---

## 9. Карта проекта — 6 Этапов (строго по очереди)

### Этап 1 — Скелет и Архитектура [1 день] ← СЕЙЧАС
- [x] ARCHITECTURE.md v0.2, ROADMAP.md
- [ ] `npm create tauri-app` (React + TS) + Tailwind + shadcn
- [ ] `src-tauri/lib.rs` с пустыми командами, `health_check` мок
- [ ] Пустой красивый Layout (Sidebar + ChatView без логики)
- **Done:** `cargo tauri dev` открывает окно NewEra с темным макетом.

### Этап 2 — SQLite + Spaces + Chats (без AI) [2-3 дня]
- [ ] `db/mod.rs` + миграции + CRUD команды
- [ ] Zustand stores + UI: создать/удалить/переключить Space, создать чат, список сообщений (мок)
- **Done:** Spaces/чаты сохраняются после перезапуска, изоляция работает.

### Этап 3 — Ollama + Streaming [2-3 дня]
- [ ] `providers/ollama.rs` + `services/prompt.rs` + команда `send_message` с `emit(chat:chunk)`
- [ ] Frontend `listen` + streaming bubbles + markdown + stop
- [ ] `list_models`, `health_check` реальные
- **Done:** живой чат с qwen2.5:3b, стриминг как в ChatGPT, история в SQLite.

### Этап 4 — Memory [2 дня]
- [ ] `memories` CRUD + `prompt.rs` подмешивает top memories в system
- [ ] `MemoryEditor.tsx` (таблица фактов в Space)
- **Done:** в Programming добавил "prefer concise" -> AI короче; в English — нет.

### Этап 5 — Полировка MVP [2 дня]
- [ ] Settings: модель на Space, temperature, ollama_url, theme
- [ ] Авто-титул чата (первое сообщение -> короткий title через LLM или обрезка)
- [ ] Поиск, удаление, экспорт чата в .md, обработка ошибок, оффлайн баннер
- **Done:** можно пользоваться ежедневно.

### Этап 6 — Сборка [1-2 дня]
- [ ] `tauri.conf.json` иконки, bundler, `cargo tauri build`
- [ ] README: `ollama pull qwen3:8b && cargo tauri dev`
- [ ] Тег `v0.1.0-mvp` — .deb/.AppImage/.exe

> Каждый этап = отдельный коммит/PR. Не смешивать.

---

## 10. Что НЕ в MVP (но заложено)
- RAG / embeddings / векторная БД
- Авто-извлечение памяти LLM-ом (сейчас только ручной CRUD)
- Tools / Function calling
- Синхронизация / облако
- llama.cpp провайдер (только trait + stub)

---

## 11. Команды старта (после git init)

```bash
cd /path/to/NewEra
git init && git branch -M main

# Tauri 2 prerequisites (Arch/Debian)
# sudo pacman -S webkit2gtk base-devel curl wget file openssl appmenu-gtk-module libappindicator-gtk3 librsvg
# sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev

# Создать проект (внутри уже существующей папки — аккуратно)
npm create tauri-app@latest . -- --template react-ts  # если ругается — создать во временной и перенести
# или: cargo create-tauri-app --template react-ts

npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install zustand @tauri-apps/api react-markdown lucide-react

# Rust plugins
cd src-tauri && cargo add tauri-plugin-sql tauri-plugin-store serde serde_json tokio reqwest futures-util uuid
cd ..

# Ollama
ollama serve &
ollama pull qwen3:8b
curl http://localhost:11434/api/tags

# Dev
cargo tauri dev        # или npm run tauri dev
cargo tauri build      # релиз
```

**.gitignore:**
```
node_modules/
dist/
target/
src-tauri/target/
.DS_Store
.env
*.db
data/
```

---

## 12. Промпт для агента (копипаста)

```
Прочитай ARCHITECTURE.md v0.2. Проект NewEra — нативный Tauri 2 + React + TS + Rust + SQLite + Ollama. Никакого Python/FastAPI.

Иди строго по Этапам 1-6, не перепрыгивай.

Сейчас ЭТАП 1: Скелет.
- Инициализируй Tauri 2 (react-ts), Tailwind, shadcn
- Сделай src-tauri/src/lib.rs с invoke_handler и пустыми командами из раздела 6
- Сделай React Layout из раздела 8 (Sidebar + Main, темная тема, без логики)
- Проверь `cargo tauri dev` открывает окно.

Не делай DB, не делай Ollama. Только скелет. Жду демо — потом Этап 2.
```

---

**Готово к `git init`. Скажи "делай Этап 1" — соберу скелет.**
