import type { Rng } from "../../rng";
import type { CalcTemplate, CodeTemplate, QuizTemplate, SqlTemplate } from "../../types";
import { SHOP_SCHEMA, shopData } from "../backend/sql";
import { c, intArray, other, p, scenarioQuiz, sqlStr, WORDS } from "../util";

const QA = "qa" as const;
const BOTH = ["python", "javascript"] as const;

// ================================================================ code

const boundaries: CodeTemplate<{ step: number }> = {
  id: "qa-code-boundaries",
  specialization: QA,
  kind: "code",
  title: "Граничные значения",
  skills: ["тест-дизайн", "python"],
  b: -1.6,
  a: 1.0,
  languages: [...BOTH],
  params: (rng) => ({ step: rng.pick([1, 5, 10]) }),
  twin: { key: "step", alt: (pp, rng) => ({ step: other(rng, [1, 5, 10], pp.step) }) },
  statement: (pp, t) => [
    p("Поле принимает целые значения из отрезка [lo, hi] с шагом ", t.v("step", pp.step), " (допустимы lo, lo + step, …). Для анализа граничных значений нужны: lo − step, lo, lo + step, hi − step, hi, hi + step."),
    p("Напишите ", c("bva(lo, hi)"), ": верните эти значения без повторов, по возрастанию."),
  ],
  fn: { name: "bva", args: [{ name: "lo", type: "int" }, { name: "hi", type: "int" }], returns: "list[int]" },
  examples: (pp) => [[0, 100 * pp.step], [18, 18 + 2 * pp.step]],
  hidden: (pp, rng) => [[rng.int(-50, 0) * pp.step, rng.int(10, 90) * pp.step], [5 * pp.step, 6 * pp.step], [0, 0], [-100 * pp.step, 100 * pp.step]],
  solve: (pp, [lo, hi]) => {
    const l = lo as number, h = hi as number, s = pp.step;
    return [...new Set([l - s, l, l + s, h - s, h, h + s])].sort((a, b) => a - b);
  },
  reference: {
    python: (pp) => `def bva(lo, hi):\n    s = ${pp.step}\n    return sorted({lo - s, lo, lo + s, hi - s, hi, hi + s})\n`,
    javascript: (pp) => `function bva(lo, hi) {\n  const s = ${pp.step};\n  return [...new Set([lo - s, lo, lo + s, hi - s, hi, hi + s])].sort((a, b) => a - b);\n}\n`,
  },
};

const classes: CodeTemplate<{ adult: number; senior: number }> = {
  id: "qa-code-equivalence",
  specialization: QA,
  kind: "code",
  title: "Классы эквивалентности тарифа",
  skills: ["тест-дизайн"],
  b: -1.2,
  a: 1.0,
  languages: [...BOTH],
  params: (rng) => ({ adult: rng.pick([14, 16, 18]), senior: rng.pick([60, 65, 70]) }),
  twin: { key: "senior", alt: (pp, rng) => ({ ...pp, senior: other(rng, [60, 65, 70], pp.senior) }) },
  statement: (pp, t) => [
    p("Тариф по возрасту: меньше 0 или больше 120 — ", c('"invalid"'), "; от 0 до ", t.v("adult", pp.adult), " (не включая) — ", c('"child"'), "; от ", t.v("adult", pp.adult), " до ", t.v("senior", pp.senior), " (не включая) — ", c('"adult"'), "; от ", t.v("senior", pp.senior), " до 120 — ", c('"senior"'), "."),
    p("Напишите ", c("classify(ages)"), " — список классов для списка возрастов."),
  ],
  fn: { name: "classify", args: [{ name: "ages", type: "list[int]" }], returns: "list[str]" },
  examples: (pp) => [[[-1, 0, pp.adult - 1, pp.adult, pp.senior, 121]]],
  hidden: (pp, rng) => [[intArray(rng, 20, -10, 130)], [[pp.adult - 1, pp.adult, pp.senior - 1, pp.senior, 120, 121]], [[]], [intArray(rng, 100, -5, 125)]],
  solve: (pp, [ages]) => (ages as number[]).map((a) => (a < 0 || a > 120 ? "invalid" : a < pp.adult ? "child" : a < pp.senior ? "adult" : "senior")),
  reference: {
    python: (pp) => `def classify(ages):\n    def c(a):\n        if a < 0 or a > 120:\n            return "invalid"\n        if a < ${pp.adult}:\n            return "child"\n        if a < ${pp.senior}:\n            return "adult"\n        return "senior"\n    return [c(a) for a in ages]\n`,
    javascript: (pp) => `function classify(ages) {\n  return ages.map((a) => (a < 0 || a > 120 ? "invalid" : a < ${pp.adult} ? "child" : a < ${pp.senior} ? "adult" : "senior"));\n}\n`,
  },
};

const password: CodeTemplate<{ min: number; special: boolean }> = {
  id: "qa-code-password-rules",
  specialization: QA,
  kind: "code",
  title: "Оракул для проверки пароля",
  skills: ["тест-дизайн", "автотесты"],
  b: -0.5,
  a: 1.1,
  languages: [...BOTH],
  params: (rng) => ({ min: rng.pick([8, 10, 12]), special: rng.bool() }),
  twin: { key: "min", alt: (pp, rng) => ({ ...pp, min: other(rng, [8, 10, 12], pp.min) }) },
  statement: (pp, t) => [
    p("Чтобы проверять форму регистрации автотестами, нужен оракул. Пароль валиден, если: длина не меньше ", t.v("min", pp.min), "; есть хотя бы одна цифра; есть латинская буква в верхнем и в нижнем регистре", pp.special ? "; есть хотя бы один символ из !@#$%" : "", "."),
    p("Напишите ", c("valid(pwds)"), " — список булевых значений."),
  ],
  fn: { name: "valid", args: [{ name: "pwds", type: "list[str]" }], returns: "list[bool]" },
  examples: () => [[["Qwerty123!", "short1A", "alllowercase1!"]]],
  hidden: (_pp, rng) => {
    const chars = "abcxyzABCXYZ0123456789!@#$%";
    const gen = () => Array.from({ length: rng.int(4, 16) }, () => chars[rng.int(0, chars.length - 1)]).join("");
    return [[Array.from({ length: 20 }, gen)], [["", "Aa1!Aa1!Aa1!", "AAAAAAAAAAAA1!", "aaaaaaaaaaaa1!"]], [Array.from({ length: 60 }, gen)]];
  },
  solve: (pp, [pwds]) =>
    (pwds as string[]).map((s) => s.length >= pp.min && /\d/.test(s) && /[A-Z]/.test(s) && /[a-z]/.test(s) && (!pp.special || /[!@#$%]/.test(s))),
  reference: {
    python: (pp) => `import re\n\ndef valid(pwds):\n    def ok(s):\n        return (len(s) >= ${pp.min} and re.search(r"\\d", s) is not None and re.search(r"[A-Z]", s) is not None\n                and re.search(r"[a-z]", s) is not None${pp.special ? ` and re.search(r"[!@#$%]", s) is not None` : ""})\n    return [ok(s) for s in pwds]\n`,
    javascript: (pp) => `function valid(pwds) {\n  return pwds.map((s) => s.length >= ${pp.min} && /\\d/.test(s) && /[A-Z]/.test(s) && /[a-z]/.test(s)${pp.special ? " && /[!@#$%]/.test(s)" : ""});\n}\n`,
  },
};

const decisionTable: CodeTemplate<{ x: number }> = {
  id: "qa-code-decision-table",
  specialization: QA,
  kind: "code",
  title: "Полная таблица решений",
  skills: ["тест-дизайн"],
  b: -0.1,
  a: 1.1,
  languages: [...BOTH],
  params: (rng) => ({ x: rng.int(0, 9) }),
  statement: () => [
    p("Даны названия булевых условий. Напишите ", c("table(conds)"), ": верните все комбинации значений как список объектов ", c("{условие: bool}"), " в порядке двоичного счёта, где первое условие — старший разряд, а false идёт раньше true."),
  ],
  fn: { name: "table", args: [{ name: "conds", type: "list[str]" }], returns: "list[dict]" },
  examples: (_pp, rng) => [[rng.sample(["vip", "promo", "firstOrder"], 2)]],
  hidden: (_pp, rng) => [[rng.sample(WORDS, 3)], [rng.sample(WORDS, 4)], [[]], [rng.sample(WORDS, 1)]],
  solve: (_pp, [conds]) => {
    const cs = conds as string[];
    return Array.from({ length: 2 ** cs.length }, (_, m) => Object.fromEntries(cs.map((k, i) => [k, Boolean((m >> (cs.length - 1 - i)) & 1)])));
  },
  reference: {
    python: () => `from itertools import product\n\ndef table(conds):\n    return [dict(zip(conds, vals)) for vals in product([False, True], repeat=len(conds))]\n`,
    javascript: () => `function table(conds) {\n  const n = conds.length;\n  return Array.from({ length: 2 ** n }, (_, m) => Object.fromEntries(conds.map((k, i) => [k, Boolean((m >> (n - 1 - i)) & 1)])));\n}\n`,
  },
};

const logTop: CodeTemplate<{ level: string }> = {
  id: "qa-code-log-errors",
  specialization: QA,
  kind: "code",
  title: "Разбор логов прогона",
  skills: ["автотесты", "логи"],
  b: -0.8,
  a: 1.0,
  languages: [...BOTH],
  params: (rng) => ({ level: rng.pick(["ERROR", "WARN"]) }),
  statement: (pp) => [
    p("Строки лога: ", c("2026-03-01T10:00:00 LEVEL module: message"), ". Напишите ", c("counts(lines)"), ": для уровня ", c(pp.level), " верните объект «модуль → число строк». Строки другого формата пропускайте."),
  ],
  fn: { name: "counts", args: [{ name: "lines", type: "list[str]" }], returns: "dict" },
  examples: (_pp, rng) => [[genLog(rng, 6)]],
  hidden: (_pp, rng) => [[genLog(rng, 20)], [genLog(rng, 100)], [[]], [["garbage", ...genLog(rng, 5)]]],
  solve: (pp, [lines]) => {
    const out: Record<string, number> = {};
    for (const l of lines as string[]) {
      const m = /^\S+ (\w+) ([\w.-]+): /.exec(l);
      if (m && m[1] === pp.level) out[m[2]!] = (out[m[2]!] ?? 0) + 1;
    }
    return out;
  },
  reference: {
    python: (pp) => `import re\n\ndef counts(lines):\n    out = {}\n    for l in lines:\n        m = re.match(r"^\\S+ (\\w+) ([\\w.-]+): ", l)\n        if m and m.group(1) == "${pp.level}":\n            out[m.group(2)] = out.get(m.group(2), 0) + 1\n    return out\n`,
    javascript: (pp) => `function counts(lines) {\n  const out = {};\n  for (const l of lines) {\n    const m = /^\\S+ (\\w+) ([\\w.-]+): /.exec(l);\n    if (m && m[1] === "${pp.level}") out[m[2]] = (out[m[2]] || 0) + 1;\n  }\n  return out;\n}\n`,
  },
};

function genLog(rng: Rng, n: number) {
  return Array.from({ length: n }, () => `2026-03-0${rng.int(1, 9)}T10:${rng.int(10, 59)}:00 ${rng.pick(["INFO", "WARN", "ERROR", "DEBUG"])} ${rng.pick(["auth", "cart", "payment", "search"])}: ${rng.pick(WORDS)} ${rng.pick(WORDS)}`);
}

const flaky: CodeTemplate<{ min: number }> = {
  id: "qa-code-flaky-tests",
  specialization: QA,
  kind: "code",
  title: "Нестабильные тесты",
  skills: ["автотесты", "ci"],
  b: 0.6,
  a: 1.2,
  languages: [...BOTH],
  params: (rng) => ({ min: rng.int(2, 3) }),
  twin: { key: "min", alt: (pp) => ({ min: pp.min === 2 ? 3 : 2 }) },
  statement: (pp, t) => [
    p("История прогонов — список ", c("[test, status]"), ", где status — \"pass\" или \"fail\", по одному коммиту. Тест считается flaky, если у него есть и pass, и fail, и всего запусков не меньше ", t.v("min", pp.min), "."),
    p("Напишите ", c("flaky(runs)"), " — имена flaky-тестов по убыванию доли падений, при равенстве — по имени."),
  ],
  fn: { name: "flaky", args: [{ name: "runs", type: "list[list[str]]" }], returns: "list[str]" },
  examples: (_pp, rng) => [[genRuns(rng, 10)]],
  hidden: (_pp, rng) => [[genRuns(rng, 20)], [genRuns(rng, 80)], [[]], [[["t1", "pass"], ["t1", "fail"]]]],
  solve: (pp, [runs]) => {
    const m = new Map<string, { p: number; f: number }>();
    for (const [n, s] of runs as [string, string][]) {
      const x = m.get(n) ?? { p: 0, f: 0 };
      if (s === "pass") x.p++;
      else x.f++;
      m.set(n, x);
    }
    return [...m]
      .filter(([, x]) => x.p > 0 && x.f > 0 && x.p + x.f >= pp.min)
      .map(([n, x]) => ({ n, r: x.f / (x.p + x.f) }))
      .sort((a, b) => b.r - a.r || (a.n < b.n ? -1 : 1))
      .map((x) => x.n);
  },
  reference: {
    python: (pp) =>
      `def flaky(runs):\n    st = {}\n    for n, s in runs:\n        p, f = st.get(n, (0, 0))\n        st[n] = (p + (s == "pass"), f + (s != "pass"))\n    res = [(-f / (p + f), n) for n, (p, f) in st.items() if p and f and p + f >= ${pp.min}]\n    return [n for _, n in sorted(res)]\n`,
    javascript: (pp) =>
      `function flaky(runs) {\n  const m = new Map();\n  for (const [n, s] of runs) {\n    const x = m.get(n) || { p: 0, f: 0 };\n    if (s === "pass") x.p++; else x.f++;\n    m.set(n, x);\n  }\n  return [...m].filter(([, x]) => x.p && x.f && x.p + x.f >= ${pp.min}).map(([n, x]) => ({ n, r: x.f / (x.p + x.f) }))\n    .sort((a, b) => b.r - a.r || (a.n < b.n ? -1 : 1)).map((x) => x.n);\n}\n`,
  },
};

function genRuns(rng: Rng, n: number) {
  const tests = Array.from({ length: 6 }, (_, i) => `test_${rng.pick(WORDS)}_${i}`);
  return Array.from({ length: n }, () => [rng.pick(tests), rng.bool(0.75) ? "pass" : "fail"]);
}

const jsonDiff: CodeTemplate<{ x: number }> = {
  id: "qa-code-response-diff",
  specialization: QA,
  kind: "code",
  title: "Сравнение ответов API",
  skills: ["api", "автотесты"],
  b: 1.0,
  a: 1.2,
  languages: [...BOTH],
  params: (rng) => ({ x: rng.int(0, 9) }),
  statement: () => [
    p("Регрессионный тест сравнивает ответ API с эталоном. Оба — плоские объекты (значения: строки, числа, булевы, null). Напишите ", c("diff(expected, actual)"), ": верните список строк вида ", c('"+key"'), " (ключ появился), ", c('"-key"'), " (ключ пропал), ", c('"~key"'), " (значение изменилось; 1 и \"1\" — разные значения), отсортированный по имени ключа."),
  ],
  fn: { name: "diff", args: [{ name: "expected", type: "dict" }, { name: "actual", type: "dict" }], returns: "list[str]" },
  examples: (_pp, rng) => [[{ id: 1, name: "x", ok: true }, { id: 1, name: rng.pick(["y", "x"]), extra: null }]],
  hidden: (_pp, rng) => {
    const gen = () => Object.fromEntries(rng.sample(["id", "name", "price", "ok", "tags", "city", "qty"], rng.int(2, 6)).map((k) => [k, rng.pick([1, 2, "1", "a", true, false, null])]));
    return [[gen(), gen()], [gen(), gen()], [{}, {}], [gen(), {}], [{ a: 1 }, { a: "1" }]];
  },
  solve: (_pp, [e, a]) => {
    const E = e as Record<string, unknown>, A = a as Record<string, unknown>;
    const keys = [...new Set([...Object.keys(E), ...Object.keys(A)])].sort();
    const out: string[] = [];
    for (const k of keys) {
      if (!(k in E)) out.push(`+${k}`);
      else if (!(k in A)) out.push(`-${k}`);
      else if (E[k] !== A[k]) out.push(`~${k}`);
    }
    return out;
  },
  reference: {
    python: () =>
      `def diff(expected, actual):\n    out = []\n    for k in sorted(set(expected) | set(actual)):\n        if k not in expected:\n            out.append("+" + k)\n        elif k not in actual:\n            out.append("-" + k)\n        elif type(expected[k]) != type(actual[k]) or expected[k] != actual[k]:\n            out.append("~" + k)\n    return out\n`,
    javascript: () =>
      `function diff(expected, actual) {\n  const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort();\n  const out = [];\n  for (const k of keys) {\n    if (!(k in expected)) out.push("+" + k);\n    else if (!(k in actual)) out.push("-" + k);\n    else if (expected[k] !== actual[k]) out.push("~" + k);\n  }\n  return out;\n}\n`,
  },
};

const waitFor: CodeTemplate<{ timeout: number; poll: number }> = {
  id: "qa-code-wait-for",
  specialization: QA,
  kind: "code",
  title: "Ожидание условия в автотесте",
  skills: ["автотесты"],
  b: 1.6,
  a: 1.2,
  languages: [...BOTH],
  params: (rng) => ({ timeout: rng.pick([3000, 5000, 10000]), poll: rng.pick([250, 500, 1000]) }),
  twin: { key: "timeout", alt: (pp, rng) => ({ ...pp, timeout: other(rng, [3000, 5000, 10000], pp.timeout) }) },
  statement: (pp, t) => [
    p("Хелпер waitFor проверяет условие в моменты 0, ", t.v("poll", pp.poll), ", 2·", t.v("poll", pp.poll), "… мс, пока момент проверки не превышает таймаут ", t.v("timeout", pp.timeout), " мс. Условие становится истинным в момент ready (мс) и остаётся таким."),
    p("Напишите ", c("when(readyList)"), ": для каждого ready верните момент первой успешной проверки или -1, если до таймаута условие не выполнилось."),
  ],
  fn: { name: "when", args: [{ name: "readyList", type: "list[int]" }], returns: "list[int]" },
  examples: (pp) => [[[0, pp.poll + 1, pp.timeout + 1]]],
  hidden: (pp, rng) => [[intArray(rng, 20, 0, pp.timeout * 1.5)], [[pp.timeout, pp.timeout - 1, 1]], [[]], [intArray(rng, 60, 0, 12000)]],
  solve: (pp, [ready]) =>
    (ready as number[]).map((r) => {
      const t = Math.ceil(r / pp.poll) * pp.poll;
      return t <= pp.timeout ? t : -1;
    }),
  reference: {
    python: (pp) => `def when(readyList):\n    out = []\n    for r in readyList:\n        t = -(-r // ${pp.poll}) * ${pp.poll}\n        out.append(t if t <= ${pp.timeout} else -1)\n    return out\n`,
    javascript: (pp) => `function when(readyList) {\n  return readyList.map((r) => { const t = Math.ceil(r / ${pp.poll}) * ${pp.poll}; return t <= ${pp.timeout} ? t : -1; });\n}\n`,
  },
};

// ================================================================ SQL (data quality checks)

const sqlBase = { specialization: QA, kind: "sql" as const, schema: SHOP_SCHEMA, data: (_pp: unknown, rng: Rng, size: "public" | "hidden") => brokenShop(rng, size), ordered: true };

/** Shop data with injected data-quality defects (QA tasks look for them). */
function brokenShop(rng: Rng, size: "public" | "hidden") {
  const base = shopData(rng, size);
  const extra: string[] = [];
  const k = size === "public" ? 3 : rng.int(4, 10);
  for (let i = 0; i < k; i++) {
    const id = 10000 + i;
    const kind = rng.int(0, 3);
    if (kind === 0) extra.push(`INSERT INTO orders VALUES (${id}, ${900 + rng.int(1, 50)}, ${rng.int(1, 30) * 100}, 'paid', '2025-05-0${rng.int(1, 9)}');`);
    if (kind === 1) extra.push(`INSERT INTO orders VALUES (${id}, 1, ${-rng.int(0, 30) * 100}, 'paid', '2025-05-0${rng.int(1, 9)}');`);
    if (kind === 2) extra.push(`INSERT INTO orders VALUES (${id}, 1, 500, ${sqlStr(rng.pick(["PAID", "done", "unknown"]))}, '2025-05-0${rng.int(1, 9)}');`);
    if (kind === 3) extra.push(`INSERT INTO users VALUES (${id}, 'Дубль ${i}', 'Москва', '2024-01-01'), (${id + 100}, 'Дубль ${i}', 'Москва', '2024-01-01');`);
  }
  return `${base}\n${extra.join("\n")}`;
}

const orphans: SqlTemplate<{ x: number }> = {
  ...sqlBase,
  id: "qa-sql-orphan-orders",
  title: "Заказы без пользователя",
  skills: ["sql", "качество данных"],
  b: -0.9,
  a: 1.1,
  params: (rng) => ({ x: rng.int(0, 9) }),
  statement: () => [p("После миграции появились заказы, ссылающиеся на несуществующих пользователей. Найдите их: столбцы ", c("id"), ", ", c("user_id"), "; сортировка по id.")],
  reference: () => `SELECT o.id, o.user_id FROM orders o LEFT JOIN users u ON u.id = o.user_id WHERE u.id IS NULL ORDER BY o.id`,
};

const badAmounts: SqlTemplate<{ x: number }> = {
  ...sqlBase,
  id: "qa-sql-invalid-amount",
  title: "Некорректные суммы",
  skills: ["sql", "качество данных"],
  b: -1.9,
  a: 0.9,
  params: (rng) => ({ x: rng.int(0, 9) }),
  statement: () => [p("Найдите оплаченные заказы (status = 'paid') с суммой не больше нуля. Столбцы: ", c("id"), ", ", c("amount"), "; сортировка по id.")],
  reference: () => `SELECT id, amount FROM orders WHERE status = 'paid' AND amount <= 0 ORDER BY id`,
};

const badStatus: SqlTemplate<{ allowed: string[] }> = {
  ...sqlBase,
  id: "qa-sql-invalid-status",
  title: "Недопустимые статусы",
  skills: ["sql", "качество данных"],
  b: 0.2,
  a: 1.1,
  params: (rng) => ({ allowed: ["paid", "new", "cancelled", "refunded"].filter((_, i) => i < 2 || rng.bool(0.8)) }),
  statement: (pp) => [p("Допустимые статусы заказа: ", ...pp.allowed.flatMap((s, i) => (i ? [", ", c(`'${s}'`)] : [c(`'${s}'`)])), " (с учётом регистра). Посчитайте заказы с любым другим статусом по каждому такому статусу: столбцы ", c("status"), ", ", c("cnt"), "; сортировка по status.")],
  reference: (pp) => `SELECT status, COUNT(*) AS cnt FROM orders WHERE status NOT IN (${pp.allowed.map((s) => `'${s}'`).join(", ")}) GROUP BY status ORDER BY status`,
};

const dupUsers: SqlTemplate<{ x: number }> = {
  ...sqlBase,
  id: "qa-sql-duplicate-users",
  title: "Дубли пользователей",
  skills: ["sql", "качество данных"],
  b: 1.3,
  a: 1.2,
  params: (rng) => ({ x: rng.int(0, 9) }),
  statement: () => [p("Дублем считаются пользователи с одинаковыми name и city. Для каждой группы дублей верните ", c("name"), ", ", c("city"), ", ", c("cnt"), " (число записей) и ", c("min_id"), " (наименьший id); сортировка по min_id.")],
  reference: () => `SELECT name, city, COUNT(*) AS cnt, MIN(id) AS min_id FROM users GROUP BY name, city HAVING COUNT(*) > 1 ORDER BY min_id`,
};

// ================================================================ calc

const decisionRows: CalcTemplate<{ n: number; m: number }> = {
  id: "qa-calc-decision-table",
  specialization: QA,
  kind: "calc",
  title: "Размер таблицы решений",
  skills: ["тест-дизайн"],
  b: -1.4,
  a: 1.0,
  params: (rng) => ({ n: rng.int(2, 4), m: rng.int(2, 3) }),
  twin: { key: "n", alt: (pp) => ({ ...pp, n: pp.n === 4 ? 3 : pp.n + 1 }) },
  statement: (pp, t) => [p("Логика скидки зависит от ", t.v("n", pp.n), " булевых условий и одного параметра «тип клиента» с ", t.v("m", pp.m), " значениями. Сколько столбцов (правил) в полной таблице решений?")],
  answer: (pp) => 2 ** pp.n * pp.m,
  answerHint: "Целое число",
};

const bvaCount: CalcTemplate<{ fields: number }> = {
  id: "qa-calc-bva-count",
  specialization: QA,
  kind: "calc",
  title: "Число граничных тестов",
  skills: ["тест-дизайн"],
  b: -0.7,
  a: 1.0,
  params: (rng) => ({ fields: rng.int(2, 5) }),
  twin: { key: "fields", alt: (pp) => ({ fields: pp.fields + 1 }) },
  statement: (pp, t) => [
    p("В форме ", t.v("fields", pp.fields), " независимых числовых полей с диапазонами [min, max]. Для каждого поля проверяем трёхточечные границы: min−1, min, min+1, max−1, max, max+1. Тесты по полям не комбинируются (остальные поля — валидные значения), а один общий «всё валидно» тест покрывает min+1 всех полей одновременно."),
    p("Сколько уникальных тест-кейсов нужно?"),
  ],
  answer: (pp) => pp.fields * 5 + 1,
  answerHint: "Целое число",
};

const defectDensity: CalcTemplate<{ defects: number; kloc: number }> = {
  id: "qa-calc-defect-density",
  specialization: QA,
  kind: "calc",
  title: "Плотность дефектов",
  skills: ["метрики качества"],
  b: -2.0,
  a: 0.9,
  params: (rng) => ({ defects: rng.int(12, 90), kloc: rng.pick([15, 24, 40, 60]) }),
  twin: { key: "kloc", alt: (pp, rng) => ({ ...pp, kloc: other(rng, [15, 24, 40, 60], pp.kloc) }) },
  statement: (pp, t) => [p("В релизе нашли ", t.v("defects", pp.defects), " дефектов, объём изменённого кода — ", t.v("kloc", pp.kloc), " тыс. строк. Какова плотность дефектов на 1000 строк? Округлите до двух знаков.")],
  answer: (pp) => Math.round((pp.defects / pp.kloc) * 100) / 100,
  answerHint: "Число с двумя знаками",
  tolerance: 0.011,
};

const dre: CalcTemplate<{ before: number; after: number }> = {
  id: "qa-calc-dre",
  specialization: QA,
  kind: "calc",
  title: "Эффективность устранения дефектов",
  skills: ["метрики качества"],
  b: 0.4,
  a: 1.1,
  params: (rng) => ({ before: rng.int(60, 200), after: rng.int(3, 30) }),
  twin: { key: "after", alt: (pp) => ({ ...pp, after: pp.after + 11 }) },
  statement: (pp, t) => [p("До релиза команда нашла ", t.v("before", pp.before), " дефектов, после релиза пользователи сообщили ещё о ", t.v("after", pp.after), ". Чему равна DRE (Defect Removal Efficiency) в процентах? Округлите до одного знака.")],
  answer: (pp) => Math.round((pp.before / (pp.before + pp.after)) * 1000) / 10,
  answerHint: "Проценты с одним знаком",
  tolerance: 0.11,
};

const passRate: CalcTemplate<{ total: number; failed: number; skipped: number }> = {
  id: "qa-calc-pass-rate",
  specialization: QA,
  kind: "calc",
  title: "Pass rate прогона",
  skills: ["автотесты", "метрики качества"],
  b: -1.0,
  a: 1.0,
  params: (rng) => ({ total: rng.pick([240, 400, 520, 800]), failed: rng.int(3, 30), skipped: rng.int(5, 40) }),
  twin: { key: "skipped", alt: (pp) => ({ ...pp, skipped: pp.skipped + 25 }) },
  statement: (pp, t) => [p("В прогоне ", t.v("total", pp.total), " тестов: ", t.v("failed", pp.failed), " упали, ", t.v("skipped", pp.skipped), " пропущены, остальные прошли. Pass rate считается от выполненных (не пропущенных) тестов. Какой он в процентах? Округлите до одного знака.")],
  answer: (pp) => Math.round(((pp.total - pp.failed - pp.skipped) / (pp.total - pp.skipped)) * 1000) / 10,
  answerHint: "Проценты с одним знаком",
  tolerance: 0.11,
};

const pairwise: CalcTemplate<{ v: number }> = {
  id: "qa-calc-pairwise",
  specialization: QA,
  kind: "calc",
  title: "Нижняя граница pairwise",
  skills: ["тест-дизайн"],
  b: 1.9,
  a: 1.1,
  params: (rng) => ({ v: rng.int(3, 5) }),
  twin: { key: "v", alt: (pp) => ({ v: pp.v === 5 ? 4 : pp.v + 1 }) },
  statement: (pp, t) => [p("Конфигурация: два параметра по ", t.v("v", pp.v), " значений и ещё три параметра по 2 значения. Каково минимально возможное число тестов, покрывающих все пары значений (нижняя граница по двум самым «широким» параметрам)?")],
  answer: (pp) => pp.v * pp.v,
  answerHint: "Целое число",
};

const regressionTime: CalcTemplate<{ cases: number; minutes: number; workers: number }> = {
  id: "qa-calc-parallel-run",
  specialization: QA,
  kind: "calc",
  title: "Время параллельного прогона",
  skills: ["автотесты", "ci"],
  b: 1.1,
  a: 1.1,
  params: (rng) => ({ cases: rng.pick([120, 300, 450, 640]), minutes: rng.pick([2, 3, 4]), workers: rng.pick([4, 6, 8]) }),
  twin: { key: "workers", alt: (pp, rng) => ({ ...pp, workers: other(rng, [4, 6, 8], pp.workers) }) },
  statement: (pp, t) => [p(t.v("cases", pp.cases), " UI-тестов по ", t.v("minutes", pp.minutes), " минуты каждый запускаются на ", t.v("workers", pp.workers), " воркерах; тесты делятся поровну (воркер берёт целое число тестов), плюс 5 минут на сборку окружения до старта. Сколько минут займёт прогон?")],
  answer: (pp) => Math.ceil(pp.cases / pp.workers) * pp.minutes + 5,
  answerHint: "Целое число минут",
};

// ================================================================ quiz

const severity = scenarioQuiz({
  id: "qa-quiz-severity-priority",
  specialization: QA,
  title: "Серьёзность и приоритет",
  skills: ["тест-менеджмент"],
  b: -0.4,
  a: 1.0,
  question: "Как оценить дефект?",
  scenarios: [
    { s: "Опечатка в названии компании на главной странице за день до запуска рекламы", a: "Низкая серьёзность, высокий приоритет" },
    { s: "Падение приложения при экспорте отчёта в редком формате, которым пользуется 0.1%", a: "Высокая серьёзность, низкий приоритет" },
    { s: "Оплата не проходит у всех пользователей", a: "Высокая серьёзность, высокий приоритет" },
    { s: "Выравнивание иконки сбито на 2px во внутренней админке", a: "Низкая серьёзность, низкий приоритет" },
  ],
});

const testTypes = scenarioQuiz({
  id: "qa-quiz-test-types",
  specialization: QA,
  title: "Виды тестирования",
  skills: ["тест-менеджмент"],
  b: -1.9,
  a: 0.9,
  question: "Какой вид тестирования описан?",
  scenarios: [
    { s: "Быстрая проверка, что после деплоя открывается главная, работают логин и оплата", a: "Smoke" },
    { s: "Повторный прогон старых тестов после исправления бага в соседнем модуле", a: "Регрессионное" },
    { s: "Проверка, что исправленный дефект действительно больше не воспроизводится", a: "Ретест (подтверждающее)" },
    { s: "Сервис держит 2000 RPS 30 минут без роста задержек", a: "Нагрузочное" },
    { s: "Пользователь с ролью «читатель» не может удалить документ", a: "Тестирование безопасности (авторизация)" },
  ],
});

const techniques = scenarioQuiz({
  id: "qa-quiz-techniques",
  specialization: QA,
  title: "Техники тест-дизайна",
  skills: ["тест-дизайн"],
  b: 0.8,
  a: 1.1,
  question: "Какая техника тест-дизайна подходит лучше всего?",
  scenarios: [
    { s: "Скидка зависит от сочетания: новый клиент, промокод, сумма заказа больше 5000", a: "Таблица решений" },
    { s: "Заказ проходит статусы: создан → оплачен → отгружен → доставлен, возможна отмена", a: "Тестирование переходов состояний" },
    { s: "Поле «возраст» принимает 18–65", a: "Граничные значения и классы эквивалентности" },
    { s: "Веб-приложение в 4 браузерах, 3 ОС, 2 языках и 2 темах — полный перебор слишком дорог", a: "Попарное тестирование (pairwise)" },
  ],
});

const apiNegative = scenarioQuiz({
  id: "qa-quiz-api-negative",
  specialization: QA,
  title: "Негативные проверки API",
  skills: ["api", "http"],
  b: -1.2,
  a: 1.0,
  question: "Какой ответ API ожидается в этой негативной проверке?",
  scenarios: [
    { s: "POST без обязательного поля в теле запроса", a: "400 или 422 с описанием поля" },
    { s: "Запрос без токена к защищённому ресурсу", a: "401" },
    { s: "Запрос к чужому заказу с валидным токеном", a: "403 или 404 (без раскрытия существования)" },
    { s: "Повторная отмена уже отменённого заказа", a: "409" },
  ],
});

const pyramid = scenarioQuiz({
  id: "qa-quiz-test-pyramid",
  specialization: QA,
  title: "Пирамида тестирования",
  skills: ["автотесты", "архитектура"],
  b: 1.5,
  a: 1.0,
  question: "Где в пирамиде тестирования лучше проверить это поведение?",
  scenarios: [
    { s: "Функция расчёта налога при разных ставках и округлениях", a: "Юнит-тесты" },
    { s: "Сервис корректно сохраняет заказ в PostgreSQL и публикует событие в Kafka", a: "Интеграционные тесты" },
    { s: "Пользователь проходит путь от регистрации до оплаты в браузере", a: "Небольшое число E2E-тестов" },
    { s: "Сервис-потребитель и сервис-поставщик согласуют формат ответа API", a: "Контрактные тесты" },
  ],
});

const flakyCause = scenarioQuiz({
  id: "qa-quiz-flaky-causes",
  specialization: QA,
  title: "Причины нестабильных тестов",
  skills: ["автотесты"],
  b: 2.1,
  a: 1.0,
  question: "Какая наиболее вероятная причина нестабильности и что сделать?",
  scenarios: [
    { s: "UI-тест иногда падает, потому что кликает по кнопке до окончания анимации", a: "Неявные ожидания: ждать состояния элемента, а не sleep" },
    { s: "Тесты проходят по отдельности, но падают при параллельном запуске", a: "Общие данные между тестами: изолировать тестовые данные" },
    { s: "Тест падает только около полуночи", a: "Зависимость от текущего времени: фиксировать часы в тесте" },
    { s: "Тест падает, когда внешний платёжный sandbox отвечает медленно", a: "Внешняя зависимость: заглушка или контрактный мок" },
  ],
});

export const qaBank = [
  boundaries, classes, password, decisionTable, logTop, flaky, jsonDiff, waitFor,
  orphans, badAmounts, badStatus, dupUsers,
  decisionRows, bvaCount, defectDensity, dre, passRate, pairwise, regressionTime,
  severity, testTypes, techniques, apiNegative, pyramid, flakyCause,
] as (CodeTemplate | SqlTemplate | CalcTemplate | QuizTemplate)[];
