import { OpenApiGeneratorV31, OpenAPIRegistry, type RouteConfig } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { errorSchema } from "../schemas/common";
import { registerSchema } from "../schemas/auth";
import { apiRoutes } from "./routes";

/**
 * OpenAPI 3.1 document generated from the same Zod schemas that validate
 * requests. Route list lives in ./routes.ts and grows with each module.
 */
export function buildOpenApi() {
  const registry = new OpenAPIRegistry();
  registry.registerComponent("securitySchemes", "session", {
    type: "apiKey",
    in: "cookie",
    name: "authjs.session-token",
    description: "Сессия Auth.js (httpOnly cookie). Войдите через /login.",
  });
  const errors = {
    401: { description: "Не авторизован", content: { "application/json": { schema: errorSchema } } },
    403: { description: "Нет прав", content: { "application/json": { schema: errorSchema } } },
    422: { description: "Ошибка валидации", content: { "application/json": { schema: errorSchema } } },
  };
  registry.registerPath({
    method: "post",
    path: "/api/v1/auth/register",
    tags: ["Аккаунт"],
    summary: "Регистрация кандидата или работодателя",
    request: { body: { content: { "application/json": { schema: registerSchema } } } },
    responses: {
      200: {
        description: "Создан; отправлено письмо для подтверждения",
        content: { "application/json": { schema: z.object({ ok: z.boolean(), verifyUrl: z.string().optional() }) } },
      },
      409: { description: "Email занят", content: { "application/json": { schema: errorSchema } } },
      422: errors[422],
    },
  });
  for (const r of apiRoutes()) {
    const cfg: RouteConfig = {
      ...r,
      security: r.public ? undefined : [{ session: [] }],
      responses: { ...errors, ...r.responses },
    } as RouteConfig;
    delete (cfg as { public?: boolean }).public;
    registry.registerPath(cfg);
  }
  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: "3.1.0",
    info: {
      title: "ФСП Таланты API",
      version: "1.0.0",
      description:
        "API платформы обратного подбора. Все входные данные валидируются Zod-схемами, из них же построен этот документ. Ошибки валидации — 422, недопустимый переход статуса — 409.",
    },
    servers: [{ url: "/" }],
  });
}
