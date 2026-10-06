# ФСП Таланты — обратный подбор ИТ-специалистов

Прототип платформы для кейса Федерации спортивного программирования (модель LHH):
кандидат проходит адаптивный тест на выбранный грейд и получает **категорию**
(специализация · грейд), работодатель находит его по категории и **сам приглашает**
с обязательной вилкой зарплаты. Контакты открываются только после согласия кандидата.

> Статус: в разработке, этапы описаны в `docs/` (появятся по мере готовности).

## Быстрый старт (Docker)

```bash
docker compose up --build -d            # app + Postgres 16 + Mailpit
docker compose --profile seed run --rm seed   # синтетические данные и демо-аккаунты
```

- Приложение: http://localhost:3000
- Почта (Mailpit): http://localhost:8025
- API (Swagger UI): http://localhost:3000/api/docs
- Keycloak («ФСП ID», по желанию): `AUTH_KEYCLOAK_ENABLED=true docker compose --profile keycloak up -d`

## Демо-аккаунты

Пароль у всех: `Demo12345`

| Email | Роль | Что показывает |
|---|---|---|
| `candidate@demo.ru` | кандидат без категории | путь «тест → категория» |
| `strong@demo.ru` | кандидат с категорией и ФСП | кабинет, приглашения |
| `employer@demo.ru` | работодатель | потребности, подборка, приглашения |
| `admin@demo.ru` | модератор | попытки, индекс доверия, ловушки |

## Запуск без Docker

Нужны Node.js 22 и PostgreSQL 16.

```bash
cp .env.example .env.local     # заполните AUTH_SECRET, при желании LLM_API_KEY
npm ci
npm run db:migrate
npm run db:seed
npm run dev
```

## Тесты и проверки

```bash
npm run typecheck && npm run lint
npm test                      # Vitest; нужна БД TEST_DATABASE_URL (по умолчанию postgres://fsp:fsp@localhost:5432/fsp_test)
npm run e2e                   # Playwright против запущенного приложения (E2E_BASE_URL)
```

## Деплой на Vercel

1. Импортируйте репозиторий в Vercel (фреймворк Next.js определится сам).
2. Storage → добавьте интеграцию **Neon** (выставит `DATABASE_URL`) и **Blob** (выставит `BLOB_READ_WRITE_TOKEN`).
3. Задайте переменные `AUTH_SECRET`, `APP_URL`, `DEMO_MODE`, `LLM_*`, при желании `RESEND_API_KEY`.
4. Сборка использует скрипт `vercel-build`: сначала применяет миграции, потом собирает приложение.
5. Наполните прод-БД один раз с локальной машины: `DATABASE_URL=<neon url> npm run db:seed`.

Все переменные окружения описаны в `.env.example`.
