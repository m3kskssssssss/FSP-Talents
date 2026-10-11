# API

- Интерактивная документация: **`/api/docs`** (Swagger UI).
- Спецификация OpenAPI 3.1: **`/api/openapi.json`**, выгрузка в репозитории — [`openapi.json`](openapi.json) (`npm run openapi`).

Спецификация строится из **тех же Zod-схем**, что валидируют запросы (`server/schemas/*`), поэтому документация не расходится с кодом.

## Соглашения

| Что | Как |
|---|---|
| Префикс | `/api/v1` |
| Аутентификация | Сессия Auth.js (httpOnly cookie). Вход — `/login`; для скриптов — `POST /api/auth/callback/credentials` с CSRF-токеном |
| Формат ошибок | `{ "error": { "code", "message", "details?" } }` |
| 401 / 403 | Нет сессии / нет прав по роли |
| 404 | Не найдено **или чужое** (не раскрываем существование) |
| 409 | Недопустимый переход статуса, дубль, кулдаун пересдачи |
| 422 | Ошибка валидации — в т. ч. отсутствие вилки зарплаты |
| 429 | Rate limit (вход, регистрация, приглашения, LLM-эндпоинты) |

## Группы эндпоинтов

| Группа | Основные пути |
|---|---|
| Аккаунт | `POST /auth/register`, `POST /auth/resend` |
| Кандидат | `GET/PUT /me/profile`, `PUT /me/contacts`, `PUT /me/skills`, `PUT /me/visibility`, `POST /me/consents`, `GET /me/access-log`, `POST /me/resume`, `GET /me/resume.pdf`, `POST /me/fsp`, `POST /me/achievements`, `POST /me/certificates`, `POST /me/repo-check`, `DELETE /me` |
| Тестирование | `GET /tests`, `POST /tests/attempts`, `GET /tests/attempts/{id}`, `POST …/items/{itemId}/hidden`, `POST …/items/{itemId}/answer`, `POST …/events`, `POST …/finish` |
| Подбор | `POST /needs/parse`, `GET/POST /needs`, `POST /needs/{id}/search`, `GET/POST /searches`, `GET /searches/{id}?фильтры`, `POST /searches/{id}/rephrase`, `GET /shortlist`, `PUT/DELETE /shortlist/{profileId}` |
| Приглашения | `GET/POST /invitations`, `GET /invitations/{id}`, `POST /invitations/{id}/decision`, `POST /invitations/{id}/withdraw`, `GET /candidates/{profileId}` |
| Вакансии | `GET/POST /vacancies`, `POST /vacancies/{id}/apply`, `POST /vacancies/{id}/close`, `GET /vacancies/{id}/applications`, `PATCH /applications/{id}` |
| Модерация | `GET /admin/attempts`, `GET /admin/attempts/{id}`, `POST /admin/attempts/{id}/review`, `GET /admin/templates`, `PATCH /admin/templates/{id}`, `GET /admin/plagiarism` |
| Регулярные задачи | `GET/POST /challenges`, `POST /challenges/{id}/close`, `GET /challenges/submissions`, `POST /challenges/submissions/{id}/grade`, `GET /me/challenges`, `POST /me/challenges/{id}/answer`, `POST /me/challenges/{id}/skip` |
| Чаты | `GET /chats`, `GET/POST /chats/{id}/messages`, `GET /me/unread` |
| Видеоинтервью | `POST /chats/{id}/interviews`, `GET /interviews`, `GET /interviews/{id}`, `POST /interviews/{id}/token`, `PUT /interviews/{id}/code`, `POST /interviews/{id}/cancel`, `POST /interviews/{id}/finish` |
| Уведомления | `GET /notifications`, `POST /notifications/read` |

Чего в API нет намеренно: кандидат не может получить чужой профиль ни по одному пути, а эндпоинт текущего задания никогда не возвращает эталоны, решатели и следующие задания.
