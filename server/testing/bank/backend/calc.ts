import type { Rng } from "../../rng";
import type { CalcTemplate, Inline } from "../../types";
import { c, intArray, other, p } from "../util";

const pagination: CalcTemplate<{ total: number; size: number; page: number }> = {
  id: "be-calc-pagination",
  specialization: "backend",
  kind: "calc",
  title: "Смещение страницы",
  skills: ["sql", "api"],
  b: -2.0,
  a: 0.9,
  params: (rng) => ({ total: rng.int(120, 900), size: rng.pick([10, 20, 25, 50]), page: rng.int(3, 9) }),
  twin: { key: "size", alt: (pp, rng) => ({ ...pp, size: other(rng, [10, 20, 25, 50], pp.size) }) },
  statement: (pp, t) => [
    p("Список из ", t.v("total", pp.total), " записей отдаётся страницами по ", t.v("size", pp.size), " штук, страницы нумеруются с 1, запрос: ", c("LIMIT size OFFSET ?"), "."),
    p("Какое значение OFFSET нужно передать для страницы ", t.v("page", pp.page), "?"),
  ],
  answer: (pp) => (pp.page - 1) * pp.size,
  answerHint: "Целое число",
};

const errorRate: CalcTemplate<{ counts: number[]; codes: number[] }> = {
  id: "be-calc-error-rate",
  specialization: "backend",
  kind: "calc",
  title: "Доля серверных ошибок",
  skills: ["мониторинг", "http"],
  b: -1.6,
  a: 1.0,
  params: (rng) => {
    const codes = [200, 201, 304, 400, 404, 500, 502, 503];
    return { codes, counts: codes.map((cd) => (cd < 300 ? rng.int(300, 900) : rng.int(5, 80))) };
  },
  twin: {
    key: "counts.5",
    alt: (pp, rng) => {
      const counts = [...pp.counts];
      counts[5] = counts[5]! + rng.int(20, 60);
      return { ...pp, counts };
    },
  },
  statement: (pp, t) => [
    p("За минуту сервис ответил так:"),
    { type: "table", head: ["Статус", "Ответов"], rows: pp.codes.map((cd, i) => [String(cd), t.v(`counts.${i}`, pp.counts[i]!) as Inline]) },
    p("Какая доля ответов (в процентах) — серверные ошибки (5xx)? Округлите до одного знака после запятой."),
  ],
  answer: (pp) => {
    const total = pp.counts.reduce((s, x) => s + x, 0);
    const err = pp.counts.reduce((s, x, i) => s + (pp.codes[i]! >= 500 ? x : 0), 0);
    return Math.round((err / total) * 1000) / 10;
  },
  answerHint: "Число с одним знаком после запятой, например 4.2",
  tolerance: 0.051,
};

const lruHits: CalcTemplate<{ cap: number; seq: string[] }> = {
  id: "be-calc-lru-hits",
  specialization: "backend",
  kind: "calc",
  title: "Попадания в LRU-кэш",
  skills: ["кэширование"],
  b: 0.8,
  a: 1.4,
  params: (rng) => {
    const keys = ["A", "B", "C", "D", "E"];
    return { cap: rng.int(2, 3), seq: Array.from({ length: 12 }, () => rng.pick(keys)) };
  },
  twin: { key: "cap", alt: (pp) => ({ ...pp, cap: pp.cap === 2 ? 3 : 2 }) },
  statement: (pp, t) => [
    p("Изначально пустой LRU-кэш ёмкостью ", t.v("cap", pp.cap), " получает обращения по ключам:"),
    { type: "code", text: pp.seq.join(" ") },
    p("Сколько обращений будут попаданиями (ключ уже был в кэше)?"),
  ],
  answer: (pp) => {
    const m: string[] = [];
    let hits = 0;
    for (const k of pp.seq) {
      const i = m.indexOf(k);
      if (i >= 0) {
        hits++;
        m.splice(i, 1);
      } else if (m.length >= pp.cap) m.shift();
      m.push(k);
    }
    return hits;
  },
  answerHint: "Целое число",
};

const shards: CalcTemplate<{ s: number; ids: number[] }> = {
  id: "be-calc-shards",
  specialization: "backend",
  kind: "calc",
  title: "Нагрузка на шарды",
  skills: ["масштабирование"],
  b: 0.1,
  a: 1.1,
  params: (rng: Rng) => ({ s: rng.pick([3, 4, 5]), ids: intArray(rng, 14, 10, 99) }),
  twin: { key: "s", alt: (pp, rng) => ({ ...pp, s: other(rng, [3, 4, 5], pp.s) }) },
  statement: (pp, t) => [
    p("Пользователь попадает в шард номер ", c("user_id % S"), ", где S = ", t.v("s", pp.s), ". Пришли запросы от пользователей:"),
    { type: "code", text: pp.ids.join(", ") },
    p("Сколько запросов придётся на самый загруженный шард?"),
  ],
  answer: (pp) => {
    const cnt = new Array(pp.s).fill(0) as number[];
    for (const id of pp.ids) cnt[id % pp.s]!++;
    return Math.max(...cnt);
  },
  answerHint: "Целое число",
};

const availability: CalcTemplate<{ a: number[] }> = {
  id: "be-calc-availability",
  specialization: "backend",
  kind: "calc",
  title: "Доступность цепочки сервисов",
  skills: ["надёжность", "микросервисы"],
  b: 0.6,
  a: 1.2,
  params: (rng) => ({ a: rng.sample([99.9, 99.5, 99.95, 99.0, 99.8, 99.99], 3) }),
  twin: { key: "a.0", alt: (pp) => ({ a: [pp.a[0] === 99.0 ? 98.5 : 99.0, ...pp.a.slice(1)] }) },
  statement: (pp, t) => [
    p("Запрос пользователя последовательно проходит через три независимых сервиса с доступностью ", t.v("a.0", pp.a[0]! + "%"), ", ", t.v("a.1", pp.a[1]! + "%"), " и ", t.v("a.2", pp.a[2]! + "%"), "."),
    p("Какова итоговая доступность цепочки в процентах? Округлите до двух знаков после запятой."),
  ],
  answer: (pp) => Math.round(pp.a.reduce((s, x) => s * (x / 100), 1) * 10000) / 100,
  answerHint: "Число с двумя знаками после запятой, например 99.12",
  tolerance: 0.0051,
};

export const backendCalc = [pagination, errorRate, lruHits, shards, availability] as CalcTemplate[];
