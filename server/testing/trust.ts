import { personFitLz, type Response } from "./irt";
import type { TaskKind } from "./types";

export type TrustLevel = "high" | "medium" | "low";

export interface TrustInput {
  events: { type: string; payload?: Record<string, unknown> | null }[];
  items: { kind: TaskKind; b: number; x: number | null; timeMs: number | null; trapHits: string[] }[];
  theta: number;
  responses: Response[];
}

export interface TrustSignal {
  code: string;
  title: string;
  points: number;
  count?: number;
}

/** Minimum plausible time (ms) for a correct answer to a hard item, by kind. */
const FAST_MS: Record<TaskKind, number> = { code: 45_000, sql: 30_000, calc: 12_000, quiz: 5_000 };

const capped = (n: number, per: number, cap: number) => Math.min(cap, n * per);

/**
 * Trust index of an attempt: 100 minus the weighted sum of suspicious
 * signals. Levels: high >= 70 (category assigned), medium 40..69 (assigned
 * with a mark), low < 40 (not assigned, human review suggested). There are no
 * automatic bans: the index only routes the attempt.
 */
export function computeTrust(input: TrustInput): { index: number; level: TrustLevel; signals: TrustSignal[] } {
  const signals: TrustSignal[] = [];
  const count = (type: string) => input.events.filter((e) => e.type === type).length;
  const add = (code: string, title: string, points: number, n?: number) => {
    if (points > 0) signals.push({ code, title, points: Math.round(points), count: n });
  };

  const marker = input.items.filter((i) => i.trapHits.includes("marker")).length;
  add("marker", "Персональный маркер попытки найден в решении", capped(marker, 65, 90), marker);
  const twin = input.items.filter((i) => i.trapHits.includes("twin")).length;
  add("twin", "Ответ посчитан по скрытому значению-двойнику (условие скопировано не с экрана)", capped(twin, 40, 80), twin);

  const bulk = count("bulk_insert");
  add("bulk_insert", "Вставка крупных блоков кода в редактор", capped(bulk, 8, 30), bulk);
  const paste = count("paste");
  add("paste", "Вставки из буфера обмена", capped(Math.max(0, paste - 2), 2, 10), paste);
  const hidden = count("visibility_hidden") + count("blur");
  add("tab_leave", "Уходы со вкладки / потеря фокуса", capped(Math.max(0, hidden - 2), 2, 20), hidden);
  const fs = count("fullscreen_exit");
  add("fullscreen_exit", "Выходы из полноэкранного режима", capped(Math.max(0, fs - 1), 4, 20), fs);
  const copy = count("copy") + count("context_menu");
  add("copy", "Попытки скопировать условие", capped(copy, 3, 12), copy);
  const devtools = count("devtools");
  add("devtools", "Открыты инструменты разработчика", capped(devtools, 10, 20), devtools);

  const fast = input.items.filter(
    (i) => i.x !== null && i.x >= 1 && i.b >= input.theta + 0.5 && i.timeMs !== null && i.timeMs < FAST_MS[i.kind],
  ).length;
  add("fast_hard", "Аномально быстрые верные ответы на сложные задания", capped(fast, 10, 30), fast);

  if (input.responses.length >= 8) {
    const lz = personFitLz(input.theta, input.responses);
    if (lz < -3) add("person_fit", `Нетипичный профиль ответов (person-fit lz = ${lz.toFixed(1)})`, 25);
    else if (lz < -2) add("person_fit", `Нетипичный профиль ответов (person-fit lz = ${lz.toFixed(1)})`, 15);
  }

  const total = signals.reduce((s, x) => s + x.points, 0);
  const index = Math.max(0, 100 - total);
  const level: TrustLevel = index >= 70 ? "high" : index >= 40 ? "medium" : "low";
  return { index, level, signals };
}
