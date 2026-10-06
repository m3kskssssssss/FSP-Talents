import type { RouteConfig } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

export type ApiRoute = Omit<RouteConfig, "responses"> & {
  responses: RouteConfig["responses"];
  public?: boolean;
};

export const json = <T extends z.ZodType>(schema: T, description = "OK") => ({
  description,
  content: { "application/json": { schema } },
});

export const body = <T extends z.ZodType>(schema: T) => ({ body: { content: { "application/json": { schema } } } });

/** Each feature module appends its routes here. */
export function apiRoutes(): ApiRoute[] {
  return [];
}
