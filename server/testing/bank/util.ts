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

import type { Specialization } from "../../config";
import type { QuizTemplate } from "../types";

/**
 * Scenario quiz: a random scenario is shown, the correct answer is its own
 * answer, distractors are answers of other scenarios. Keeps conceptual
 * questions parameterised (the wording and options change per attempt).
 */
export function scenarioQuiz(o: {
  id: string;
  specialization: Specialization;
  title: string;
  skills: string[];
  b: number;
  a: number;
  question: string;
  scenarios: { s: string; a: string }[];
}): QuizTemplate<{ i: number; d: number[] }> {
  return {
    id: o.id,
    specialization: o.specialization,
    kind: "quiz",
    title: o.title,
    skills: o.skills,
    b: o.b,
    a: o.a,
    params: (rng) => {
      const i = rng.int(0, o.scenarios.length - 1);
      const others = [...new Set(o.scenarios.map((x) => x.a).filter((x) => x !== o.scenarios[i]!.a))];
      return { i, d: rng.sample(others.map((_, k) => k), Math.min(3, others.length)).map((k) => o.scenarios.findIndex((x) => x.a === others[k])) };
    },
    statement: (pp) => [p(o.question), p({ b: o.scenarios[pp.i]!.s })],
    options: (pp) => [{ text: o.scenarios[pp.i]!.a, correct: true }, ...pp.d.map((k) => ({ text: o.scenarios[k]!.a, correct: false }))],
  };
}
