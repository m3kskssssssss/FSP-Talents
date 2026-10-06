# Архитектура

Монолит на Next.js 15 (App Router) с явным разделением слоёв. Один деплой на Vercel, одна база PostgreSQL.

```mermaid
flowchart LR
  subgraph Browser["Браузер"]
    UI["Страницы React<br/>(app/*)"]
    W["Web Worker (module)<br/>Pyodide · JS · sql.js"]
  end
  subgraph Next["Next.js на Vercel / в Docker"]
    MW["middleware.ts<br/>роли (1-я линия)"]
    RH["Route handlers<br/>app/api/v1/* (тонкие)"]
    SV["Сервисы<br/>server/services/*"]
    DOM["Доменная логика без БД<br/>server/testing · server/matching · server/invitations"]
    LLM["server/llm<br/>RouterAI + фолбэки"]
    ADP["Адаптеры<br/>Mailer · FileStorage · FspRegistry"]
  end
  DB[("PostgreSQL<br/>Neon / Postgres 16")]
  EXT["RouterAI · Resend/Mailpit · Vercel Blob<br/>Реестр ФСП (мок) · GitHub API · Keycloak"]
  UI -->|fetch JSON| MW --> RH --> SV
  SV --> DOM
  SV --> LLM --> EXT
  SV --> ADP --> EXT
  SV --> DB
  UI <-->|postMessage| W
  W -.->|CDN jsDelivr| EXT
```

## Слои

| Слой | Где | Что делает | Чего не делает |
|---|---|---|---|
| UI | `app/`, `components/` | Серверные компоненты читают данные через сервисы, клиентские — через API | Не хранит эталонов, не решает доступ |
| Route handlers | `app/api/v1/**/route.ts` | Аутентификация (`server/http/guard.ts`), Zod-валидация (`parseJson`/`parseQuery`), маппинг ошибок в HTTP (`server/http/route.ts`) | Бизнес-логики нет: 5–15 строк на эндпоинт |
| Сервисы | `server/services/*` | Бизнес-правила, транзакции, проверка владельца, аудит, уведомления | Не знают про HTTP |
| Домен без БД | `server/testing`, `server/matching`, `server/invitations/fsm.ts`, `server/evidence` | IRT/CAT, генераторы заданий, проверка ответов, скоринг, конечный автомат, ловушки, калибровка | Чистые функции — тестируются и симулируются без базы |
| Данные | `server/db/schema.ts`, `drizzle/` | Схема Drizzle, миграции | — |
| Адаптеры | `server/mail`, `server/storage`, `server/fsp`, `server/llm` | Интерфейс + 2 реализации (локально / Vercel / мок) | — |

Права проверяются дважды: `middleware.ts` отсекает чужие разделы по роли из JWT, а сервисы перечитывают роль и статус пользователя из БД на каждом запросе (`requireActor`) и проверяют владельца ресурса. Чужие ресурсы возвращают 404 — так нельзя узнать, существует ли объект.

## Модель данных

```mermaid
erDiagram
  users ||--o{ consents : "согласия (версия, дата)"
  users ||--o| candidate_profiles : ""
  users ||--o| employers : ""
  candidate_profiles ||--|| candidate_contacts : "отдельная сущность"
  candidate_profiles ||--o{ candidate_skills : "declared / resume / test_confirmed"
  candidate_profiles ||--o{ categories : "active / superseded"
  candidate_profiles ||--o{ test_attempts : ""
  test_attempts ||--o{ attempt_items : "по одному"
  test_attempts ||--o{ attempt_events : "журнал"
  task_templates ||--o{ attempt_items : ""
  candidate_profiles ||--o{ fsp_achievements : "источник + доверие"
  candidate_profiles ||--o{ certificates : ""
  employers ||--o{ needs : ""
  needs ||--o{ searches : "base_snapshot + filters"
  employers ||--o{ shortlist : ""
  employers ||--o{ invitations : ""
  invitations ||--o{ invitation_events : "история статусов"
  employers ||--o{ vacancies : ""
  vacancies ||--o{ applications : ""
```

Ключевые решения:

- **Контакты — отдельная таблица `candidate_contacts`.** Сериализатор работодателя (`toCard`, `candidateForEmployer`) не обращается к ней без проверки `hasContactAccess`. Каждое чтение и раскрытие контактов попадает в `audit_log`.
- **Подборка — неизменяемый снимок** (`searches.base_snapshot`): список id и скоров на момент поиска. Фильтры хранятся отдельно и применяются поверх снимка.
- **Генераторы заданий — код**, а метаданные шаблонов (IRT a/b, экспозиция, счётчики для детектора слива, статус) — строки `task_templates`. Синхронизация идёт через `syncTemplates()`, откалиброванные параметры не перетираются.
- **Эталоны не хранятся.** Вариант задания — детерминированная функция `(шаблон, seed задания)`, сервер пересчитывает эталон при проверке.
- **Периодические процессы без cron.** Протухание приглашений и попыток, а также «свежесть» профиля считаются лениво при чтении (ограничение бесплатного Vercel).

## Ограничения Vercel и как они учтены

| Ограничение | Решение |
|---|---|
| Нет фоновых воркеров | Всё короткими запросами; ленивое протухание; калибровка — CLI-скрипт |
| Таймаут функций | LLM: таймаут 20 с, `maxDuration = 30`, один вызов на запрос, кеш по хешу входа, детерминированный фолбэк |
| Нет файловой системы | `FileStorage`: Vercel Blob в проде, `./storage` локально; лимит загрузки 4 МБ |
| COOP/COEP для прерывания Pyodide | Заголовки только на `/test/*` и `/runner/*`; на страницу теста — полная навигация; module-воркер |
| Пул соединений | `postgres` с `prepare: false` (pgbouncer Neon), `max: 1` в serverless |
| In-memory rate limit — на инстанс | Upstash при наличии ключа; суточный лимит приглашений — в БД |
