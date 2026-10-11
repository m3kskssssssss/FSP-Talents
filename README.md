# ФСП Таланты — обратный подбор ИТ-специалистов

Прототип платформы для кейса Федерации спортивного программирования (модель LHH):

1. Кандидат заполняет профиль или загружает PDF-резюме, **сам выбирает грейд** и проходит **адаптивный тест** на него.
2. По результату получает **категорию** «специализация · грейд». Только с ней его видят работодатели.
3. Работодатель описывает потребность (форма или текст вакансии), получает **подборку с доводами «за» и «против»**, уточняет фильтрами и **сам приглашает** кандидата с обязательной вилкой зарплаты.
4. Кандидат принимает или отклоняет. **Контакты открываются только после принятия.**
5. Достижения в соревнованиях ФСП подтверждаются (реестр, сертификат, репозиторий) и поднимают кандидата внутри его категории.
6. Раз в 14 дней кандидат получает короткую задачу от работодателя своей категории: свежий результат виден в подборке.
7. После согласия кандидата стороны общаются в чате и проводят видеоинтервью с общим редактором кода (LiveKit). Тест и интервью — только с компьютера.

**Стенд:** https://fsp-talents.vercel.app (Vercel + Neon, демо-аккаунты ниже). Из некоторых российских сетей домен `*.vercel.app` может открываться только через VPN — это согласовано с организаторами; без VPN решение поднимается локально одной командой (ниже).

## Быстрый старт (Docker)

```bash
docker compose up --build -d                    # app + Postgres 16 + Mailpit (миграции применяются при старте)
docker compose --profile seed run --rm seed     # синтетические данные + демо-аккаунты (≈ 10 с)
```

| Что | Адрес |
|---|---|
| Приложение | http://localhost:3000 |
| Почта (Mailpit) | http://localhost:8025 |
| API (Swagger UI) | http://localhost:3000/api/docs |
| Keycloak «ФСП ID» (по желанию) | `AUTH_KEYCLOAK_ENABLED=true docker compose --profile keycloak up -d` → http://localhost:8080 |

## Демо-аккаунты

Пароль у всех: **`Demo12345`**. В демо-режиме (`DEMO_MODE=true`) страницы входа и регистрации показывают эти аккаунты с кнопкой «Войти» — вход в один клик.

| Email | Роль | Что показывает |
|---|---|---|
| `candidate@demo.ru` | кандидат без категории | путь «резюме → тест → категория» |
| `strong@demo.ru` | кандидат с категорией Backend · Middle и достижениями ФСП | кабинет, входящие приглашения, новая задача от работодателя |
| `employer@demo.ru` | работодатель «Кванта Софт» | потребности, подборка, приглашения, вакансии, регулярные задачи |
| `admin@demo.ru` | модератор | попытки по индексу доверия, ловушки, банк заданий, похожие решения |

В синтетике ещё 320 кандидатов (`cand001…@seed.test`) и 32 работодателя (`emp01…@seed.test`) с тем же паролем.

Сценарий показа на 6–7 минут — [`docs/demo-script.md`](docs/demo-script.md).

## Запуск без Docker

Нужны Node.js 22 и PostgreSQL 16.

```bash
cp .env.example .env.local      # заполните AUTH_SECRET; LLM_API_KEY — по желанию
npm ci
npm run db:migrate
npm run db:seed                 # --reset для полной перегенерации
npm run dev                     # http://localhost:3000
```

Без `LLM_API_KEY` все LLM-функции (разбор вакансии и резюме, перефразирование доводов) работают на детерминированных правилах.

## Переменные окружения

Все переменные с комментариями — в [`.env.example`](.env.example). Главные:

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | PostgreSQL (Neon в проде) |
| `AUTH_SECRET`, `APP_URL`, `AUTH_TRUST_HOST` | Auth.js, ссылки в письмах |
| `DEMO_MODE` | Ссылка подтверждения email на экране, подсказка демо-аккаунтов |
| `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_MODEL_STRONG`, `LLM_EMBEDDING_MODEL`, `LLM_TIMEOUT_MS` | RouterAI (OpenAI-совместимый API) |
| `SMTP_HOST` / `RESEND_API_KEY`, `MAIL_FROM` | Почта: Mailpit локально, Resend на Vercel, иначе лог |
| `BLOB_READ_WRITE_TOKEN`, `STORAGE_DIR` | Файлы: Vercel Blob или локальная папка |
| `AUTH_KEYCLOAK_*` | Вход через «ФСП ID» (по умолчанию выключен) |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | Видеоинтервью (LiveKit Cloud или свой сервер) |
| `UPSTASH_REDIS_REST_*` | Распределённый rate limit (по желанию) |
| `GITHUB_TOKEN` | Лимит GitHub API для проверки репозиториев (по желанию) |

## Тесты, валидация, документация

```bash
npm run typecheck && npm run lint
npm test              # Vitest: 540+ проверок (банк заданий, IRT/CAT, скоринг, сервисы на реальной БД)
                      # нужна БД TEST_DATABASE_URL (по умолчанию postgres://fsp:fsp@localhost:5432/fsp_test)
npm run e2e           # Playwright против запущенного приложения (E2E_BASE_URL, E2E_DATABASE_URL)
npm run validate      # метрики подбора и теста → docs/validation.md + графики (≈ 40 с, без БД)
npm run calibrate     # калибровка IRT-параметров шаблонов → task_templates
npm run openapi       # docs/openapi.json
npm run docs:libs     # docs/libraries.md
```

CI (GitHub Actions) на каждый push:

1. типы, линт, Vitest, сборка;
2. сквозной сценарий Playwright против `docker compose` с наполненной базой: регистрация → тест → категория → поиск → приглашение → принятие → контакты.

## Деплой на Vercel

1. Импортируйте репозиторий в Vercel (фреймворк определится сам).
2. Storage → интеграция **Neon** (выставит `DATABASE_URL`) и **Blob** (`BLOB_READ_WRITE_TOKEN`).
3. Задайте `AUTH_SECRET`, `APP_URL`, `DEMO_MODE=true`, `LLM_API_KEY` и при желании `RESEND_API_KEY`.
4. Сборка использует `vercel-build`: миграции, затем **полный сброс базы и заново сид** (`seed.ts --reset`), потом `next build`. Каждый деплой начинается с чистых демо-данных — всё, что пользователи создали на стенде, стирается.

## Документация

| Документ | Содержание |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | Компоненты, слои, модель данных, ограничения Vercel |
| [`docs/testing.md`](docs/testing.md) | Банк шаблонов, CAT/IRT, проверка кода, антифрод — и почему тест не сольют |
| [`docs/matching.md`](docs/matching.md) | Формула скоринга, ФСП с убывающей отдачей, доводы, снимок подборки |
| [`docs/challenges.md`](docs/challenges.md) | Регулярные задачи от работодателей: выдача, проверка, свежий сигнал |
| [`docs/ats-integration.md`](docs/ats-integration.md) | Концепция интеграции с ATS работодателей |
| [`docs/validation.md`](docs/validation.md) | Результаты валидации с графиками |
| [`docs/fsp-integration.md`](docs/fsp-integration.md) | Реестр ФСП, ФСП ID через Keycloak, маппинг полей |
| [`docs/api.md`](docs/api.md), [`docs/openapi.json`](docs/openapi.json) | API |
| [`docs/security.md`](docs/security.md) | Жёсткие правила ТЗ, 152-ФЗ, безопасность |
| [`docs/libraries.md`](docs/libraries.md) | Библиотеки с версиями |
| [`docs/limitations.md`](docs/limitations.md) | Ограничения и план развития |
| [`docs/demo-script.md`](docs/demo-script.md) | Сценарий демо |
| [`DESIGN.md`](DESIGN.md) | Дизайн-система: токены светлой и тёмной темы, компоненты, правила для новых экранов |

## Стек

Next.js 15 (App Router) · TypeScript strict · PostgreSQL + Drizzle · Auth.js v5 (argon2id, Keycloak OIDC) · Zod → OpenAPI 3.1 · RouterAI (пакет `openai`) · Pyodide / sql.js в Web Worker · CodeMirror 6 · Tailwind CSS v4 · Vitest · Playwright · Docker Compose.
