# ФСП Таланты — заметки для Claude

## UI и дизайн

Перед любой правкой интерфейса прочитайте `DESIGN.md`. Коротко:

- Цвета — только семантические токены из `app/globals.css` (`bg-surface`, `text-fg`, `text-muted`, `border-line`, `bg-primary text-on-primary`, `text-accent`, `bg-accent-soft`, `text-danger`/`ok`/`warn`). Никаких `bg-white`, `text-gray-*`, `#hex`, `rgb()`. Новый цвет — новый токен с парой `light-dark()`.
- Сначала готовые компоненты из `components/ui/` (`Button`/`buttonClass`, `PageTitle`, `Blank`, `EmptyState`, `chipState`, `Badge`, `Field`, `Logo`). Списки строк — `list-frame`, а не карточка на каждую строку.
- `dark:` только внутри `components/ui/`.
- Каждый экран должен работать в светлой и тёмной теме и на ширине 390 px.
- `tests/unit/design-tokens.test.ts` проверяет эти правила; `npm test` должен проходить.
