import type { RouteConfig } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { baseSearchSchema, needCreateSchema, needParseSchema, rephraseSchema, searchFiltersSchema } from "../schemas/needs";
import { repoCheckSchema } from "../schemas/candidate";
import { consentSchema, contactsSchema, deleteAccountSchema, fspLinkSchema, profileUpdateSchema, selfAchievementSchema, skillsSchema, visibilitySchema } from "../schemas/candidate";
import { invitationCreateSchema, invitationDecisionSchema, reportResolveSchema, reportSchema } from "../schemas/invitations";
import { attemptsFilterSchema, reviewSchema, templateStatusSchema } from "../schemas/moderation";
import { applicationStatusSchema, applySchema, vacancyCreateSchema, vacancyListSchema } from "../schemas/vacancies";
import { answerSchema, attemptEventsSchema, startAttemptSchema } from "../schemas/testing";

export type ApiRoute = Omit<RouteConfig, "responses"> & {
  responses: RouteConfig["responses"];
  public?: boolean;
};

export const json = <T extends z.ZodType>(schema: T, description = "OK") => ({
  description,
  content: { "application/json": { schema } },
});

export const body = <T extends z.ZodType>(schema: T) => ({ body: { content: { "application/json": { schema } } } });

const ok = json(z.object({}).passthrough());
const attemptParams = z.object({ id: z.uuid() });
const itemParams = z.object({ id: z.uuid(), itemId: z.uuid() });

/** Each feature module appends its routes here. */
export function apiRoutes(): ApiRoute[] {
  const T = ["Тестирование"];
  const M = ["Подбор"];
  const idParams = z.object({ id: z.uuid() });
  const matching: ApiRoute[] = [
    { method: "post", path: "/api/v1/needs/parse", tags: M, summary: "Разобрать текст вакансии в черновик потребности (ИИ с фолбэком на правила). Ничего не сохраняет", request: body(needParseSchema), responses: { 200: ok } },
    { method: "get", path: "/api/v1/needs", tags: M, summary: "Потребности работодателя", responses: { 200: ok } },
    { method: "post", path: "/api/v1/needs", tags: M, summary: "Создать потребность. Без вилки зарплаты — 422", request: body(needCreateSchema), responses: { 200: ok } },
    { method: "get", path: "/api/v1/needs/{id}", tags: M, summary: "Потребность", request: { params: idParams }, responses: { 200: ok, 404: ok } },
    { method: "post", path: "/api/v1/needs/{id}/search", tags: M, summary: "Подбор: жёсткий фильтр по категории из теста + скоринг; сохраняет исходную подборку (снимок)", request: { params: idParams }, responses: { 200: json(z.object({ searchId: z.uuid(), total: z.number() })) } },
    { method: "post", path: "/api/v1/searches", tags: M, summary: "Поиск по базе без потребности", request: body(baseSearchSchema), responses: { 200: json(z.object({ searchId: z.uuid(), total: z.number() })) } },
    { method: "get", path: "/api/v1/searches", tags: M, summary: "История подборок", responses: { 200: ok } },
    { method: "get", path: "/api/v1/searches/{id}", tags: M, summary: "Результаты подборки; фильтры применяются поверх снимка, без фильтров — исходная подборка. Контактов в ответе нет", request: { params: idParams, query: searchFiltersSchema }, responses: { 200: ok, 404: ok } },
    { method: "post", path: "/api/v1/searches/{id}/rephrase", tags: M, summary: "Перефразировать доводы ИИ без новых фактов (фолбэк — шаблоны)", request: { params: idParams, ...body(rephraseSchema) }, responses: { 200: ok } },
    { method: "get", path: "/api/v1/shortlist", tags: M, summary: "Избранное", responses: { 200: ok } },
    { method: "put", path: "/api/v1/shortlist/{profileId}", tags: M, summary: "Добавить в избранное", request: { params: z.object({ profileId: z.uuid() }) }, responses: { 200: ok } },
    { method: "delete", path: "/api/v1/shortlist/{profileId}", tags: M, summary: "Убрать из избранного", request: { params: z.object({ profileId: z.uuid() }) }, responses: { 200: ok } },
  ];
  const I = ["Приглашения"];
  const inv: ApiRoute[] = [
    { method: "post", path: "/api/v1/invitations", tags: I, summary: "Пригласить кандидата. Вилка обязательна (иначе 422); дубль открытого приглашения — 409; лимит в сутки — 429", request: body(invitationCreateSchema), responses: { 200: ok, 409: ok, 429: ok } },
    { method: "get", path: "/api/v1/invitations", tags: I, summary: "Приглашения: кандидат видит свои, работодатель — отправленные", responses: { 200: ok } },
    { method: "get", path: "/api/v1/invitations/{id}", tags: I, summary: "Приглашение и история статусов (кандидат: открытие переводит sent → viewed)", request: { params: idParams }, responses: { 200: ok, 404: ok } },
    { method: "post", path: "/api/v1/invitations/{id}/decision", tags: I, summary: "Кандидат принимает или отклоняет. Недопустимый переход — 409", request: { params: idParams, ...body(invitationDecisionSchema) }, responses: { 200: ok, 409: ok } },
    { method: "post", path: "/api/v1/invitations/{id}/report", tags: I, summary: "Жалоба кандидата на приглашение (фиктивная вакансия, несоответствие условий, спам). Открытое приглашение заодно отклоняется. Повтор — 409", request: { params: idParams, ...body(reportSchema) }, responses: { 200: ok, 404: ok, 409: ok } },
    { method: "post", path: "/api/v1/invitations/{id}/withdraw", tags: I, summary: "Работодатель отзывает приглашение", request: { params: idParams }, responses: { 200: ok, 409: ok } },
    { method: "get", path: "/api/v1/candidates/{profileId}", tags: I, summary: "Профиль кандидата для работодателя; contacts = null до принятия приглашения", request: { params: z.object({ profileId: z.uuid() }) }, responses: { 200: ok, 404: ok } },
    { method: "get", path: "/api/v1/notifications", tags: I, summary: "Уведомления пользователя", responses: { 200: ok } },
    { method: "post", path: "/api/v1/notifications/read", tags: I, summary: "Отметить уведомления прочитанными", responses: { 200: ok } },
  ];
  const C = ["Кандидат"];
  const me: ApiRoute[] = [
    { method: "get", path: "/api/v1/me/profile", tags: C, summary: "Собственный профиль кандидата (чужих профилей кандидату не отдаёт ни один эндпоинт)", responses: { 200: ok } },
    { method: "put", path: "/api/v1/me/profile", tags: C, summary: "Обновить профиль и опрос", request: body(profileUpdateSchema), responses: { 200: ok } },
    { method: "put", path: "/api/v1/me/contacts", tags: C, summary: "Контакты (хранятся отдельно, работодатель видит их только после принятия приглашения)", request: body(contactsSchema), responses: { 200: ok } },
    { method: "put", path: "/api/v1/me/skills", tags: C, summary: "Заявленные навыки", request: body(skillsSchema), responses: { 200: ok } },
    { method: "put", path: "/api/v1/me/visibility", tags: C, summary: "Скрыть/показать профиль", request: body(visibilitySchema), responses: { 200: ok } },
    { method: "post", path: "/api/v1/me/consents", tags: C, summary: "Дать или отозвать согласие (152-ФЗ)", request: body(consentSchema), responses: { 200: ok } },
    { method: "get", path: "/api/v1/me/access-log", tags: C, summary: "Журнал доступа к контактам", responses: { 200: ok } },
    { method: "post", path: "/api/v1/me/resume", tags: C, summary: "Загрузить PDF-резюме (multipart, поле file, ≤ 4 МБ): разбор ИИ или правилами", responses: { 200: ok, 422: ok } },
    { method: "get", path: "/api/v1/me/resume.pdf", tags: C, summary: "Сгенерированное PDF-резюме из профиля", responses: { 200: { description: "application/pdf" } } },
    { method: "post", path: "/api/v1/me/fsp", tags: C, summary: "Привязать ФСП ID и импортировать достижения из реестра (мок). 404 — нет в реестре, 503 — реестр недоступен", request: body(fspLinkSchema), responses: { 200: ok, 404: ok, 503: ok } },
    { method: "post", path: "/api/v1/me/achievements", tags: C, summary: "Добавить заявленное достижение (доверие low)", request: body(selfAchievementSchema), responses: { 200: ok } },
    { method: "delete", path: "/api/v1/me/achievements/{id}", tags: C, summary: "Удалить заявленное достижение", request: { params: idParams }, responses: { 200: ok } },
    { method: "post", path: "/api/v1/me/certificates", tags: C, summary: "Сертификат (multipart: file + поля достижения): метаданные → сигналы риска → уровень доверия organizer/self", responses: { 200: ok, 422: ok } },
    { method: "post", path: "/api/v1/me/repo-check", tags: C, summary: "Подтвердить хакатон репозиторием GitHub (уровень доверия repo)", request: body(repoCheckSchema), responses: { 200: ok, 503: ok } },
    { method: "delete", path: "/api/v1/me", tags: C, summary: "Удалить аккаунт с анонимизацией", request: body(deleteAccountSchema), responses: { 200: ok } },
  ];
  const A = ["Модерация"];
  const admin: ApiRoute[] = [
    { method: "get", path: "/api/v1/admin/attempts", tags: A, summary: "Попытки по индексу доверия (сначала самые подозрительные)", request: { query: attemptsFilterSchema }, responses: { 200: ok } },
    { method: "get", path: "/api/v1/admin/attempts/{id}", tags: A, summary: "Журнал попытки, сработавшие ловушки, похожие решения", request: { params: idParams }, responses: { 200: ok } },
    { method: "post", path: "/api/v1/admin/attempts/{id}/review", tags: A, summary: "Решение модератора: подтвердить (категория с пометкой) или отклонить", request: { params: idParams, ...body(reviewSchema) }, responses: { 200: ok } },
    { method: "get", path: "/api/v1/admin/reports", tags: A, summary: "Жалобы на работодателей с их репутацией; ?status=open|confirmed|dismissed", responses: { 200: ok } },
    { method: "post", path: "/api/v1/admin/reports/{id}", tags: A, summary: "Решение по жалобе: подтвердить (компания получает статус риска и минимальную квоту) или отклонить", request: { params: idParams, ...body(reportResolveSchema) }, responses: { 200: ok, 404: ok } },
    { method: "get", path: "/api/v1/admin/templates", tags: A, summary: "Банк шаблонов: IRT, экспозиция, детектор слива", responses: { 200: ok } },
    { method: "patch", path: "/api/v1/admin/templates/{id}", tags: A, summary: "Статус шаблона active / flagged / retired", request: { params: z.object({ id: z.string() }), ...body(templateStatusSchema) }, responses: { 200: ok } },
    { method: "get", path: "/api/v1/admin/plagiarism", tags: A, summary: "Кластеры похожих решений (n-граммы токенов)", responses: { 200: ok } },
  ];
  const V = ["Вакансии"];
  const vac: ApiRoute[] = [
    { method: "get", path: "/api/v1/vacancies", tags: V, summary: "Открытые вакансии (или свои — mine=1 для работодателя)", request: { query: vacancyListSchema }, responses: { 200: ok } },
    { method: "post", path: "/api/v1/vacancies", tags: V, summary: "Опубликовать вакансию (вилка обязательна)", request: body(vacancyCreateSchema), responses: { 200: ok } },
    { method: "post", path: "/api/v1/vacancies/{id}/apply", tags: V, summary: "Отклик кандидата с категорией; открывает контакты работодателю", request: { params: idParams, ...body(applySchema) }, responses: { 200: ok, 403: ok, 409: ok } },
    { method: "post", path: "/api/v1/vacancies/{id}/close", tags: V, summary: "Закрыть вакансию", request: { params: idParams }, responses: { 200: ok } },
    { method: "get", path: "/api/v1/vacancies/{id}/applications", tags: V, summary: "Отклики на вакансию", request: { params: idParams }, responses: { 200: ok } },
    { method: "patch", path: "/api/v1/applications/{id}", tags: V, summary: "Статус отклика", request: { params: idParams, ...body(applicationStatusSchema) }, responses: { 200: ok, 409: ok } },
  ];
  return [
    ...vac,
    ...me,
    ...admin,
    ...matching,
    ...inv,
    { method: "get", path: "/api/v1/tests", tags: T, summary: "Доступные тесты, правила пересдачи и история попыток", responses: { 200: ok } },
    {
      method: "post",
      path: "/api/v1/tests/attempts",
      tags: T,
      summary: "Начать попытку (выбранный грейд). 409 — кулдаун 14 дней или нужен результат ≥ 25/30 на грейде ниже",
      request: body(startAttemptSchema),
      responses: { 200: json(z.object({ attemptId: z.uuid() })), 409: ok },
    },
    { method: "get", path: "/api/v1/tests/attempts/{id}", tags: T, summary: "Состояние попытки и текущее задание (без эталонов)", request: { params: attemptParams }, responses: { 200: ok, 404: ok } },
    {
      method: "post",
      path: "/api/v1/tests/attempts/{id}/items/{itemId}/hidden",
      tags: T,
      summary: "Получить скрытые входы, сгенерированные в момент запроса (seed попытки + nonce)",
      request: { params: itemParams },
      responses: { 200: ok, 409: ok },
    },
    {
      method: "post",
      path: "/api/v1/tests/attempts/{id}/items/{itemId}/answer",
      tags: T,
      summary: "Отправить ответ: выходы на скрытых входах и код / значение / выбранные варианты",
      request: { params: itemParams, ...body(answerSchema) },
      responses: { 200: ok, 409: ok },
    },
    { method: "post", path: "/api/v1/tests/attempts/{id}/events", tags: T, summary: "Журнал попытки (уходы со вкладки, вставки и т. п.)", request: { params: attemptParams, ...body(attemptEventsSchema) }, responses: { 200: ok } },
    { method: "post", path: "/api/v1/tests/attempts/{id}/finish", tags: T, summary: "Завершить попытку досрочно", request: { params: attemptParams }, responses: { 200: ok } },
  ];
}
