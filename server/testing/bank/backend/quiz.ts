import type { QuizTemplate } from "../../types";
import { c, p } from "../util";

const METHODS = [
  { m: "GET", ok: true },
  { m: "PUT", ok: true },
  { m: "DELETE", ok: true },
  { m: "HEAD", ok: true },
  { m: "OPTIONS", ok: true },
  { m: "POST", ok: false },
  { m: "PATCH", ok: false },
];

const idempotent: QuizTemplate<{ set: { m: string; ok: boolean }[] }> = {
  id: "be-quiz-idempotent",
  specialization: "backend",
  kind: "quiz",
  title: "Идемпотентные методы HTTP",
  skills: ["http"],
  b: -1.3,
  a: 0.9,
  multi: true,
  params: (rng) => ({
    set: [...rng.sample(METHODS.filter((x) => x.ok), 3), ...rng.sample(METHODS.filter((x) => !x.ok), rng.int(1, 2))],
  }),
  statement: () => [p("Какие из перечисленных методов HTTP идемпотентны по RFC 9110? Отметьте все подходящие.")],
  options: (pp) => pp.set.map((x) => ({ text: x.m, correct: x.ok })),
};

const SCENARIOS = [
  { s: "Ресурс успешно создан, в ответе — его URL в заголовке Location", code: 201 },
  { s: "Запрос синтаксически корректен, но email в теле уже занят другим пользователем по бизнес-правилу", code: 409 },
  { s: "Клиент не передал токен доступа", code: 401 },
  { s: "Токен валиден, но у пользователя нет прав на этот ресурс", code: 403 },
  { s: "Клиент превысил лимит запросов в минуту", code: 429 },
  { s: "Тело запроса прошло парсинг JSON, но поле «зарплата от» больше поля «до»", code: 422 },
  { s: "Запрос принят в обработку, результат будет готов позже", code: 202 },
];
const ALL_CODES = [200, 201, 202, 204, 400, 401, 403, 404, 409, 422, 429, 500];

const statusCode: QuizTemplate<{ i: number; distractors: number[] }> = {
  id: "be-quiz-status-code",
  specialization: "backend",
  kind: "quiz",
  title: "Код ответа API",
  skills: ["http", "api"],
  b: -1.8,
  a: 0.8,
  params: (rng) => {
    const i = rng.int(0, SCENARIOS.length - 1);
    return { i, distractors: rng.sample(ALL_CODES.filter((x) => x !== SCENARIOS[i]!.code), 3) };
  },
  statement: (pp) => [p("Какой код ответа REST API наиболее уместен в ситуации:"), p({ b: SCENARIOS[pp.i]!.s })],
  options: (pp) => [
    { text: String(SCENARIOS[pp.i]!.code), correct: true },
    ...pp.distractors.map((d) => ({ text: String(d), correct: false })),
  ],
};

const ANOMALIES = [
  { a: "грязное чтение (dirty read)", level: "READ COMMITTED" },
  { a: "неповторяющееся чтение (non-repeatable read)", level: "REPEATABLE READ" },
  { a: "фантомное чтение (phantom read)", level: "SERIALIZABLE" },
];
const LEVELS = ["READ UNCOMMITTED", "READ COMMITTED", "REPEATABLE READ", "SERIALIZABLE"];

const isolation: QuizTemplate<{ i: number }> = {
  id: "be-quiz-isolation",
  specialization: "backend",
  kind: "quiz",
  title: "Уровни изоляции транзакций",
  skills: ["sql", "транзакции"],
  b: 0.9,
  a: 1.1,
  params: (rng) => ({ i: rng.int(0, ANOMALIES.length - 1) }),
  statement: (pp) => [
    p("По стандарту SQL какой ", { b: "минимальный" }, " уровень изоляции гарантированно исключает аномалию «", ANOMALIES[pp.i]!.a, "»?"),
  ],
  options: (pp) => LEVELS.map((l) => ({ text: l, correct: l === ANOMALIES[pp.i]!.level })),
};

const COLS = [
  ["user_id", "status", "created_at"],
  ["tenant_id", "kind", "price"],
  ["city", "category", "rating"],
];

const compositeIndex: QuizTemplate<{ cols: string[] }> = {
  id: "be-quiz-composite-index",
  specialization: "backend",
  kind: "quiz",
  title: "Составной индекс",
  skills: ["sql", "индексы", "postgresql"],
  b: 0.3,
  a: 1.2,
  params: (rng) => ({ cols: rng.pick(COLS) }),
  statement: (pp) => [
    p("В PostgreSQL на таблице создан B-tree индекс ", c(`(${pp.cols.join(", ")})`), ". Для какого условия WHERE этот индекс может использоваться эффективнее всего (поиск по префиксу индекса)?"),
  ],
  options: (pp) => {
    const [a, b, cc] = pp.cols as [string, string, string];
    return [
      { text: `${a} = $1 AND ${b} = $2`, correct: true },
      { text: `${b} = $1 AND ${cc} = $2`, correct: false },
      { text: `${cc} = $1`, correct: false },
      { text: `${b} > $1`, correct: false },
    ];
  },
};

const PATTERNS = [
  { s: "После истечения TTL тысячи запросов одновременно промахиваются мимо кэша по одному ключу и идут в БД", a: "Single-flight / блокировка на пересчёт значения" },
  { s: "Нужно гарантировать отправку события в брокер, даже если сервис упал сразу после коммита в БД", a: "Transactional outbox" },
  { s: "Повторная отправка запроса клиентом не должна создавать второй платёж", a: "Ключ идемпотентности" },
  { s: "Зависимость периодически не отвечает, и запросы к ней копятся, исчерпывая пул потоков", a: "Circuit breaker" },
  { s: "Список заказов загружается одним запросом, а затем для каждого заказа отдельно запрашиваются его товары", a: "Устранить N+1: JOIN или пакетная загрузка" },
];

const patterns: QuizTemplate<{ i: number; d: number[] }> = {
  id: "be-quiz-patterns",
  specialization: "backend",
  kind: "quiz",
  title: "Паттерны надёжности",
  skills: ["архитектура", "надёжность"],
  b: 1.4,
  a: 1.0,
  params: (rng) => {
    const i = rng.int(0, PATTERNS.length - 1);
    return { i, d: rng.sample(PATTERNS.map((_, k) => k).filter((k) => k !== i), 3) };
  },
  statement: (pp) => [p("Какое решение лучше всего подходит для проблемы:"), p({ b: PATTERNS[pp.i]!.s })],
  options: (pp) => [{ text: PATTERNS[pp.i]!.a, correct: true }, ...pp.d.map((k) => ({ text: PATTERNS[k]!.a, correct: false }))],
};

export const backendQuiz = [idempotent, statusCode, isolation, compositeIndex, patterns] as QuizTemplate[];
