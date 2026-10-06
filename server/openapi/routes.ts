import type { RouteConfig } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
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
  return [
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
