# ROADMAP — NewEra (Tauri Desktop)

## Этап 1 — Скелет ✅
## Этап 2 — Данные ✅

## Этап 3 — AI Streaming (День 5-7) ✅
- [x] providers/ollama.rs (reqwest stream)
- [x] services/prompt.rs (system + memories + history)
- [x] send_message + emit(chat:chunk) + markdown
- [x] abort_generation
- **Done:** живой чат с qwen3:8b, стриминг, markdown

## Этап 4 — Memory (День 8-9) ✅
- [x] memories table + CRUD
- [x] inject в промпт
- [x] MemoryEditor UI
- **Done:** память изолирована по Space

## Этап 5 — Polish (День 10-11) ✅
- [x] Settings: модель/temperature/ollama_url/theme (готов UI Dialog)
- [x] Авто-титул чата из первого сообщения
- [x] Экспорт чата в .md
- [x] Поиск чатов в сайдбаре
- [ ] Хоткеи: Ctrl+N, Esc, Ctrl+K

## Этап 6 — Build (День 12-13)
- [ ] tauri bundler, иконки, README
- [ ] v0.1.0-mvp (.deb/.AppImage/.exe)
