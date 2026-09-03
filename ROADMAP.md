# ROADMAP — NewEra (Tauri Desktop)

## Этап 1 — Скелет (День 1) — NEXT
- [ ] Tauri 2 + React + TS + Tailwind + shadcn
- [ ] Rust lib.rs + пустые IPC команды
- [ ] Layout Sidebar + ChatView (мок)
- **Done:** `cargo tauri dev` открывает темное окно

## Этап 2 — Данные (День 2-4)
- [ ] SQLite (rusqlite/tauri-plugin-sql) + миграции
- [ ] Spaces/Chats/Messages CRUD via IPC
- [ ] Zustand + UI переключение Spaces
- **Done:** данные сохраняются, изоляция Space работает

## Этап 3 — AI Streaming (День 5-7)
- [ ] providers/ollama.rs (reqwest stream)
- [ ] services/prompt.rs (system + memories + history)
- [ ] send_message + emit(chat:chunk) + markdown
- **Done:** живой чат с qwen2.5:3b, стриминг

## Этап 4 — Memory (День 8-9)
- [ ] memories table + CRUD
- [ ] inject в промпт
- [ ] MemoryEditor UI
- **Done:** память изолирована по Space

## Этап 5 — Polish (День 10-11)
- [ ] Settings (модель/temperature/ollama_url/theme)
- [ ] Авто-титул, поиск, экспорт .md, оффлайн баннер, хоткеи
- **Done:** daily-driver готов

## Этап 6 — Build (День 12-13)
- [ ] tauri bundler, иконки, README
- [ ] v0.1.0-mvp (.deb/.AppImage/.exe)
