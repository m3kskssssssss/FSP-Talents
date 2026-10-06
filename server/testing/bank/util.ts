import type { Rng } from "../rng";
import type { Block, Inline } from "../types";

export const p = (...parts: Inline[]): Block => ({ type: "p", parts });
export const code = (text: string, lang?: string): Block => ({ type: "code", text, lang });
export const c = (s: string | number): Inline => ({ code: String(s) });

export const SERVICE_NAMES = [
  "auth", "billing", "catalog", "orders", "payments", "search", "users", "notify",
  "gateway", "cart", "profile", "media", "reports", "delivery", "audit", "metrics",
];
export const PATHS = [
  "/api/users", "/api/orders", "/api/cart", "/api/search", "/api/login", "/api/items",
  "/api/payments", "/api/reports", "/api/profile", "/api/feed",
];
export const WORDS = [
  "deploy", "cache", "queue", "token", "index", "server", "client", "query", "schema", "commit",
  "branch", "merge", "build", "event", "stream", "proxy", "socket", "thread", "worker", "router",
];
export const CITIES = ["Москва", "Казань", "Новосибирск", "Екатеринбург", "Пермь", "Томск", "Самара", "Сочи"];
export const FIRST_NAMES = ["Анна", "Борис", "Вера", "Глеб", "Дина", "Егор", "Жанна", "Илья", "Кира", "Лев", "Мария", "Олег", "Нина", "Пётр"];
export const DEPARTMENTS = ["backend", "frontend", "data", "qa", "devops", "support"];

export const intArray = (rng: Rng, len: number, min: number, max: number) =>
  Array.from({ length: len }, () => rng.int(min, max));

/** Picks a different value from `options` than `current`. */
export const other = <T>(rng: Rng, options: readonly T[], current: T) =>
  rng.pick(options.filter((o) => o !== current));

export const sqlStr = (s: string) => `'${s.replace(/'/g, "''")}'`;

export const pad2 = (n: number) => String(n).padStart(2, "0");
