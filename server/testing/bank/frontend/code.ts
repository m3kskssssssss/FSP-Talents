import type { Rng } from "../../rng";
import type { CodeTemplate } from "../../types";
import { c, intArray, other, p, WORDS } from "../util";

const JS = ["javascript"] as const;
const sorted = (rng: Rng, n: number, span: number) => intArray(rng, n, 0, span).sort((a, b) => a - b);

// ---------------------------------------------------------------- 1. debounce

const debounce: CodeTemplate<{ wait: number }> = {
  id: "fe-code-debounce",
  specialization: "frontend",
  kind: "code",
  title: "Debounce поискового запроса",
  skills: ["javascript", "асинхронность"],
  b: -0.6,
  a: 1.3,
  languages: [...JS],
  params: (rng) => ({ wait: rng.pick([100, 200, 300, 500]) }),
  twin: { key: "wait", alt: (pp, rng) => ({ wait: other(rng, [100, 200, 300, 500], pp.wait) }) },
  statement: (pp, t) => [
    p("Поле поиска вызывает обработчик через debounce с задержкой ", t.v("wait", pp.wait), " мс (срабатывание по окончании серии, trailing): обработчик запускается в момент последнего нажатия + задержка, если за это время не было новых нажатий."),
    p("Напишите ", c("fires(times)"), ": по неубывающему списку моментов нажатий (мс) верните моменты срабатываний."),
  ],
  fn: { name: "fires", args: [{ name: "times", type: "number[]" }], returns: "number[]" },
  examples: (_pp, rng) => [[sorted(rng, 8, 1500)], [[0, 50, 100]]],
  hidden: (_pp, rng) => [[sorted(rng, 15, 3000)], [sorted(rng, 40, 6000)], [[]], [[5]], [sorted(rng, 100, 20000)]],
  solve: (pp, [times]) => {
    const ts = times as number[];
    return ts.filter((t, i) => i === ts.length - 1 || ts[i + 1]! - t >= pp.wait).map((t) => t + pp.wait);
  },
  reference: {
    javascript: (pp) => `function fires(times) {\n  return times.filter((t, i) => i === times.length - 1 || times[i + 1] - t >= ${pp.wait}).map((t) => t + ${pp.wait});\n}\n`,
  },
};

// ---------------------------------------------------------------- 2. throttle

const throttle: CodeTemplate<{ interval: number }> = {
  id: "fe-code-throttle",
  specialization: "frontend",
  kind: "code",
  title: "Throttle обработчика скролла",
  skills: ["javascript", "производительность"],
  b: -0.2,
  a: 1.2,
  languages: [...JS],
  params: (rng) => ({ interval: rng.pick([50, 100, 250]) }),
  twin: { key: "interval", alt: (pp, rng) => ({ interval: other(rng, [50, 100, 250], pp.interval) }) },
  statement: (pp, t) => [
    p("Обработчик скролла обёрнут в throttle (leading): событие обрабатывается, если с момента последнего ", { b: "обработанного" }, " события прошло не меньше ", t.v("interval", pp.interval), " мс; первое событие обрабатывается всегда."),
    p("Напишите ", c("handled(times)"), " — моменты обработанных событий."),
  ],
  fn: { name: "handled", args: [{ name: "times", type: "number[]" }], returns: "number[]" },
  examples: (_pp, rng) => [[sorted(rng, 10, 600)]],
  hidden: (_pp, rng) => [[sorted(rng, 20, 1000)], [sorted(rng, 60, 3000)], [[]], [[0, 0, 0]]],
  solve: (pp, [times]) => {
    const out: number[] = [];
    for (const t of times as number[]) if (!out.length || t - out[out.length - 1]! >= pp.interval) out.push(t);
    return out;
  },
  reference: {
    javascript: (pp) => `function handled(times) {\n  const out = [];\n  for (const t of times) if (!out.length || t - out[out.length - 1] >= ${pp.interval}) out.push(t);\n  return out;\n}\n`,
  },
};

// ---------------------------------------------------------------- 3. query string

const query: CodeTemplate<{ sep: string }> = {
  id: "fe-code-query-parse",
  specialization: "frontend",
  kind: "code",
  title: "Разбор query-строки",
  skills: ["javascript", "строки"],
  b: -1.2,
  a: 1.0,
  languages: [...JS],
  params: (rng) => ({ sep: rng.pick(["&", ";"]) }),
  statement: (pp) => [
    p("Строка вида ", c(`?a=1${pp.sep}b=hello%20world${pp.sep}a=2`), " — параметры разделены символом ", c(pp.sep), ". Значения закодированы через encodeURIComponent, ", c("+"), " означает пробел. Параметр без ", c("="), " имеет значение пустая строка."),
    p("Напишите ", c("parse(qs)"), ": верните объект, где значение — массив всех значений ключа в порядке появления. Пустые сегменты пропускайте; ведущий ", c("?"), " может отсутствовать."),
  ],
  fn: { name: "parse", args: [{ name: "qs", type: "string" }], returns: "Record<string, string[]>" },
  examples: (pp) => [[`?a=1${pp.sep}b=hello%20world${pp.sep}a=2`], [`x${pp.sep}${pp.sep}y=a+b`]],
  hidden: (pp, rng) => {
    const gen = () => "?" + Array.from({ length: rng.int(1, 8) }, () => `${rng.pick(["q", "page", "tag", "sort", "f"])}${rng.bool(0.8) ? "=" + encodeURIComponent(rng.pick(WORDS) + (rng.bool() ? " " + rng.pick(WORDS) : "")).replace(/%20/g, rng.bool() ? "+" : "%20") : ""}`).join(pp.sep);
    return [[gen()], [gen()], [gen()], [""], ["?"], [gen().slice(1)]];
  },
  solve: (pp, [qs]) => {
    const out: Record<string, string[]> = {};
    for (const part of (qs as string).replace(/^\?/, "").split(pp.sep)) {
      if (!part) continue;
      const i = part.indexOf("=");
      const k = decodeURIComponent((i < 0 ? part : part.slice(0, i)).replace(/\+/g, " "));
      const v = i < 0 ? "" : decodeURIComponent(part.slice(i + 1).replace(/\+/g, " "));
      (out[k] ??= []).push(v);
    }
    return out;
  },
  reference: {
    javascript: (pp) =>
      `function parse(qs) {\n  const out = {};\n  for (const part of qs.replace(/^\\?/, "").split(${JSON.stringify(pp.sep)})) {\n    if (!part) continue;\n    const i = part.indexOf("=");\n    const dec = (s) => decodeURIComponent(s.replace(/\\+/g, " "));\n    const k = dec(i < 0 ? part : part.slice(0, i));\n    (out[k] = out[k] || []).push(i < 0 ? "" : dec(part.slice(i + 1)));\n  }\n  return out;\n}\n`,
  },
};

// ---------------------------------------------------------------- 4. flatten to depth

const flatten: CodeTemplate<{ depth: number }> = {
  id: "fe-code-flatten",
  specialization: "frontend",
  kind: "code",
  title: "Flatten до заданной глубины",
  skills: ["javascript", "рекурсия"],
  b: -1.7,
  a: 1.0,
  languages: [...JS],
  params: (rng) => ({ depth: rng.int(1, 3) }),
  twin: { key: "depth", alt: (pp, rng) => ({ depth: other(rng, [1, 2, 3], pp.depth) }) },
  statement: (pp, t) => [
    p("Напишите ", c("flat(arr)"), " без использования ", c("Array.prototype.flat"), ": раскройте вложенные массивы на глубину ", t.v("depth", pp.depth), " (как ", c(`arr.flat(${pp.depth})`), ")."),
  ],
  fn: { name: "flat", args: [{ name: "arr", type: "any[]" }], returns: "any[]" },
  examples: () => [[[1, [2, [3, [4]]], 5]], [[]]],
  hidden: (_pp, rng) => {
    const gen = (d: number): unknown[] => Array.from({ length: rng.int(1, 4) }, () => (d > 0 && rng.bool(0.5) ? gen(d - 1) : rng.int(0, 99)));
    return [[gen(4)], [gen(4)], [gen(5)], [[[[]]]], [gen(2)]];
  },
  solve: (pp, [arr]) => (arr as unknown[]).flat(pp.depth),
  reference: {
    javascript: (pp) => `function flat(arr, d = ${pp.depth}) {\n  const out = [];\n  for (const x of arr) {\n    if (Array.isArray(x) && d > 0) out.push(...flat(x, d - 1));\n    else out.push(x);\n  }\n  return out;\n}\n`,
  },
};

// ---------------------------------------------------------------- 5. price formatting

const price: CodeTemplate<{ sign: string }> = {
  id: "fe-code-format-price",
  specialization: "frontend",
  kind: "code",
  title: "Форматирование цены",
  skills: ["javascript", "строки"],
  b: -0.9,
  a: 1.1,
  languages: [...JS],
  params: (rng) => ({ sign: rng.pick(["₽", "руб."]) }),
  statement: (pp) => [
    p("Цена хранится в копейках (целое, может быть отрицательным). Напишите ", c("fmt(kop)"), ": рубли с разделителем тысяч — обычный пробел, копейки через запятую (всегда две цифры), в конце пробел и ", c(pp.sign), ". Например, 1234567 → ", c(`12 345,67 ${pp.sign}`), ", -5 → ", c(`-0,05 ${pp.sign}`), ". Не используйте Intl."),
  ],
  fn: { name: "fmt", args: [{ name: "kop", type: "number" }], returns: "string" },
  examples: () => [[1234567], [-5], [100]],
  hidden: (_pp, rng) => [[rng.int(0, 99)], [rng.int(100, 99999)], [rng.int(100000, 999999999)], [-rng.int(1, 9999999)], [0], [100000000]],
  solve: (pp, [kop]) => {
    const k = kop as number;
    const neg = k < 0;
    const abs = Math.abs(k);
    const rub = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return `${neg ? "-" : ""}${rub},${String(abs % 100).padStart(2, "0")} ${pp.sign}`;
  },
  reference: {
    javascript: (pp) => `function fmt(kop) {\n  const abs = Math.abs(kop);\n  const rub = String(Math.floor(abs / 100)).replace(/\\B(?=(\\d{3})+(?!\\d))/g, " ");\n  return (kop < 0 ? "-" : "") + rub + "," + String(abs % 100).padStart(2, "0") + " ${pp.sign}";\n}\n`,
  },
};

// ---------------------------------------------------------------- 6. virtual list window

type VL = { h: number; overscan: number };
const virtualList: CodeTemplate<VL> = {
  id: "fe-code-virtual-list",
  specialization: "frontend",
  kind: "code",
  title: "Окно виртуального списка",
  skills: ["производительность", "react"],
  b: 0.4,
  a: 1.4,
  languages: [...JS],
  params: (rng) => ({ h: rng.pick([20, 32, 40, 48]), overscan: rng.int(1, 4) }),
  twin: { key: "h", alt: (pp, rng) => ({ ...pp, h: other(rng, [20, 32, 40, 48], pp.h) }) },
  statement: (pp, t) => [
    p("Список из n строк высотой ", t.v("h", pp.h), " px рендерится виртуально: отрисовываются строки, хотя бы частично попадающие в окно [scrollTop, scrollTop + viewport), плюс ", t.v("overscan", pp.overscan), " строк запаса сверху и снизу (в пределах списка)."),
    p("Напишите ", c("range(scrollTop, viewport, n)"), ": верните ", c("[start, end]"), " — индексы первой и последней отрисованной строки (включительно); для n = 0 — ", c("[0, -1]"), "."),
  ],
  fn: { name: "range", args: [{ name: "scrollTop", type: "number" }, { name: "viewport", type: "number" }, { name: "n", type: "number" }], returns: "[number, number]" },
  examples: () => [[0, 300, 1000], [500, 200, 20]],
  hidden: (pp, rng) => [[rng.int(0, 5000), rng.int(100, 900), 1000], [rng.int(0, 400), rng.int(100, 900), 15], [0, 500, 3], [123 * pp.h, 7 * pp.h, 500], [rng.int(0, 99999), 600, 100], [0, 400, 0]],
  solve: (pp, [top, vp, n]) => {
    const N = n as number;
    if (!N) return [0, -1];
    const first = Math.floor((top as number) / pp.h);
    const last = Math.ceil(((top as number) + (vp as number)) / pp.h) - 1;
    return [Math.max(0, Math.min(N - 1, first - pp.overscan)), Math.max(0, Math.min(N - 1, last + pp.overscan))];
  },
  reference: {
    javascript: (pp) => `function range(scrollTop, viewport, n) {\n  if (!n) return [0, -1];\n  const first = Math.floor(scrollTop / ${pp.h});\n  const last = Math.ceil((scrollTop + viewport) / ${pp.h}) - 1;\n  const clamp = (x) => Math.max(0, Math.min(n - 1, x));\n  return [clamp(first - ${pp.overscan}), clamp(last + ${pp.overscan})];\n}\n`,
  },
};

// ---------------------------------------------------------------- 7. safe get by path

const deepGet: CodeTemplate<{ fallback: string }> = {
  id: "fe-code-deep-get",
  specialization: "frontend",
  kind: "code",
  title: "Безопасный доступ по пути",
  skills: ["javascript"],
  b: -1.4,
  a: 1.0,
  languages: [...JS],
  params: (rng) => ({ fallback: rng.pick(["n/a", "—", "unknown"]) }),
  statement: (pp) => [
    p("Напишите ", c("get(obj, path)"), ": путь вида ", c("user.addresses.0.city"), " (числа — индексы массивов). Если на любом шаге значения нет (undefined или null), верните строку ", c(JSON.stringify(pp.fallback)), "."),
  ],
  fn: { name: "get", args: [{ name: "obj", type: "object" }, { name: "path", type: "string" }], returns: "any" },
  examples: () => [[{ user: { addresses: [{ city: "Казань" }] } }, "user.addresses.0.city"], [{ a: null }, "a.b"]],
  hidden: (_pp, rng) => {
    const obj = { user: { name: rng.pick(WORDS), tags: [rng.pick(WORDS), rng.pick(WORDS)], addr: [{ city: "Пермь", zip: rng.int(100000, 999999) }] }, n: 0, z: null };
    return [[obj, "user.name"], [obj, "user.tags.1"], [obj, "user.addr.0.zip"], [obj, "user.addr.3.city"], [obj, "n"], [obj, "z.y"], [obj, "missing.deep.path"]];
  },
  solve: (pp, [obj, path]) => {
    let cur: unknown = obj;
    for (const k of (path as string).split(".")) {
      if (cur === null || cur === undefined) return pp.fallback;
      cur = (cur as Record<string, unknown>)[k];
    }
    return cur === undefined || cur === null ? pp.fallback : cur;
  },
  reference: {
    javascript: (pp) => `function get(obj, path) {\n  let cur = obj;\n  for (const k of path.split(".")) {\n    if (cur == null) return ${JSON.stringify(pp.fallback)};\n    cur = cur[k];\n  }\n  return cur == null ? ${JSON.stringify(pp.fallback)} : cur;\n}\n`,
  },
};

// ---------------------------------------------------------------- 8. classNames

const classNames: CodeTemplate<{ sep: string }> = {
  id: "fe-code-classnames",
  specialization: "frontend",
  kind: "code",
  title: "Утилита classNames",
  skills: ["javascript", "react"],
  b: -0.4,
  a: 1.1,
  languages: [...JS],
  params: () => ({ sep: " " }),
  statement: () => [
    p("Напишите ", c("cx(args)"), ": аргумент — массив, элементы которого: строки (добавляются, если непустые), объекты ", c("{класс: условие}"), " (добавляются ключи с истинным значением в порядке ключей), вложенные массивы (обрабатываются рекурсивно), а также false/null/0 (игнорируются). Верните строку классов через пробел без повторов (первое вхождение сохраняет позицию)."),
  ],
  fn: { name: "cx", args: [{ name: "args", type: "any[]" }], returns: "string" },
  examples: (_pp, rng) => [[[rng.pick(["btn", "card", "chip"]), { active: rng.bool(), disabled: false }, [rng.pick(["lg", "sm"]), null]]], [[]]],
  hidden: (_pp, rng) => {
    const cls = () => rng.pick(["btn", "card", "active", "open", "lg", "sm", "error", "hidden"]);
    const gen = (d: number): unknown[] =>
      Array.from({ length: rng.int(1, 5) }, () => {
        const r = rng.int(0, 4);
        if (r === 0) return cls();
        if (r === 1) return { [cls()]: rng.bool(), [cls()]: rng.bool() };
        if (r === 2 && d > 0) return gen(d - 1);
        if (r === 3) return rng.pick([false, null, 0, ""]);
        return cls();
      });
    return [[gen(2)], [gen(3)], [gen(1)], [[null, false]], [gen(3)]];
  },
  solve: (_pp, [args]) => {
    const out: string[] = [];
    const add = (x: string) => {
      if (x && !out.includes(x)) out.push(x);
    };
    const walk = (a: unknown) => {
      if (!a) return;
      if (typeof a === "string") add(a);
      else if (Array.isArray(a)) a.forEach(walk);
      else if (typeof a === "object") for (const [k, v] of Object.entries(a)) if (v) add(k);
    };
    walk(args);
    return out.join(" ");
  },
  reference: {
    javascript: () =>
      `function cx(args) {\n  const out = [];\n  const add = (x) => { if (x && !out.includes(x)) out.push(x); };\n  const walk = (a) => {\n    if (!a) return;\n    if (typeof a === "string") add(a);\n    else if (Array.isArray(a)) a.forEach(walk);\n    else if (typeof a === "object") for (const [k, v] of Object.entries(a)) if (v) add(k);\n  };\n  walk(args);\n  return out.join(" ");\n}\n`,
  },
};

// ---------------------------------------------------------------- 9. keyed diff

const keyedDiff: CodeTemplate<{ x: number }> = {
  id: "fe-code-keyed-diff",
  specialization: "frontend",
  kind: "code",
  title: "Дифф списка по ключам",
  skills: ["react", "алгоритмы"],
  b: 0.9,
  a: 1.3,
  languages: [...JS],
  params: () => ({ x: 0 }),
  statement: () => [
    p("При обновлении списка с ключами нужно понять, какие элементы добавить и удалить. Напишите ", c("diff(prev, next)"), ": верните ", c("[added, removed]"), " — ключи из next, которых не было в prev (в порядке next), и ключи из prev, которых нет в next (в порядке prev). Ключи в каждом списке уникальны."),
  ],
  fn: { name: "diff", args: [{ name: "prev", type: "string[]" }, { name: "next", type: "string[]" }], returns: "[string[], string[]]" },
  examples: (_pp, rng) => {
    const keys = ["a", "b", "c", "d", "e", "f"];
    return [[rng.sample(keys, 3), rng.sample(keys, 3)]];
  },
  hidden: (_pp, rng) => {
    const keys = Array.from({ length: 30 }, (_, i) => `k${i}`);
    const pair = () => [rng.sample(keys, rng.int(0, 12)), rng.sample(keys, rng.int(0, 12))];
    return [pair(), pair(), pair(), [[], []], pair()];
  },
  solve: (_pp, [prev, next]) => {
    const a = new Set(prev as string[]);
    const b = new Set(next as string[]);
    return [(next as string[]).filter((k) => !a.has(k)), (prev as string[]).filter((k) => !b.has(k))];
  },
  reference: {
    javascript: () => `function diff(prev, next) {\n  const a = new Set(prev), b = new Set(next);\n  return [next.filter((k) => !a.has(k)), prev.filter((k) => !b.has(k))];\n}\n`,
  },
};

// ---------------------------------------------------------------- 10. minimal moves (LIS)

const minMoves: CodeTemplate<{ x: number }> = {
  id: "fe-code-min-moves",
  specialization: "frontend",
  kind: "code",
  title: "Минимум перемещений DOM-узлов",
  skills: ["алгоритмы", "react"],
  b: 2.0,
  a: 1.4,
  languages: [...JS],
  params: () => ({ x: 0 }),
  statement: () => [
    p("Список узлов с ключами переупорядочили (набор ключей тот же). Узлы, которые остаются на месте относительно друг друга, не трогаем; остальные перемещаем по одному. Напишите ", c("moves(prev, next)"), " — минимальное число перемещений (подсказка: связано с наибольшей возрастающей подпоследовательностью)."),
  ],
  fn: { name: "moves", args: [{ name: "prev", type: "string[]" }, { name: "next", type: "string[]" }], returns: "number" },
  examples: (_pp, rng) => [[["a", "b", "c", "d", "e"], rng.shuffle(["a", "b", "c", "d", "e"])], [["a", "b"], ["a", "b"]]],
  hidden: (_pp, rng) => {
    const gen = (n: number) => {
      const keys = Array.from({ length: n }, (_, i) => `n${i}`);
      return [keys, rng.shuffle(keys)];
    };
    return [gen(5), gen(10), gen(50), gen(200), gen(1), [["x", "y", "z"], ["z", "y", "x"]]];
  },
  solve: (_pp, [prev, next]) => {
    const pos = new Map((prev as string[]).map((k, i) => [k, i]));
    const seq = (next as string[]).map((k) => pos.get(k)!);
    const tails: number[] = [];
    for (const x of seq) {
      let lo = 0, hi = tails.length;
      while (lo < hi) {
        const m = (lo + hi) >> 1;
        if (tails[m]! < x) lo = m + 1;
        else hi = m;
      }
      tails[lo] = x;
    }
    return seq.length - tails.length;
  },
  reference: {
    javascript: () =>
      `function moves(prev, next) {\n  const pos = new Map(prev.map((k, i) => [k, i]));\n  const tails = [];\n  for (const k of next) {\n    const x = pos.get(k);\n    let lo = 0, hi = tails.length;\n    while (lo < hi) { const m = (lo + hi) >> 1; if (tails[m] < x) lo = m + 1; else hi = m; }\n    tails[lo] = x;\n  }\n  return next.length - tails.length;\n}\n`,
  },
};

// ---------------------------------------------------------------- 11. truncate on word boundary

const truncate: CodeTemplate<{ max: number }> = {
  id: "fe-code-truncate",
  specialization: "frontend",
  kind: "code",
  title: "Обрезка текста по словам",
  skills: ["javascript", "строки"],
  b: -1.0,
  a: 1.0,
  languages: [...JS],
  params: (rng) => ({ max: rng.pick([20, 30, 40]) }),
  twin: { key: "max", alt: (pp, rng) => ({ max: other(rng, [20, 30, 40], pp.max) }) },
  statement: (pp, t) => [
    p("Превью карточки ограничено ", t.v("max", pp.max), " символами. Напишите ", c("cut(text)"), ": если текст укладывается в лимит — верните как есть. Иначе оставьте наибольшее число целых слов (слова разделены одиночными пробелами), чтобы вместе с символом ", c("…"), " длина не превышала лимит, и добавьте ", c("…"), ". Если даже первое слово не помещается — обрежьте его посимвольно до лимита − 1 и добавьте ", c("…"), "."),
  ],
  fn: { name: "cut", args: [{ name: "text", type: "string" }], returns: "string" },
  examples: () => [["Короткий текст"], ["Очень длинное описание карточки товара, которое не помещается в превью"]],
  hidden: (_pp, rng) => {
    const gen = (n: number) => Array.from({ length: n }, () => rng.pick(WORDS)).join(" ");
    return [[gen(2)], [gen(8)], [gen(15)], ["a".repeat(60)], [""], [gen(4)]];
  },
  solve: (pp, [text]) => {
    const t = text as string;
    if (t.length <= pp.max) return t;
    let out = "";
    for (const w of t.split(" ")) {
      const next = out ? `${out} ${w}` : w;
      if (next.length + 1 > pp.max) break;
      out = next;
    }
    return (out || t.slice(0, pp.max - 1)) + "…";
  },
  reference: {
    javascript: (pp) =>
      `function cut(text) {\n  if (text.length <= ${pp.max}) return text;\n  let out = "";\n  for (const w of text.split(" ")) {\n    const next = out ? out + " " + w : w;\n    if (next.length + 1 > ${pp.max}) break;\n    out = next;\n  }\n  return (out || text.slice(0, ${pp.max - 1})) + "…";\n}\n`,
  },
};

export const frontendCode = [debounce, throttle, query, flatten, price, virtualList, deepGet, classNames, keyedDiff, minMoves, truncate] as CodeTemplate[];
