import type { Rng } from "../../rng";
import type { CalcTemplate, CodeTemplate, QuizTemplate, SqlTemplate } from "../../types";
import { c, intArray, other, p, pad2, scenarioQuiz, sqlStr } from "../util";

const DA = "data" as const;
const PY = ["python"] as const;
const F = { float: 0.0011 } as const;
const floats = (rng: Rng, n: number, lo: number, hi: number) => Array.from({ length: n }, () => Math.round((lo + rng.float() * (hi - lo)) * 10) / 10);

// ================================================================ code (Python)

const meanMedian: CodeTemplate<{ x: number }> = {
  id: "da-code-mean-median",
  specialization: DA,
  kind: "code",
  title: "Среднее и медиана",
  skills: ["python", "статистика"],
  b: -2.0,
  a: 0.9,
  languages: [...PY],
  params: (rng) => ({ x: rng.int(0, 9) }),
  statement: () => [p("Напишите ", c("stats(xs)"), " без numpy/statistics: верните ", c("[mean, median]"), " для непустого списка чисел (медиана чётного списка — среднее двух центральных). Точность сравнения — 0.001.")],
  fn: { name: "stats", args: [{ name: "xs", type: "list[float]" }], returns: "list[float]" },
  examples: (_pp, rng) => [[floats(rng, 5, 0, 100)], [[1, 2, 3, 4]]],
  hidden: (_pp, rng) => [[floats(rng, 7, -50, 50)], [floats(rng, 20, 0, 1000)], [[42]], [floats(rng, 101, 0, 10)], [intArray(rng, 12, 1, 5)]],
  solve: (_pp, [xs]) => {
    const a = [...(xs as number[])].sort((x, y) => x - y);
    const n = a.length;
    const mean = a.reduce((s, x) => s + x, 0) / n;
    const med = n % 2 ? a[(n - 1) / 2]! : (a[n / 2 - 1]! + a[n / 2]!) / 2;
    return [mean, med];
  },
  compare: F,
  reference: { python: () => `def stats(xs):\n    a = sorted(xs)\n    n = len(a)\n    med = a[n // 2] if n % 2 else (a[n // 2 - 1] + a[n // 2]) / 2\n    return [sum(a) / n, med]\n` },
};

const movingAvg: CodeTemplate<{ k: number }> = {
  id: "da-code-moving-average",
  specialization: DA,
  kind: "code",
  title: "Скользящее среднее",
  skills: ["python", "временные ряды"],
  b: -1.1,
  a: 1.1,
  languages: [...PY],
  params: (rng) => ({ k: rng.pick([3, 4, 5, 7]) }),
  twin: { key: "k", alt: (pp, rng) => ({ k: other(rng, [3, 4, 5, 7], pp.k) }) },
  statement: (pp, t) => [p("Напишите ", c("sma(xs)"), ": скользящее среднее с окном ", t.v("k", pp.k), " — список средних для каждого полного окна (длина len(xs) − k + 1; пустой список, если окно не помещается). Точность — 0.001.")],
  fn: { name: "sma", args: [{ name: "xs", type: "list[float]" }], returns: "list[float]" },
  examples: (_pp, rng) => [[floats(rng, 8, 0, 20)]],
  hidden: (_pp, rng) => [[floats(rng, 15, 0, 100)], [floats(rng, 60, -10, 10)], [[1, 2]], [floats(rng, 7, 0, 5)]],
  solve: (pp, [xs]) => {
    const a = xs as number[];
    const out: number[] = [];
    for (let i = 0; i + pp.k <= a.length; i++) out.push(a.slice(i, i + pp.k).reduce((s, x) => s + x, 0) / pp.k);
    return out;
  },
  compare: F,
  reference: { python: (pp) => `def sma(xs):\n    k = ${pp.k}\n    return [sum(xs[i:i + k]) / k for i in range(len(xs) - k + 1)]\n` },
};

const minmax: CodeTemplate<{ lo: number; hi: number }> = {
  id: "da-code-minmax",
  specialization: DA,
  kind: "code",
  title: "Min-max нормализация",
  skills: ["python", "предобработка"],
  b: -1.5,
  a: 1.0,
  languages: [...PY],
  params: (rng) => rng.pick([{ lo: 0, hi: 1 }, { lo: -1, hi: 1 }, { lo: 0, hi: 10 }]),
  twin: { key: "hi", alt: (pp) => ({ ...pp, hi: pp.hi === 1 ? 10 : 1 }) },
  statement: (pp, t) => [p("Напишите ", c("scale(xs)"), ": линейно отобразите значения в отрезок [", t.v("lo", pp.lo), ", ", t.v("hi", pp.hi), "] (минимум → левая граница, максимум → правая). Если все значения равны — верните список из левых границ. Точность — 0.001.")],
  fn: { name: "scale", args: [{ name: "xs", type: "list[float]" }], returns: "list[float]" },
  examples: (_pp, rng) => [[floats(rng, 5, 0, 50)], [[3, 3, 3]]],
  hidden: (_pp, rng) => [[floats(rng, 10, -100, 100)], [floats(rng, 30, 0, 1)], [[7]], [floats(rng, 6, 5, 6)]],
  solve: (pp, [xs]) => {
    const a = xs as number[];
    const mn = Math.min(...a), mx = Math.max(...a);
    return a.map((x) => (mx === mn ? pp.lo : pp.lo + ((x - mn) * (pp.hi - pp.lo)) / (mx - mn)));
  },
  compare: F,
  reference: { python: (pp) => `def scale(xs):\n    mn, mx = min(xs), max(xs)\n    if mx == mn:\n        return [${pp.lo}] * len(xs)\n    return [${pp.lo} + (x - mn) * (${pp.hi} - ${pp.lo}) / (mx - mn) for x in xs]\n` },
};

const precRecall: CodeTemplate<{ pos: number }> = {
  id: "da-code-precision-recall",
  specialization: DA,
  kind: "code",
  title: "Precision и recall",
  skills: ["python", "метрики"],
  b: -0.3,
  a: 1.3,
  languages: [...PY],
  params: (rng) => ({ pos: rng.pick([1, 2]) }),
  twin: { key: "pos", alt: (pp) => ({ pos: pp.pos === 1 ? 2 : 1 }) },
  statement: (pp, t) => [p("Метки классов — 0, 1 и 2. Положительный класс — ", t.v("pos", pp.pos), ". Напишите ", c("pr(y_true, y_pred)"), ": верните ", c("[precision, recall]"), " для положительного класса; если знаменатель равен 0 — соответствующая метрика 0. Точность — 0.001.")],
  fn: { name: "pr", args: [{ name: "y_true", type: "list[int]" }, { name: "y_pred", type: "list[int]" }], returns: "list[float]" },
  examples: (_pp, rng) => [[intArray(rng, 10, 0, 2), intArray(rng, 10, 0, 2)]],
  hidden: (_pp, rng) => {
    const pair = (n: number) => {
      const y = intArray(rng, n, 0, 2);
      return [y, y.map((v) => (rng.bool(0.7) ? v : rng.int(0, 2)))];
    };
    return [pair(20), pair(100), pair(5), [[0, 0], [0, 0]], pair(300)];
  },
  solve: (pp, [yt, yp]) => {
    const t = yt as number[], q = yp as number[];
    let tp = 0, fp = 0, fn = 0;
    t.forEach((v, i) => {
      if (q[i] === pp.pos && v === pp.pos) tp++;
      else if (q[i] === pp.pos) fp++;
      else if (v === pp.pos) fn++;
    });
    return [tp + fp ? tp / (tp + fp) : 0, tp + fn ? tp / (tp + fn) : 0];
  },
  compare: F,
  reference: {
    python: (pp) =>
      `def pr(y_true, y_pred):\n    p = ${pp.pos}\n    tp = sum(1 for t, q in zip(y_true, y_pred) if t == p and q == p)\n    fp = sum(1 for t, q in zip(y_true, y_pred) if t != p and q == p)\n    fn = sum(1 for t, q in zip(y_true, y_pred) if t == p and q != p)\n    return [tp / (tp + fp) if tp + fp else 0, tp / (tp + fn) if tp + fn else 0]\n`,
  },
};

const oneHot: CodeTemplate<{ x: number }> = {
  id: "da-code-one-hot",
  specialization: DA,
  kind: "code",
  title: "One-hot кодирование",
  skills: ["python", "предобработка"],
  b: -0.8,
  a: 1.0,
  languages: [...PY],
  params: (rng) => ({ x: rng.int(0, 9) }),
  statement: () => [p("Напишите ", c("one_hot(values)"), ": категории упорядочены по алфавиту; для каждого значения верните список из 0/1 длины «число уникальных категорий» с единицей на месте своей категории.")],
  fn: { name: "one_hot", args: [{ name: "values", type: "list[str]" }], returns: "list[list[int]]" },
  examples: (_pp, rng) => [[Array.from({ length: 5 }, () => rng.pick(["red", "green", "blue"]))]],
  hidden: (_pp, rng) => [[Array.from({ length: 12 }, () => rng.pick(["msk", "spb", "kzn", "nsk"]))], [["a"]], [[]], [Array.from({ length: 40 }, () => rng.pick(["x", "y", "z", "w", "v"]))]],
  solve: (_pp, [vals]) => {
    const cats = [...new Set(vals as string[])].sort();
    return (vals as string[]).map((v) => cats.map((cc) => (cc === v ? 1 : 0)));
  },
  reference: { python: () => `def one_hot(values):\n    cats = sorted(set(values))\n    return [[1 if c == v else 0 for c in cats] for v in values]\n` },
};

const topGroups: CodeTemplate<{ n: number }> = {
  id: "da-code-groupby-top",
  specialization: DA,
  kind: "code",
  title: "Агрегация и топ групп",
  skills: ["python", "pandas"],
  b: -0.1,
  a: 1.1,
  languages: [...PY],
  params: (rng) => ({ n: rng.int(2, 4) }),
  twin: { key: "n", alt: (pp, rng) => ({ n: other(rng, [2, 3, 4], pp.n) }) },
  statement: (pp, t) => [p("Даны записи ", c("[category, amount]"), ". Напишите ", c("top(rows)"), ": просуммируйте amount по категориям и верните ", t.v("n", pp.n), " категорий с наибольшей суммой — список пар ", c("[category, total]"), " по убыванию total, при равенстве — по алфавиту.")],
  fn: { name: "top", args: [{ name: "rows", type: "list[list]" }], returns: "list[list]" },
  examples: (_pp, rng) => [[Array.from({ length: 8 }, () => [rng.pick(["food", "tech", "books", "toys"]), rng.int(1, 50) * 10])]],
  hidden: (_pp, rng) => {
    const gen = (n: number) => Array.from({ length: n }, () => [rng.pick(["a", "b", "c", "d", "e", "f"]), rng.int(1, 30) * 10]);
    return [[gen(20)], [gen(100)], [gen(1)], [[]], [gen(6)]];
  },
  solve: (pp, [rows]) => {
    const m = new Map<string, number>();
    for (const [k, v] of rows as [string, number][]) m.set(k, (m.get(k) ?? 0) + v);
    return [...m].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, pp.n);
  },
  reference: { python: (pp) => `def top(rows):\n    s = {}\n    for k, v in rows:\n        s[k] = s.get(k, 0) + v\n    return [[k, v] for k, v in sorted(s.items(), key=lambda kv: (-kv[1], kv[0]))[:${pp.n}]]\n` },
};

const knn: CodeTemplate<{ k: number }> = {
  id: "da-code-knn",
  specialization: DA,
  kind: "code",
  title: "k ближайших соседей",
  skills: ["python", "ml"],
  b: 0.8,
  a: 1.3,
  languages: [...PY],
  params: (rng) => ({ k: rng.pick([1, 3, 5]) }),
  twin: { key: "k", alt: (pp, rng) => ({ k: other(rng, [1, 3, 5], pp.k) }) },
  statement: (pp, t) => [
    p("Обучающие точки ", c("[x, y, label]"), " на плоскости. Напишите ", c("predict(points, q)"), ": метка для точки q = [x, y] голосованием ", t.v("k", pp.k), " ближайших соседей (евклидово расстояние; при равных расстояниях раньше идёт точка с меньшим индексом в списке). При равенстве голосов — лексикографически меньшая метка."),
  ],
  fn: { name: "predict", args: [{ name: "points", type: "list[list]" }, { name: "q", type: "list[float]" }], returns: "str" },
  examples: (_pp, rng) => [[Array.from({ length: 8 }, () => [rng.int(0, 10), rng.int(0, 10), rng.pick(["A", "B"])]), [5, 5]]],
  hidden: (_pp, rng) => {
    const gen = (n: number) => [Array.from({ length: n }, () => [rng.int(0, 20), rng.int(0, 20), rng.pick(["A", "B", "C"])]), [rng.int(0, 20), rng.int(0, 20)]];
    return [gen(10), gen(30), gen(6), gen(100), gen(5)];
  },
  solve: (pp, [pts, q]) => {
    const [qx, qy] = q as number[];
    const ds = (pts as [number, number, string][]).map((pt, i) => ({ d: (pt[0] - qx!) ** 2 + (pt[1] - qy!) ** 2, i, l: pt[2] }));
    ds.sort((a, b) => a.d - b.d || a.i - b.i);
    const votes = new Map<string, number>();
    for (const x of ds.slice(0, pp.k)) votes.set(x.l, (votes.get(x.l) ?? 0) + 1);
    return [...votes].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]![0];
  },
  reference: {
    python: (pp) =>
      `def predict(points, q):\n    ds = sorted(range(len(points)), key=lambda i: ((points[i][0] - q[0]) ** 2 + (points[i][1] - q[1]) ** 2, i))\n    votes = {}\n    for i in ds[:${pp.k}]:\n        votes[points[i][2]] = votes.get(points[i][2], 0) + 1\n    return sorted(votes.items(), key=lambda kv: (-kv[1], kv[0]))[0][0]\n`,
  },
};

const linreg: CodeTemplate<{ x: number }> = {
  id: "da-code-linreg",
  specialization: DA,
  kind: "code",
  title: "Линейная регрессия МНК",
  skills: ["python", "статистика", "ml"],
  b: 1.3,
  a: 1.2,
  languages: [...PY],
  params: (rng) => ({ x: rng.int(0, 9) }),
  statement: () => [p("Напишите ", c("fit(xs, ys)"), " без библиотек: коэффициенты простой линейной регрессии y = a·x + b методом наименьших квадратов, верните ", c("[a, b]"), ". Гарантируется, что не все x равны. Точность — 0.001.")],
  fn: { name: "fit", args: [{ name: "xs", type: "list[float]" }, { name: "ys", type: "list[float]" }], returns: "list[float]" },
  examples: (_pp, rng) => {
    const xs = intArray(rng, 5, 0, 10);
    xs[0] = 0;
    xs[1] = 10;
    return [[xs, xs.map((x) => 2 * x + 1)]];
  },
  hidden: (_pp, rng) => {
    const gen = (n: number) => {
      const xs = floats(rng, n, -10, 10);
      xs[0] = -10;
      xs[1] = 10;
      const a = rng.float() * 4 - 2, b = rng.float() * 10;
      return [xs, xs.map((x) => Math.round((a * x + b + rng.normal()) * 100) / 100)];
    };
    return [gen(10), gen(50), gen(3), gen(200)];
  },
  solve: (_pp, [xs, ys]) => {
    const x = xs as number[], y = ys as number[];
    const n = x.length;
    const mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n;
    let sxy = 0, sxx = 0;
    x.forEach((v, i) => {
      sxy += (v - mx) * (y[i]! - my);
      sxx += (v - mx) ** 2;
    });
    const a = sxy / sxx;
    return [a, my - a * mx];
  },
  compare: F,
  reference: {
    python: () =>
      `def fit(xs, ys):\n    n = len(xs)\n    mx, my = sum(xs) / n, sum(ys) / n\n    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))\n    sxx = sum((x - mx) ** 2 for x in xs)\n    a = sxy / sxx\n    return [a, my - a * mx]\n`,
  },
};

const entropy: CodeTemplate<{ x: number }> = {
  id: "da-code-entropy",
  specialization: DA,
  kind: "code",
  title: "Энтропия разбиения",
  skills: ["python", "ml"],
  b: 0.4,
  a: 1.2,
  languages: [...PY],
  params: (rng) => ({ x: rng.int(0, 9) }),
  statement: () => [p("Напишите ", c("gain(labels, mask)"), ": информационный выигрыш (по энтропии с log2) от разбиения выборки labels на две части по булевому списку mask: H(все) − взвешенная сумма H(частей). Энтропия пустой части = 0. Точность — 0.001.")],
  fn: { name: "gain", args: [{ name: "labels", type: "list[str]" }, { name: "mask", type: "list[bool]" }], returns: "float" },
  examples: (_pp, rng) => {
    const l = Array.from({ length: 6 }, () => rng.pick(["y", "n"]));
    return [[l, l.map((v) => (v === "y" ? rng.bool(0.8) : rng.bool(0.2)))]];
  },
  hidden: (_pp, rng) => {
    const gen = (n: number) => {
      const l = Array.from({ length: n }, () => rng.pick(["a", "b", "c"]));
      return [l, l.map((v) => (v === "a" ? rng.bool(0.8) : rng.bool(0.3)))];
    };
    return [gen(10), gen(50), gen(2), gen(200), [["a", "a"], [true, false]]];
  },
  solve: (_pp, [labels, mask]) => {
    const H = (xs: string[]) => {
      if (!xs.length) return 0;
      const m = new Map<string, number>();
      for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
      return -[...m.values()].reduce((s, k) => s + (k / xs.length) * Math.log2(k / xs.length), 0);
    };
    const l = labels as string[], mk = mask as boolean[];
    const L = l.filter((_, i) => mk[i]), R = l.filter((_, i) => !mk[i]);
    return H(l) - (L.length / l.length) * H(L) - (R.length / l.length) * H(R);
  },
  compare: F,
  reference: {
    python: () =>
      `import math\n\ndef H(xs):\n    if not xs:\n        return 0.0\n    return -sum((xs.count(v) / len(xs)) * math.log2(xs.count(v) / len(xs)) for v in set(xs))\n\ndef gain(labels, mask):\n    L = [l for l, m in zip(labels, mask) if m]\n    R = [l for l, m in zip(labels, mask) if not m]\n    n = len(labels)\n    return H(labels) - len(L) / n * H(L) - len(R) / n * H(R)\n`,
  },
};

const iqr: CodeTemplate<{ k: number }> = {
  id: "da-code-iqr-outliers",
  specialization: DA,
  kind: "code",
  title: "Выбросы по IQR",
  skills: ["python", "статистика"],
  b: 1.7,
  a: 1.1,
  languages: [...PY],
  params: (rng) => ({ k: rng.pick([1.5, 2, 3]) }),
  twin: { key: "k", alt: (pp, rng) => ({ k: other(rng, [1.5, 2, 3], pp.k) }) },
  statement: (pp, t) => [
    p("Квартили считаются как медианы половин отсортированного списка (при нечётной длине центральный элемент не входит ни в одну половину). Выброс — значение вне [Q1 − k·IQR, Q3 + k·IQR], k = ", t.v("k", pp.k), "."),
    p("Напишите ", c("outliers(xs)"), " (len ≥ 4): верните выбросы в исходном порядке."),
  ],
  fn: { name: "outliers", args: [{ name: "xs", type: "list[float]" }], returns: "list[float]" },
  examples: () => [[[1, 2, 3, 4, 5, 6, 7, 100]]],
  hidden: (_pp, rng) => {
    const gen = (n: number) => {
      const xs = floats(rng, n, 10, 20);
      // Mix of extreme and moderate outliers, so that k matters.
      for (let i = 0; i < rng.int(1, 4); i++) xs[rng.int(0, n - 1)] = rng.pick([-50, 90, 26, 28, 31, 4, 1]);
      return [xs];
    };
    return [gen(9), gen(20), gen(4), gen(101), gen(15)];
  },
  solve: (pp, [xs]) => {
    const a = xs as number[];
    const s = [...a].sort((x, y) => x - y);
    const med = (v: number[]) => (v.length % 2 ? v[(v.length - 1) / 2]! : (v[v.length / 2 - 1]! + v[v.length / 2]!) / 2);
    const h = Math.floor(s.length / 2);
    const q1 = med(s.slice(0, h)), q3 = med(s.slice(s.length - h));
    const r = q3 - q1;
    return a.filter((x) => x < q1 - pp.k * r || x > q3 + pp.k * r);
  },
  reference: {
    python: (pp) =>
      `def med(v):\n    n = len(v)\n    return v[n // 2] if n % 2 else (v[n // 2 - 1] + v[n // 2]) / 2\n\ndef outliers(xs):\n    s = sorted(xs)\n    h = len(s) // 2\n    q1, q3 = med(s[:h]), med(s[len(s) - h:])\n    r = q3 - q1\n    return [x for x in xs if x < q1 - ${pp.k} * r or x > q3 + ${pp.k} * r]\n`,
  },
};

// ================================================================ SQL

const EVENTS_SCHEMA = `CREATE TABLE events (
  user_id INTEGER NOT NULL,
  event TEXT NOT NULL,      -- 'visit' | 'view' | 'cart' | 'buy'
  amount INTEGER NOT NULL,  -- рубли, > 0 только для 'buy'
  day TEXT NOT NULL         -- 'YYYY-MM-DD'
);`;

function eventsData(rng: Rng, size: "public" | "hidden") {
  const users = size === "public" ? 6 : rng.int(20, 40);
  const n = size === "public" ? 25 : rng.int(150, 300);
  const lines: string[] = [];
  for (let i = 0; i < n; i++) {
    const ev = rng.pick(["visit", "visit", "view", "view", "cart", "buy"]);
    lines.push(`INSERT INTO events VALUES (${rng.int(1, users)}, ${sqlStr(ev)}, ${ev === "buy" ? rng.int(1, 50) * 100 : 0}, '2026-03-${pad2(rng.int(1, 14))}');`);
  }
  return lines.join("\n");
}

const sqlBase = { specialization: DA, kind: "sql" as const, schema: EVENTS_SCHEMA, data: (_pp: unknown, rng: Rng, size: "public" | "hidden") => eventsData(rng, size) };

const dau: SqlTemplate<{ ev: string }> = {
  ...sqlBase,
  id: "da-sql-dau",
  title: "Активные пользователи по дням",
  skills: ["sql"],
  b: -1.6,
  a: 1.0,
  params: (rng) => ({ ev: rng.pick(["visit", "view"]) }),
  statement: (pp) => [p("Посчитайте число уникальных пользователей с событием ", c(`'${pp.ev}'`), " по дням. Столбцы: ", c("day"), ", ", c("users"), "; сортировка по day.")],
  reference: (pp) => `SELECT day, COUNT(DISTINCT user_id) AS users FROM events WHERE event = '${pp.ev}' GROUP BY day ORDER BY day`,
  ordered: true,
};

const conversion: SqlTemplate<{ from: string }> = {
  ...sqlBase,
  id: "da-sql-conversion",
  title: "Конверсия в покупку",
  skills: ["sql", "аналитика"],
  b: 0.5,
  a: 1.3,
  params: (rng) => ({ from: rng.pick(["view", "cart"]) }),
  statement: (pp) => [
    p("Конверсия = доля пользователей с событием ", c(`'${pp.from}'`), ", у которых есть хотя бы одно событие ", c("'buy'"), " (в любой день). Верните одно число в столбце ", c("conversion"), " — дробь от 0 до 1, округлённую до 3 знаков (ROUND)."),
  ],
  reference: (pp) =>
    `SELECT ROUND(1.0 * COUNT(DISTINCT CASE WHEN user_id IN (SELECT user_id FROM events WHERE event = 'buy') THEN user_id END) / COUNT(DISTINCT user_id), 3) AS conversion FROM events WHERE event = '${pp.from}'`,
  ordered: true,
};

const avgCheck: SqlTemplate<{ min: number }> = {
  ...sqlBase,
  id: "da-sql-avg-check",
  title: "Средний чек покупателей",
  skills: ["sql"],
  b: -0.6,
  a: 1.1,
  params: (rng) => ({ min: rng.int(1, 3) }),
  twin: { key: "min", alt: (pp, rng) => ({ min: other(rng, [1, 2, 3], pp.min) }) },
  statement: (pp, t) => [p("Для пользователей, совершивших не меньше ", t.v("min", pp.min), " покупок (event = 'buy'), посчитайте число покупок и средний чек (AVG(amount), ROUND до 1 знака). Столбцы: ", c("user_id"), ", ", c("purchases"), ", ", c("avg_check"), "; сортировка по user_id.")],
  reference: (pp) => `SELECT user_id, COUNT(*) AS purchases, ROUND(AVG(amount), 1) AS avg_check FROM events WHERE event = 'buy' GROUP BY user_id HAVING COUNT(*) >= ${pp.min} ORDER BY user_id`,
  ordered: true,
};

const cumulative: SqlTemplate<{ x: number }> = {
  ...sqlBase,
  id: "da-sql-cumulative-revenue",
  title: "Накопительная выручка",
  skills: ["sql", "оконные функции"],
  b: 1.1,
  a: 1.3,
  params: (rng) => ({ x: rng.int(0, 5) }),
  statement: () => [p("Посчитайте выручку (сумма amount по 'buy') по дням и накопительную выручку с начала периода. Столбцы: ", c("day"), ", ", c("revenue"), ", ", c("cumulative"), "; только дни с покупками, сортировка по day.")],
  reference: () => `SELECT day, SUM(amount) AS revenue, SUM(SUM(amount)) OVER (ORDER BY day) AS cumulative FROM events WHERE event = 'buy' GROUP BY day ORDER BY day`,
  ordered: true,
};

const firstBuy: SqlTemplate<{ x: number }> = {
  ...sqlBase,
  id: "da-sql-first-purchase",
  title: "Дни до первой покупки",
  skills: ["sql", "аналитика"],
  b: 2.0,
  a: 1.2,
  params: (rng) => ({ x: rng.int(0, 5) }),
  statement: () => [
    p("Для каждого пользователя, у которого была покупка, найдите число дней от его первого события любого типа до первой покупки (julianday). Столбцы: ", c("user_id"), ", ", c("days"), " (целое); сортировка по user_id."),
  ],
  reference: () =>
    `SELECT user_id, CAST(julianday(MIN(CASE WHEN event = 'buy' THEN day END)) - julianday(MIN(day)) AS INTEGER) AS days FROM events GROUP BY user_id HAVING MIN(CASE WHEN event = 'buy' THEN day END) IS NOT NULL ORDER BY user_id`,
  ordered: true,
};

// ================================================================ calc

const f1: CalcTemplate<{ tp: number; fp: number; fn: number }> = {
  id: "da-calc-f1",
  specialization: DA,
  kind: "calc",
  title: "F1-мера",
  skills: ["метрики"],
  b: -0.9,
  a: 1.1,
  params: (rng) => ({ tp: rng.int(20, 90), fp: rng.int(5, 40), fn: rng.int(5, 40) }),
  twin: { key: "fp", alt: (pp) => ({ ...pp, fp: pp.fp + 17 }) },
  statement: (pp, t) => [p("Классификатор на тесте: TP = ", t.v("tp", pp.tp), ", FP = ", t.v("fp", pp.fp), ", FN = ", t.v("fn", pp.fn), ". Чему равна F1-мера? Округлите до трёх знаков.")],
  answer: (pp) => Math.round(((2 * pp.tp) / (2 * pp.tp + pp.fp + pp.fn)) * 1000) / 1000,
  answerHint: "Число от 0 до 1 с тремя знаками, например 0.812",
  tolerance: 0.0011,
};

const bayes: CalcTemplate<{ prior: number; sens: number; fpr: number }> = {
  id: "da-calc-bayes",
  specialization: DA,
  kind: "calc",
  title: "Теорема Байеса",
  skills: ["статистика"],
  b: 1.4,
  a: 1.2,
  params: (rng) => ({ prior: rng.pick([1, 2, 5]), sens: rng.pick([90, 95, 99]), fpr: rng.pick([2, 5, 10]) }),
  twin: { key: "prior", alt: (pp, rng) => ({ ...pp, prior: other(rng, [1, 2, 5], pp.prior) }) },
  statement: (pp, t) => [p("Антифрод-модель: мошеннических транзакций ", t.v("prior", pp.prior), "%. Модель ловит ", t.v("sens", pp.sens), "% мошеннических и ошибочно помечает ", t.v("fpr", pp.fpr), "% честных. Какова вероятность (в %), что помеченная транзакция действительно мошенническая? Округлите до одного знака.")],
  answer: (pp) => {
    const tp = (pp.prior / 100) * (pp.sens / 100);
    const fp = (1 - pp.prior / 100) * (pp.fpr / 100);
    return Math.round((tp / (tp + fp)) * 1000) / 10;
  },
  answerHint: "Проценты с одним знаком, например 16.1",
  tolerance: 0.11,
};

const lift: CalcTemplate<{ na: number; ca: number; nb: number; cb: number }> = {
  id: "da-calc-ab-lift",
  specialization: DA,
  kind: "calc",
  title: "Прирост конверсии в A/B-тесте",
  skills: ["аналитика", "статистика"],
  b: -1.7,
  a: 0.9,
  params: (rng) => ({ na: rng.pick([1000, 2000, 5000]), ca: rng.int(40, 120), nb: rng.pick([1000, 2000, 5000]), cb: rng.int(50, 150) }),
  twin: { key: "cb", alt: (pp) => ({ ...pp, cb: pp.cb + 23 }) },
  statement: (pp, t) => [
    p("Контроль: ", t.v("na", pp.na), " пользователей, ", t.v("ca", pp.ca), " покупок. Тест: ", t.v("nb", pp.nb), " пользователей, ", t.v("cb", pp.cb), " покупок."),
    p("На сколько процентов (относительно) конверсия теста выше конверсии контроля? Округлите до одного знака (отрицательное — если ниже)."),
  ],
  answer: (pp) => Math.round(((pp.cb / pp.nb / (pp.ca / pp.na)) - 1) * 1000) / 10,
  answerHint: "Проценты с одним знаком, например 12.5",
  tolerance: 0.11,
};

const zscore: CalcTemplate<{ xs: number[]; k: number }> = {
  id: "da-calc-zscore",
  specialization: DA,
  kind: "calc",
  title: "z-оценка",
  skills: ["статистика"],
  b: 0.0,
  a: 1.0,
  params: (rng) => ({ xs: intArray(rng, 6, 10, 30), k: rng.int(0, 5) }),
  statement: (pp) => [
    p("Время ответа сервиса (мс):"),
    { type: "code", text: pp.xs.join(", ") },
    p("Вычислите z-оценку значения ", c(pp.xs[pp.k]!), " (среднее и стандартное отклонение генеральной совокупности, делитель n). Округлите до двух знаков."),
  ],
  answer: (pp) => {
    const m = pp.xs.reduce((s, x) => s + x, 0) / pp.xs.length;
    const sd = Math.sqrt(pp.xs.reduce((s, x) => s + (x - m) ** 2, 0) / pp.xs.length);
    return Math.round(((pp.xs[pp.k]! - m) / sd) * 100) / 100;
  },
  answerHint: "Число с двумя знаками, например -0.87",
  tolerance: 0.011,
};

const rmse: CalcTemplate<{ y: number[]; e: number[] }> = {
  id: "da-calc-rmse",
  specialization: DA,
  kind: "calc",
  title: "RMSE прогноза",
  skills: ["метрики"],
  b: -0.4,
  a: 1.0,
  params: (rng) => {
    const y = intArray(rng, 5, 10, 40);
    return { y, e: y.map((v) => v + rng.int(-4, 4)) };
  },
  twin: { key: "e.0", alt: (pp) => ({ ...pp, e: [pp.e[0]! + 9, ...pp.e.slice(1)] }) },
  statement: (pp, t) => [
    p("Факт и прогноз продаж:"),
    { type: "table", head: ["Факт", "Прогноз"], rows: pp.y.map((v, i) => [String(v), i === 0 ? t.v("e.0", pp.e[0]!) : String(pp.e[i])]) },
    p("Чему равна RMSE? Округлите до двух знаков."),
  ],
  answer: (pp) => Math.round(Math.sqrt(pp.y.reduce((s, v, i) => s + (v - pp.e[i]!) ** 2, 0) / pp.y.length) * 100) / 100,
  answerHint: "Число с двумя знаками",
  tolerance: 0.011,
};

const sampleSize: CalcTemplate<{ n: number; p: number }> = {
  id: "da-calc-std-error",
  specialization: DA,
  kind: "calc",
  title: "Стандартная ошибка доли",
  skills: ["статистика"],
  b: 2.3,
  a: 1.1,
  params: (rng) => ({ n: rng.pick([400, 900, 1600, 2500]), p: rng.pick([10, 20, 30, 50]) }),
  twin: { key: "n", alt: (pp, rng) => ({ ...pp, n: other(rng, [400, 900, 1600, 2500], pp.n) }) },
  statement: (pp, t) => [p("В выборке из ", t.v("n", pp.n), " пользователей конверсия ", t.v("p", pp.p), "%. Какова полуширина 95%-го доверительного интервала (z = 1.96) в процентных пунктах? Используйте нормальное приближение; округлите до двух знаков.")],
  answer: (pp) => Math.round(1.96 * Math.sqrt(((pp.p / 100) * (1 - pp.p / 100)) / pp.n) * 10000) / 100,
  answerHint: "Процентные пункты с двумя знаками, например 1.96",
  tolerance: 0.011,
};

// ================================================================ quiz

const leakage = scenarioQuiz({
  id: "da-quiz-leakage",
  specialization: DA,
  title: "Утечка данных в ML",
  skills: ["ml"],
  b: 0.9,
  a: 1.2,
  question: "Что не так с экспериментом?",
  scenarios: [
    { s: "Нормализацию (StandardScaler) обучили на всём датасете, а потом разбили его на train и test", a: "Утечка: статистики теста попали в обучение" },
    { s: "Для прогноза оттока используется признак «дата закрытия договора»", a: "Утечка целевой переменной через признак из будущего" },
    { s: "Временной ряд разбили на train и test случайным перемешиванием", a: "Нарушен порядок времени: нужно разбиение по дате" },
    { s: "Гиперпараметры подбирали по качеству на тестовой выборке и там же отчитались о метрике", a: "Переобучение на тест: нужна отдельная валидация" },
  ],
});

const metricChoice = scenarioQuiz({
  id: "da-quiz-metric-choice",
  specialization: DA,
  title: "Выбор метрики",
  skills: ["метрики", "ml"],
  b: -0.2,
  a: 1.1,
  question: "Какую метрику выбрать в первую очередь?",
  scenarios: [
    { s: "Мошенничество — 0.3% транзакций, важно ранжировать подозрительные выше", a: "PR-AUC" },
    { s: "Прогноз выручки магазина, крупные ошибки особенно болезненны", a: "RMSE" },
    { s: "Прогноз времени доставки, нужна устойчивость к редким выбросам", a: "MAE" },
    { s: "Классы сбалансированы, цена ошибок одинакова", a: "Accuracy" },
    { s: "Рекомендации: важно, чтобы релевантные товары были в верхней части выдачи", a: "nDCG@k" },
  ],
});

const overfit = scenarioQuiz({
  id: "da-quiz-overfitting",
  specialization: DA,
  title: "Переобучение",
  skills: ["ml"],
  b: -1.2,
  a: 1.0,
  question: "Что вероятнее всего происходит с моделью?",
  scenarios: [
    { s: "Качество на train 0.99, на валидации 0.71, и разрыв растёт с глубиной деревьев", a: "Переобучение" },
    { s: "Качество на train и валидации одинаково низкое — 0.55", a: "Недообучение" },
    { s: "Качество на валидации хорошее, а в проде через месяц резко упало", a: "Дрейф данных" },
    { s: "Метрика на валидации сильно скачет между запусками с разным seed", a: "Высокая дисперсия оценки: мало данных для валидации" },
  ],
});

const joins = scenarioQuiz({
  id: "da-quiz-joins",
  specialization: DA,
  title: "Соединения таблиц",
  skills: ["sql"],
  b: -2.2,
  a: 0.9,
  question: "Какой JOIN нужен?",
  scenarios: [
    { s: "Все пользователи, включая тех, у кого нет заказов (их сумма = 0)", a: "LEFT JOIN users → orders" },
    { s: "Только пользователи, у которых есть заказы", a: "INNER JOIN" },
    { s: "Все пары «товар × склад» для матрицы остатков", a: "CROSS JOIN" },
    { s: "Сопоставить два справочника и увидеть записи, отсутствующие в любом из них", a: "FULL OUTER JOIN" },
  ],
});

const scaling = scenarioQuiz({
  id: "da-quiz-scaling",
  specialization: DA,
  title: "Подготовка признаков",
  skills: ["ml", "предобработка"],
  b: 1.9,
  a: 1.0,
  question: "Какой шаг подготовки признаков важнее всего здесь?",
  scenarios: [
    { s: "kNN по признакам «возраст» (лет) и «доход» (рубли)", a: "Масштабирование признаков" },
    { s: "Градиентный бустинг по деревьям с числовыми признаками в разных шкалах", a: "Масштабирование не обязательно" },
    { s: "Линейная модель с категориальным признаком «город» из 40 значений", a: "One-hot или target-кодирование" },
    { s: "Признак «сумма покупки» с тяжёлым правым хвостом в линейной регрессии", a: "Логарифмирование признака" },
  ],
});

export const dataBank = [
  meanMedian, movingAvg, minmax, precRecall, oneHot, topGroups, knn, linreg, entropy, iqr,
  dau, conversion, avgCheck, cumulative, firstBuy,
  f1, bayes, lift, zscore, rmse, sampleSize,
  leakage, metricChoice, overfit, joins, scaling,
] as (CodeTemplate | SqlTemplate | CalcTemplate | QuizTemplate)[];
