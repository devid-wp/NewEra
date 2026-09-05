# ROADMAP — NewEra (Tauri Desktop)

## Этап 1 — Скелет ✅
## Этап 2 — Данные ✅

## Этап 3 — AI Streaming (День 5-7) ✅
- [x] providers/ollama.rs (reqwest stream)
- [x] services/prompt.rs (system + memories + history)
- [x] send_message + emit(chat:chunk) + markdown
- [x] abort_generation
- **Done:** живой чат с qwen2.5:3b, стриминг, markdown

## Этап 4 — Memory (День 8-9) ← NEXT
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
