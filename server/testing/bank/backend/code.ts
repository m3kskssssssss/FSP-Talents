import type { Rng } from "../../rng";
import type { CodeTemplate } from "../../types";
import { c, intArray, other, p, PATHS, SERVICE_NAMES, WORDS } from "../util";

// ---------------------------------------------------------------- 1. sum of multiples

const sumMultiples: CodeTemplate<{ k: number }> = {
  id: "be-code-sum-multiples",
  specialization: "backend",
  kind: "code",
  title: "Сумма кратных идентификаторов",
  skills: ["алгоритмы"],
  b: -2.0,
  a: 1.0,
  languages: ["python", "javascript"],
  params: (rng) => ({ k: rng.pick([3, 4, 5, 7]) }),
  twin: { key: "k", alt: (pp, rng) => ({ k: other(rng, [3, 4, 5, 7], pp.k) }) },
  statement: (pp, t) => [
    p("Сервис получает пачку идентификаторов заказов. Для отчёта нужна сумма тех идентификаторов, которые делятся на ", t.v("k", pp.k), " без остатка."),
    p("Напишите функцию ", c("sum_multiples(nums)"), ", которая возвращает эту сумму. Числа могут быть отрицательными; для пустого списка ответ 0."),
  ],
  fn: { name: "sum_multiples", args: [{ name: "nums", type: "list[int]" }], returns: "int" },
  examples: (_pp, rng) => [[intArray(rng, 6, 1, 40)], [[]], [intArray(rng, 5, -20, 20)]],
  hidden: (_pp, rng) => [
    ...Array.from({ length: 6 }, () => [intArray(rng, rng.int(1, 40), -100, 100)]),
    [[0, 0, 0]],
    [intArray(rng, 200, -1000, 1000)],
  ],
  solve: (pp, [nums]) => (nums as number[]).filter((x) => x % pp.k === 0).reduce((s, x) => s + x, 0),
  reference: {
    python: (pp) => `def sum_multiples(nums):\n    return sum(x for x in nums if x % ${pp.k} == 0)\n`,
    javascript: (pp) => `function sum_multiples(nums) {\n  return nums.filter((x) => x % ${pp.k} === 0).reduce((s, x) => s + x, 0);\n}\n`,
  },
};

// ---------------------------------------------------------------- 2. backoff delays

type Backoff = { base: number; factor: number; cap: number };
const backoff: CodeTemplate<Backoff> = {
  id: "be-code-backoff",
  specialization: "backend",
  kind: "code",
  title: "Экспоненциальная задержка повторов",
  skills: ["надёжность", "http"],
  b: -1.4,
  a: 1.1,
  languages: ["python", "javascript"],
  params: (rng) => ({ base: rng.pick([100, 200, 250, 300]), factor: rng.pick([2, 3]), cap: rng.pick([2000, 3000, 5000, 8000]) }),
  twin: { key: "cap", alt: (pp, rng) => ({ ...pp, cap: other(rng, [2000, 3000, 5000, 8000], pp.cap) }) },
  statement: (pp, t) => [
    p("HTTP-клиент повторяет неудачные запросы с экспоненциальной задержкой: перед первой повторной попыткой ждёт ", t.v("base", pp.base), " мс, перед каждой следующей — в ", t.v("factor", pp.factor), " раза дольше, но не больше ", t.v("cap", pp.cap), " мс."),
    p("Напишите ", c("backoff_delays(n)"), " — список задержек (в мс, целые числа) для n повторных попыток. Для n = 0 — пустой список."),
  ],
  fn: { name: "backoff_delays", args: [{ name: "n", type: "int" }], returns: "list[int]" },
  examples: () => [[1], [4], [0]],
  hidden: (_pp, rng) => [[2], [3], [rng.int(5, 8)], [rng.int(9, 12)], [15], [1]],
  solve: (pp, [n]) => Array.from({ length: n as number }, (_, i) => Math.min(pp.cap, pp.base * pp.factor ** i)),
  reference: {
    python: (pp) => `def backoff_delays(n):\n    return [min(${pp.cap}, ${pp.base} * ${pp.factor} ** i) for i in range(n)]\n`,
    javascript: (pp) => `function backoff_delays(n) {\n  const out = [];\n  for (let i = 0; i < n; i++) out.push(Math.min(${pp.cap}, ${pp.base} * ${pp.factor} ** i));\n  return out;\n}\n`,
  },
};

// ---------------------------------------------------------------- 3. balanced brackets

const ALL_PAIRS = ["()", "[]", "{}", "<>"];
const brackets: CodeTemplate<{ pairs: string[] }> = {
  id: "be-code-brackets",
  specialization: "backend",
  kind: "code",
  title: "Проверка скобок в шаблоне",
  skills: ["алгоритмы", "структуры данных"],
  b: -0.8,
  a: 1.2,
  languages: ["python", "javascript"],
  params: (rng) => ({ pairs: rng.sample(ALL_PAIRS, rng.int(2, 3)).sort() }),
  statement: (pp) => [
    p("Шаблонизатор принимает строку, в которой используются скобки ", ...pp.pairs.flatMap((x, i) => (i ? [", ", c(x)] : [c(x)])), ". Остальные символы (включая другие виды скобок) не важны."),
    p("Напишите ", c("is_balanced(s)"), ": True/true, если все указанные скобки корректно вложены и закрыты, иначе False/false."),
  ],
  fn: { name: "is_balanced", args: [{ name: "s", type: "str" }], returns: "bool" },
  examples: (pp) => {
    const [a, b] = [pp.pairs[0]!, pp.pairs[1]!];
    return [[`${a[0]}x${b[0]}y${b[1]}${a[1]}`], [`${a[0]}${b[0]}${a[1]}${b[1]}`], ["abc"]];
  },
  hidden: (pp, rng) => {
    const chars = pp.pairs.join("") + "xy ";
    const randStr = () => Array.from({ length: rng.int(0, 16) }, () => rng.pick(chars.split(""))).join("");
    const nested = () => {
      let s = "";
      for (let i = 0; i < rng.int(1, 6); i++) {
        const pr = rng.pick(pp.pairs);
        s = pr[0] + s + pr[1];
      }
      return s;
    };
    return [[nested()], [nested() + nested()], [randStr()], [randStr()], [randStr()], [""], [nested().slice(1)], ["))" + nested()]];
  },
  solve: (pp, [s]) => {
    const open = new Map(pp.pairs.map((x) => [x[1]!, x[0]!]));
    const opens = new Set(pp.pairs.map((x) => x[0]!));
    const st: string[] = [];
    for (const ch of s as string) {
      if (opens.has(ch)) st.push(ch);
      else if (open.has(ch)) {
        if (st.pop() !== open.get(ch)) return false;
      }
    }
    return st.length === 0;
  },
  reference: {
    python: (pp) =>
      `def is_balanced(s):\n    pairs = {${pp.pairs.map((x) => `'${x[1]}': '${x[0]}'`).join(", ")}}\n    opens = set(pairs.values())\n    st = []\n    for ch in s:\n        if ch in opens:\n            st.append(ch)\n        elif ch in pairs:\n            if not st or st.pop() != pairs[ch]:\n                return False\n    return not st\n`,
    javascript: (pp) =>
      `function is_balanced(s) {\n  const pairs = {${pp.pairs.map((x) => `'${x[1]}': '${x[0]}'`).join(", ")}};\n  const opens = new Set(Object.values(pairs));\n  const st = [];\n  for (const ch of s) {\n    if (opens.has(ch)) st.push(ch);\n    else if (ch in pairs) { if (st.pop() !== pairs[ch]) return false; }\n  }\n  return st.length === 0;\n}\n`,
  },
};

// ---------------------------------------------------------------- 4. most frequent word

const freqWord: CodeTemplate<{ minLen: number }> = {
  id: "be-code-frequent-word",
  specialization: "backend",
  kind: "code",
  title: "Самое частое слово в логах",
  skills: ["строки"],
  b: -1.1,
  a: 1.0,
  languages: ["python", "javascript"],
  params: (rng) => ({ minLen: rng.int(4, 6) }),
  twin: { key: "minLen", alt: (pp, rng) => ({ minLen: other(rng, [4, 5, 6], pp.minLen) }) },
  statement: (pp, t) => [
    p("Дана строка из латинских слов в нижнем регистре, разделённых пробелами и знаками ", c(". , ! ?"), "."),
    p("Напишите ", c("top_word(text)"), ": самое частое слово длиной не меньше ", t.v("minLen", pp.minLen), " символов. При равенстве частот — лексикографически меньшее. Если подходящих слов нет — пустая строка."),
  ],
  fn: { name: "top_word", args: [{ name: "text", type: "str" }], returns: "str" },
  examples: (_pp, rng) => [[genText(rng, 10)], ["a b c"], [genText(rng, 6)]],
  hidden: (_pp, rng) => [[genText(rng, 20)], [genText(rng, 40)], [genText(rng, 3)], [""], [genText(rng, 60)], ["deploy, deploy! build. build"]],
  solve: (pp, [text]) => {
    const counts = new Map<string, number>();
    for (const w of (text as string).split(/[ .,!?]+/)) if (w.length >= pp.minLen) counts.set(w, (counts.get(w) ?? 0) + 1);
    let best = "";
    let bestC = 0;
    for (const [w, n] of counts) if (n > bestC || (n === bestC && w < best)) [best, bestC] = [w, n];
    return best;
  },
  reference: {
    python: (pp) =>
      `import re\n\ndef top_word(text):\n    counts = {}\n    for w in re.split(r"[ .,!?]+", text):\n        if len(w) >= ${pp.minLen}:\n            counts[w] = counts.get(w, 0) + 1\n    if not counts:\n        return ""\n    return min(counts, key=lambda w: (-counts[w], w))\n`,
    javascript: (pp) =>
      `function top_word(text) {\n  const counts = new Map();\n  for (const w of text.split(/[ .,!?]+/)) if (w.length >= ${pp.minLen}) counts.set(w, (counts.get(w) || 0) + 1);\n  let best = "", bc = 0;\n  for (const [w, n] of counts) if (n > bc || (n === bc && w < best)) { best = w; bc = n; }\n  return best;\n}\n`,
  },
};

function genText(rng: Rng, n: number) {
  const words = rng.sample(WORDS.concat(["ok", "id", "db", "api", "log"]), 7);
  let s = "";
  for (let i = 0; i < n; i++) s += (i ? rng.pick([" ", ", ", ". ", "! ", " "]) : "") + rng.pick(words);
  return s;
}

// ---------------------------------------------------------------- 5. sliding window rate limiter

type RL = { limit: number; window: number };
const rateLimiter: CodeTemplate<RL> = {
  id: "be-code-rate-limiter",
  specialization: "backend",
  kind: "code",
  title: "Ограничитель частоты запросов",
  skills: ["алгоритмы", "highload"],
  b: 0.3,
  a: 1.4,
  languages: ["python", "javascript"],
  params: (rng) => ({ limit: rng.int(2, 5), window: rng.pick([5, 10, 30, 60]) }),
  twin: { key: "window", alt: (pp, rng) => ({ ...pp, window: other(rng, [5, 10, 30, 60], pp.window) }) },
  statement: (pp, t) => [
    p("API пропускает не более ", t.v("limit", pp.limit), " запросов за любые ", t.v("window", pp.window), " секунд: запрос в момент t принимается, если среди уже ", { b: "принятых" }, " запросов в полуинтервале (t − ", t.v("window", pp.window), ", t] их меньше лимита. Отклонённые запросы не учитываются."),
    p("Напишите ", c("accept(times)"), ": по неубывающему списку моментов (целые секунды) верните список булевых значений — принят ли каждый запрос."),
  ],
  fn: { name: "accept", args: [{ name: "times", type: "list[int]" }], returns: "list[bool]" },
  examples: (_pp, rng) => [[sortedTimes(rng, 8, 30)], [[0, 0, 0, 0, 0, 0]]],
  hidden: (_pp, rng) => [[sortedTimes(rng, 15, 40)], [sortedTimes(rng, 30, 200)], [sortedTimes(rng, 60, 120)], [[]], [sortedTimes(rng, 100, 1000)]],
  solve: (pp, [times]) => {
    const acc: number[] = [];
    return (times as number[]).map((t) => {
      while (acc.length && acc[0]! <= t - pp.window) acc.shift();
      if (acc.length < pp.limit) {
        acc.push(t);
        return true;
      }
      return false;
    });
  },
  reference: {
    python: (pp) =>
      `from collections import deque\n\ndef accept(times):\n    acc = deque()\n    out = []\n    for t in times:\n        while acc and acc[0] <= t - ${pp.window}:\n            acc.popleft()\n        if len(acc) < ${pp.limit}:\n            acc.append(t)\n            out.append(True)\n        else:\n            out.append(False)\n    return out\n`,
    javascript: (pp) =>
      `function accept(times) {\n  const acc = [];\n  return times.map((t) => {\n    while (acc.length && acc[0] <= t - ${pp.window}) acc.shift();\n    if (acc.length < ${pp.limit}) { acc.push(t); return true; }\n    return false;\n  });\n}\n`,
  },
};

function sortedTimes(rng: Rng, n: number, span: number) {
  return intArray(rng, n, 0, span).sort((a, b) => a - b);
}

// ---------------------------------------------------------------- 6. merge intervals

const mergeIntervals: CodeTemplate<{ gap: number }> = {
  id: "be-code-merge-intervals",
  specialization: "backend",
  kind: "code",
  title: "Склейка интервалов бронирования",
  skills: ["алгоритмы"],
  b: 0.4,
  a: 1.3,
  languages: ["python", "javascript"],
  params: (rng) => ({ gap: rng.pick([0, 5, 10, 15]) }),
  twin: { key: "gap", alt: (pp, rng) => ({ gap: other(rng, [0, 5, 10, 15], pp.gap) }) },
  statement: (pp, t) => [
    p("Переговорка забронирована интервалами [start, end) в минутах от начала дня (в произвольном порядке). Два интервала сливаются, если они пересекаются или промежуток между ними не больше ", t.v("gap", pp.gap), " минут."),
    p("Напишите ", c("merge(intervals)"), ", которая возвращает слитые интервалы, отсортированные по началу, в виде списка пар [start, end]."),
  ],
  fn: { name: "merge", args: [{ name: "intervals", type: "list[list[int]]" }], returns: "list[list[int]]" },
  examples: (_pp, rng) => [[genIntervals(rng, 4)], [[[60, 90], [0, 30]]]],
  hidden: (_pp, rng) => [[genIntervals(rng, 6)], [genIntervals(rng, 12)], [genIntervals(rng, 30)], [[]], [[[10, 20]]], [[[0, 10], [10, 20], [25, 30]]]],
  solve: (pp, [iv]) => {
    const s = [...(iv as [number, number][])].sort((x, y) => x[0] - y[0] || x[1] - y[1]);
    const out: [number, number][] = [];
    for (const [a, b] of s) {
      const last = out[out.length - 1];
      if (last && a - last[1] <= pp.gap) last[1] = Math.max(last[1], b);
      else out.push([a, b]);
    }
    return out;
  },
  reference: {
    python: (pp) =>
      `def merge(intervals):\n    out = []\n    for a, b in sorted(intervals):\n        if out and a - out[-1][1] <= ${pp.gap}:\n            out[-1][1] = max(out[-1][1], b)\n        else:\n            out.append([a, b])\n    return out\n`,
    javascript: (pp) =>
      `function merge(intervals) {\n  const s = intervals.map((x) => [...x]).sort((x, y) => x[0] - y[0] || x[1] - y[1]);\n  const out = [];\n  for (const [a, b] of s) {\n    const last = out[out.length - 1];\n    if (last && a - last[1] <= ${pp.gap}) last[1] = Math.max(last[1], b);\n    else out.push([a, b]);\n  }\n  return out;\n}\n`,
  },
};

function genIntervals(rng: Rng, n: number) {
  return Array.from({ length: n }, () => {
    const a = rng.int(0, 600);
    return [a, a + rng.int(5, 60)];
  });
}

// ---------------------------------------------------------------- 7. LRU cache

const lru: CodeTemplate<{ cap: number }> = {
  id: "be-code-lru",
  specialization: "backend",
  kind: "code",
  title: "LRU-кэш",
  skills: ["кэширование", "структуры данных"],
  b: 1.0,
  a: 1.5,
  languages: ["python", "javascript"],
  params: (rng) => ({ cap: rng.int(2, 4) }),
  twin: { key: "cap", alt: (pp, rng) => ({ cap: other(rng, [2, 3, 4], pp.cap) }) },
  statement: (pp, t) => [
    p("Смоделируйте LRU-кэш ёмкостью ", t.v("cap", pp.cap), ". Операции: ", c('["put", key, value]'), " и ", c('["get", key]'), ". И put, и успешный get делают ключ самым свежим; при переполнении вытесняется самый давно использованный ключ."),
    p("Напишите ", c("run(ops)"), ": верните список результатов всех get по порядку (значение или -1, если ключа нет)."),
  ],
  fn: { name: "run", args: [{ name: "ops", type: "list[list]" }], returns: "list[int]" },
  examples: (_pp, rng) => [[genOps(rng, 8)]],
  hidden: (_pp, rng) => [[genOps(rng, 12)], [genOps(rng, 25)], [genOps(rng, 60)], [[]], [genOps(rng, 200)]],
  solve: (pp, [ops]) => {
    const m = new Map<number, number>();
    const out: number[] = [];
    for (const op of ops as [string, number, number?][]) {
      if (op[0] === "get") {
        if (m.has(op[1])) {
          const v = m.get(op[1])!;
          m.delete(op[1]);
          m.set(op[1], v);
          out.push(v);
        } else out.push(-1);
      } else {
        m.delete(op[1]);
        m.set(op[1], op[2]!);
        if (m.size > pp.cap) m.delete(m.keys().next().value!);
      }
    }
    return out;
  },
  reference: {
    python: (pp) =>
      `from collections import OrderedDict\n\ndef run(ops):\n    m = OrderedDict()\n    out = []\n    for op in ops:\n        if op[0] == "get":\n            if op[1] in m:\n                m.move_to_end(op[1])\n                out.append(m[op[1]])\n            else:\n                out.append(-1)\n        else:\n            m[op[1]] = op[2]\n            m.move_to_end(op[1])\n            if len(m) > ${pp.cap}:\n                m.popitem(last=False)\n    return out\n`,
    javascript: (pp) =>
      `function run(ops) {\n  const m = new Map();\n  const out = [];\n  for (const op of ops) {\n    if (op[0] === "get") {\n      if (m.has(op[1])) { const v = m.get(op[1]); m.delete(op[1]); m.set(op[1], v); out.push(v); }\n      else out.push(-1);\n    } else {\n      m.delete(op[1]); m.set(op[1], op[2]);\n      if (m.size > ${pp.cap}) m.delete(m.keys().next().value);\n    }\n  }\n  return out;\n}\n`,
  },
};

function genOps(rng: Rng, n: number) {
  return Array.from({ length: n }, () => (rng.bool(0.55) ? ["put", rng.int(1, 6), rng.int(1, 99)] : ["get", rng.int(1, 6)]));
}

// ---------------------------------------------------------------- 8. endpoint latency percentile

type Lat = { k: number; pct: number };
const latency: CodeTemplate<Lat> = {
  id: "be-code-latency-top",
  specialization: "backend",
  kind: "code",
  title: "Самые медленные эндпоинты",
  skills: ["мониторинг", "http"],
  b: 1.2,
  a: 1.3,
  languages: ["python", "javascript"],
  params: (rng) => ({ k: rng.int(2, 3), pct: rng.pick([50, 90, 95]) }),
  twin: { key: "pct", alt: (pp, rng) => ({ ...pp, pct: other(rng, [50, 90, 95], pp.pct) }) },
  statement: (pp, t) => [
    p("Строки access-лога имеют вид ", c("METHOD PATH STATUS MS"), ", например ", c("GET /api/users 200 87"), ". Метод не важен; ответы со статусом 500 и выше в расчёт не берутся."),
    p("Для каждого пути посчитайте ", t.v("pct", pp.pct), "-й перцентиль времени ответа методом ближайшего ранга: отсортировать значения, взять элемент с номером ⌈P/100 · n⌉ (нумерация с 1)."),
    p("Напишите ", c("slowest(lines)"), ": верните ", t.v("k", pp.k), " пути с наибольшим перцентилем (по убыванию, при равенстве — по алфавиту пути). Если путей меньше — все."),
  ],
  fn: { name: "slowest", args: [{ name: "lines", type: "list[str]" }], returns: "list[str]" },
  examples: (_pp, rng) => [[genLog(rng, 10)]],
  hidden: (_pp, rng) => [[genLog(rng, 20)], [genLog(rng, 50)], [genLog(rng, 5)], [[]], [genLog(rng, 300)]],
  solve: (pp, [lines]) => {
    const by = new Map<string, number[]>();
    for (const l of lines as string[]) {
      const [, path, status, ms] = l.split(" ");
      if (Number(status) >= 500) continue;
      by.set(path!, [...(by.get(path!) ?? []), Number(ms)]);
    }
    const rows = [...by].map(([path, xs]) => {
      xs.sort((a, b) => a - b);
      return { path, v: xs[Math.ceil((pp.pct / 100) * xs.length) - 1]! };
    });
    rows.sort((a, b) => b.v - a.v || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    return rows.slice(0, pp.k).map((r) => r.path);
  },
  reference: {
    python: (pp) =>
      `import math\n\ndef slowest(lines):\n    by = {}\n    for l in lines:\n        _, path, status, ms = l.split(" ")\n        if int(status) >= 500:\n            continue\n        by.setdefault(path, []).append(int(ms))\n    rows = []\n    for path, xs in by.items():\n        xs.sort()\n        rows.append((-xs[math.ceil(${pp.pct} / 100 * len(xs)) - 1], path))\n    rows.sort()\n    return [p for _, p in rows[:${pp.k}]]\n`,
    javascript: (pp) =>
      `function slowest(lines) {\n  const by = new Map();\n  for (const l of lines) {\n    const [, path, status, ms] = l.split(" ");\n    if (Number(status) >= 500) continue;\n    if (!by.has(path)) by.set(path, []);\n    by.get(path).push(Number(ms));\n  }\n  const rows = [...by].map(([path, xs]) => { xs.sort((a, b) => a - b); return { path, v: xs[Math.ceil(${pp.pct} / 100 * xs.length) - 1] }; });\n  rows.sort((a, b) => b.v - a.v || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));\n  return rows.slice(0, ${pp.k}).map((r) => r.path);\n}\n`,
  },
};

function genLog(rng: Rng, n: number) {
  const paths = rng.sample(PATHS, 5);
  return Array.from(
    { length: n },
    () => `${rng.pick(["GET", "POST", "PUT"])} ${rng.pick(paths)} ${rng.pick([200, 200, 200, 201, 404, 500, 503])} ${rng.int(5, 900)}`,
  );
}

// ---------------------------------------------------------------- 9. dependency start order

const topo: CodeTemplate<{ prefix: string }> = {
  id: "be-code-start-order",
  specialization: "backend",
  kind: "code",
  title: "Порядок запуска сервисов",
  skills: ["графы", "микросервисы"],
  b: 1.6,
  a: 1.4,
  languages: ["python", "javascript"],
  params: (rng) => ({ prefix: rng.pick(["svc", "app", "srv"]) }),
  statement: () => [
    p("Даны сервисы и зависимости: пара ", c("[a, b]"), " означает, что a нельзя запускать раньше b. Все сервисы, упомянутые в зависимостях, плюс список ", c("services"), " должны быть запущены."),
    p("Напишите ", c("start_order(services, deps)"), ": верните порядок запуска; среди доступных в каждый момент сервисов выбирается лексикографически наименьший. Если есть цикл — верните пустой список."),
  ],
  fn: { name: "start_order", args: [{ name: "services", type: "list[str]" }, { name: "deps", type: "list[list[str]]" }], returns: "list[str]" },
  examples: (_pp, rng) => [genGraph(rng, 4, false), [["a", "b"], [["a", "b"], ["b", "a"]]]],
  hidden: (_pp, rng) => [genGraph(rng, 5, false), genGraph(rng, 8, false), genGraph(rng, 8, true), genGraph(rng, 12, false), [["x"], []], genGraph(rng, 14, true)],
  solve: (_pp, [services, deps]) => {
    const nodes = new Set<string>(services as string[]);
    const indeg = new Map<string, number>();
    const out = new Map<string, string[]>();
    for (const [a, b] of deps as [string, string][]) {
      nodes.add(a);
      nodes.add(b);
    }
    for (const n of nodes) {
      indeg.set(n, 0);
      out.set(n, []);
    }
    for (const [a, b] of deps as [string, string][]) {
      indeg.set(a, indeg.get(a)! + 1);
      out.get(b)!.push(a);
    }
    const ready = [...nodes].filter((n) => indeg.get(n) === 0);
    const order: string[] = [];
    while (ready.length) {
      ready.sort();
      const n = ready.shift()!;
      order.push(n);
      for (const m of out.get(n)!) {
        indeg.set(m, indeg.get(m)! - 1);
        if (indeg.get(m) === 0) ready.push(m);
      }
    }
    return order.length === nodes.size ? order : [];
  },
  reference: {
    python: () =>
      `import heapq\n\ndef start_order(services, deps):\n    nodes = set(services)\n    for a, b in deps:\n        nodes.add(a); nodes.add(b)\n    indeg = {n: 0 for n in nodes}\n    out = {n: [] for n in nodes}\n    for a, b in deps:\n        indeg[a] += 1\n        out[b].append(a)\n    ready = [n for n in nodes if indeg[n] == 0]\n    heapq.heapify(ready)\n    order = []\n    while ready:\n        n = heapq.heappop(ready)\n        order.append(n)\n        for m in out[n]:\n            indeg[m] -= 1\n            if indeg[m] == 0:\n                heapq.heappush(ready, m)\n    return order if len(order) == len(nodes) else []\n`,
    javascript: () =>
      `function start_order(services, deps) {\n  const nodes = new Set(services);\n  for (const [a, b] of deps) { nodes.add(a); nodes.add(b); }\n  const indeg = new Map(), out = new Map();\n  for (const n of nodes) { indeg.set(n, 0); out.set(n, []); }\n  for (const [a, b] of deps) { indeg.set(a, indeg.get(a) + 1); out.get(b).push(a); }\n  const ready = [...nodes].filter((n) => indeg.get(n) === 0);\n  const order = [];\n  while (ready.length) {\n    ready.sort();\n    const n = ready.shift();\n    order.push(n);\n    for (const m of out.get(n)) { indeg.set(m, indeg.get(m) - 1); if (indeg.get(m) === 0) ready.push(m); }\n  }\n  return order.length === nodes.size ? order : [];\n}\n`,
  },
};

function genGraph(rng: Rng, n: number, allowCycle: boolean): [string[], [string, string][]] {
  const names = rng.sample(SERVICE_NAMES, n);
  const deps: [string, string][] = [];
  for (let i = 1; i < names.length; i++) {
    for (let j = 0; j < i; j++) if (rng.bool(0.25)) deps.push([names[i]!, names[j]!]);
  }
  if (allowCycle && n > 2 && rng.bool(0.7)) deps.push([names[0]!, names[n - 1]!]);
  const services = names.filter(() => rng.bool(0.5));
  return [services, rng.shuffle(deps)];
}

// ---------------------------------------------------------------- 10. shortest latency

const shortest: CodeTemplate<{ hop: number }> = {
  id: "be-code-min-latency",
  specialization: "backend",
  kind: "code",
  title: "Минимальная задержка маршрута",
  skills: ["графы", "алгоритмы"],
  b: 2.0,
  a: 1.3,
  languages: ["python", "javascript"],
  params: (rng) => ({ hop: rng.pick([0, 3, 5, 10]) }),
  twin: { key: "hop", alt: (pp, rng) => ({ hop: other(rng, [0, 3, 5, 10], pp.hop) }) },
  statement: (pp, t) => [
    p("Сеть сервисов задана рёбрами ", c("[from, to, ms]"), " (направленные, задержка ms ≥ 0). Каждый переход по ребру дополнительно стоит ", t.v("hop", pp.hop), " мс на сериализацию."),
    p("Напишите ", c("min_latency(edges, target)"), ": минимальная суммарная задержка от сервиса ", c('"gateway"'), " до target; если недостижим — -1. Для target = \"gateway\" ответ 0."),
  ],
  fn: { name: "min_latency", args: [{ name: "edges", type: "list[list]" }, { name: "target", type: "str" }], returns: "int" },
  examples: (_pp, rng) => [genNet(rng, 5, 7), [[["gateway", "auth", 10]], "billing"]],
  hidden: (_pp, rng) => [genNet(rng, 6, 10), genNet(rng, 8, 16), genNet(rng, 10, 25), genNet(rng, 12, 40), [[], "gateway"], genNet(rng, 4, 3)],
  solve: (pp, [edges, target]) => {
    const adj = new Map<string, [string, number][]>();
    for (const [a, b, w] of edges as [string, string, number][]) adj.set(a, [...(adj.get(a) ?? []), [b, w + pp.hop]]);
    const dist = new Map<string, number>([["gateway", 0]]);
    const done = new Set<string>();
    for (;;) {
      let u: string | null = null;
      for (const [k, d] of dist) if (!done.has(k) && (u === null || d < dist.get(u)!)) u = k;
      if (u === null) break;
      done.add(u);
      for (const [v, w] of adj.get(u) ?? []) if (!dist.has(v) || dist.get(u)! + w < dist.get(v)!) dist.set(v, dist.get(u)! + w);
    }
    return dist.get(target as string) ?? -1;
  },
  reference: {
    python: (pp) =>
      `import heapq\n\ndef min_latency(edges, target):\n    adj = {}\n    for a, b, w in edges:\n        adj.setdefault(a, []).append((b, w + ${pp.hop}))\n    dist = {"gateway": 0}\n    pq = [(0, "gateway")]\n    while pq:\n        d, u = heapq.heappop(pq)\n        if d > dist.get(u, float("inf")):\n            continue\n        for v, w in adj.get(u, []):\n            if d + w < dist.get(v, float("inf")):\n                dist[v] = d + w\n                heapq.heappush(pq, (d + w, v))\n    return dist.get(target, -1)\n`,
    javascript: (pp) =>
      `function min_latency(edges, target) {\n  const adj = new Map();\n  for (const [a, b, w] of edges) { if (!adj.has(a)) adj.set(a, []); adj.get(a).push([b, w + ${pp.hop}]); }\n  const dist = new Map([["gateway", 0]]);\n  const done = new Set();\n  for (;;) {\n    let u = null;\n    for (const [k, d] of dist) if (!done.has(k) && (u === null || d < dist.get(u))) u = k;\n    if (u === null) break;\n    done.add(u);\n    for (const [v, w] of adj.get(u) || []) if (!dist.has(v) || dist.get(u) + w < dist.get(v)) dist.set(v, dist.get(u) + w);\n  }\n  return dist.has(target) ? dist.get(target) : -1;\n}\n`,
  },
};

function genNet(rng: Rng, n: number, m: number): [[string, string, number][], string] {
  const names = ["gateway", ...rng.sample(SERVICE_NAMES.filter((s) => s !== "gateway"), n - 1)];
  const edges: [string, string, number][] = [];
  for (let i = 0; i < m; i++) {
    const a = rng.pick(names);
    const b = rng.pick(names);
    if (a !== b) edges.push([a, b, rng.int(0, 50)]);
  }
  return [edges, rng.pick(names.slice(1))];
}

// ---------------------------------------------------------------- 11. idempotent event dedupe

const dedupe: CodeTemplate<{ ttl: number }> = {
  id: "be-code-dedupe",
  specialization: "backend",
  kind: "code",
  title: "Дедупликация событий",
  skills: ["очереди", "идемпотентность"],
  b: 0.0,
  a: 1.2,
  languages: ["python", "javascript"],
  params: (rng) => ({ ttl: rng.pick([10, 30, 60, 120]) }),
  twin: { key: "ttl", alt: (pp, rng) => ({ ttl: other(rng, [10, 30, 60, 120], pp.ttl) }) },
  statement: (pp, t) => [
    p("Консьюмер очереди получает события ", c("[id, ts]"), " (ts — секунды, по неубыванию). Событие считается дублем и отбрасывается, если событие с тем же id уже было ", { b: "принято" }, " менее чем ", t.v("ttl", pp.ttl), " секунд назад (ts − ts_принятого < ", t.v("ttl", pp.ttl), ")."),
    p("Напишите ", c("dedupe(events)"), ": верните список id принятых событий по порядку."),
  ],
  fn: { name: "dedupe", args: [{ name: "events", type: "list[list]" }], returns: "list[str]" },
  examples: (_pp, rng) => [[genEvents(rng, 8, 100)]],
  hidden: (_pp, rng) => [[genEvents(rng, 12, 100)], [genEvents(rng, 30, 300)], [genEvents(rng, 80, 1000)], [[]], [[["a", 0], ["a", 0], ["a", 200]]]],
  solve: (pp, [events]) => {
    const last = new Map<string, number>();
    const out: string[] = [];
    for (const [id, ts] of events as [string, number][]) {
      const l = last.get(id);
      if (l !== undefined && ts - l < pp.ttl) continue;
      last.set(id, ts);
      out.push(id);
    }
    return out;
  },
  reference: {
    python: (pp) =>
      `def dedupe(events):\n    last = {}\n    out = []\n    for id_, ts in events:\n        if id_ in last and ts - last[id_] < ${pp.ttl}:\n            continue\n        last[id_] = ts\n        out.append(id_)\n    return out\n`,
    javascript: (pp) =>
      `function dedupe(events) {\n  const last = new Map();\n  const out = [];\n  for (const [id, ts] of events) {\n    if (last.has(id) && ts - last.get(id) < ${pp.ttl}) continue;\n    last.set(id, ts);\n    out.push(id);\n  }\n  return out;\n}\n`,
  },
};

function genEvents(rng: Rng, n: number, span: number) {
  const ids = Array.from({ length: Math.max(2, Math.floor(n / 3)) }, () => `ev-${rng.token(3)}`);
  return intArray(rng, n, 0, span)
    .sort((a, b) => a - b)
    .map((ts) => [rng.pick(ids), ts]);
}

export const backendCode = [
  sumMultiples,
  backoff,
  brackets,
  freqWord,
  rateLimiter,
  mergeIntervals,
  lru,
  latency,
  topo,
  shortest,
  dedupe,
] as CodeTemplate[];
