import type { Rng } from "../../rng";
import type { SqlTemplate } from "../../types";
import { c, CITIES, DEPARTMENTS, FIRST_NAMES, other, p, pad2, sqlStr } from "../util";

export const SHOP_SCHEMA = `CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  created_at TEXT NOT NULL -- 'YYYY-MM-DD'
);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  amount INTEGER NOT NULL,       -- рубли
  status TEXT NOT NULL,          -- 'paid' | 'new' | 'cancelled' | 'refunded'
  created_at TEXT NOT NULL       -- 'YYYY-MM-DD'
);`;

export const HR_SCHEMA = `CREATE TABLE employees (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  salary INTEGER NOT NULL
);`;

const STATUSES = ["paid", "paid", "paid", "new", "cancelled", "refunded"];

function date(rng: Rng, year = 2025) {
  return `${year}-${pad2(rng.int(1, 12))}-${pad2(rng.int(1, 28))}`;
}

export function shopData(rng: Rng, size: "public" | "hidden") {
  const nUsers = size === "public" ? 6 : rng.int(15, 30);
  const nOrders = size === "public" ? 14 : rng.int(60, 140);
  const cities = rng.sample(CITIES, size === "public" ? 3 : 5);
  const lines: string[] = [];
  for (let i = 1; i <= nUsers; i++) {
    lines.push(
      `INSERT INTO users VALUES (${i}, ${sqlStr(`${rng.pick(FIRST_NAMES)} ${i}`)}, ${sqlStr(rng.pick(cities))}, ${sqlStr(date(rng, 2024))});`,
    );
  }
  for (let i = 1; i <= nOrders; i++) {
    lines.push(
      `INSERT INTO orders VALUES (${i}, ${rng.int(1, nUsers)}, ${rng.int(1, 60) * 100}, ${sqlStr(rng.pick(STATUSES))}, ${sqlStr(date(rng))});`,
    );
  }
  return lines.join("\n");
}

export function hrData(rng: Rng, size: "public" | "hidden") {
  const n = size === "public" ? 10 : rng.int(25, 50);
  const deps = rng.sample(DEPARTMENTS, size === "public" ? 3 : 5);
  const lines: string[] = [];
  for (let i = 1; i <= n; i++) {
    lines.push(
      `INSERT INTO employees VALUES (${i}, ${sqlStr(`${rng.pick(FIRST_NAMES)} ${i}`)}, ${sqlStr(rng.pick(deps))}, ${rng.int(8, 40) * 10000});`,
    );
  }
  return lines.join("\n");
}

const statusCount: SqlTemplate<{ min: number }> = {
  id: "be-sql-status-count",
  specialization: "backend",
  kind: "sql",
  title: "Заказы по статусам",
  skills: ["sql"],
  b: -1.2,
  a: 1.1,
  schema: SHOP_SCHEMA,
  params: (rng) => ({ min: rng.pick([1000, 1500, 2000, 3000]) }),
  twin: { key: "min", alt: (pp, rng) => ({ min: other(rng, [1000, 1500, 2000, 3000], pp.min) }) },
  statement: (pp, t) => [
    p("Посчитайте количество заказов каждого статуса среди заказов на сумму ", { b: "не меньше" }, " ", t.v("min", pp.min), " ₽."),
    p("Столбцы результата: ", c("status"), ", ", c("cnt"), ". Сортировка: по cnt по убыванию, затем по status по возрастанию."),
  ],
  data: (_pp, rng, size) => shopData(rng, size),
  reference: (pp) =>
    `SELECT status, COUNT(*) AS cnt FROM orders WHERE amount >= ${pp.min} GROUP BY status ORDER BY cnt DESC, status`,
  ordered: true,
};

const cityRevenue: SqlTemplate<{ min: number }> = {
  id: "be-sql-city-revenue",
  specialization: "backend",
  kind: "sql",
  title: "Выручка по городам",
  skills: ["sql", "join"],
  b: -0.2,
  a: 1.3,
  schema: SHOP_SCHEMA,
  params: (rng) => ({ min: rng.pick([5000, 8000, 10000, 15000]) }),
  twin: { key: "min", alt: (pp, rng) => ({ min: other(rng, [5000, 8000, 10000, 15000], pp.min) }) },
  statement: (pp, t) => [
    p("Для каждого города посчитайте сумму оплаченных заказов (", c("status = 'paid'"), ") пользователей из этого города. Оставьте только города, где сумма ", { b: "больше" }, " ", t.v("min", pp.min), " ₽."),
    p("Столбцы: ", c("city"), ", ", c("total"), ". Сортировка по total по убыванию, затем по city."),
  ],
  data: (_pp, rng, size) => shopData(rng, size),
  reference: (pp) =>
    `SELECT u.city, SUM(o.amount) AS total FROM orders o JOIN users u ON u.id = o.user_id WHERE o.status = 'paid' GROUP BY u.city HAVING SUM(o.amount) > ${pp.min} ORDER BY total DESC, u.city`,
  ordered: true,
};

const inactive: SqlTemplate<{ month: number }> = {
  id: "be-sql-inactive-users",
  specialization: "backend",
  kind: "sql",
  title: "Неактивные пользователи",
  skills: ["sql", "join"],
  b: 0.5,
  a: 1.4,
  schema: SHOP_SCHEMA,
  params: (rng) => ({ month: rng.int(4, 10) }),
  twin: { key: "month", alt: (pp, rng) => ({ month: other(rng, [4, 5, 6, 7, 8, 9, 10], pp.month) }) },
  statement: (pp, t) => [
    p("Найдите пользователей, у которых нет ни одного заказа (любого статуса), созданного ", { b: "начиная с" }, " 2025-", t.v("month", pad2(pp.month)), "-01."),
    p("Столбцы: ", c("id"), ", ", c("name"), ". Сортировка по id. Пользователи совсем без заказов тоже входят в ответ."),
  ],
  data: (_pp, rng, size) => shopData(rng, size),
  reference: (pp) =>
    `SELECT u.id, u.name FROM users u WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id AND o.created_at >= '2025-${pad2(pp.month)}-01') ORDER BY u.id`,
  ordered: true,
};

const secondSalary: SqlTemplate<{ n: number }> = {
  id: "be-sql-nth-salary",
  specialization: "backend",
  kind: "sql",
  title: "N-я по величине зарплата в отделе",
  skills: ["sql", "оконные функции"],
  b: 1.5,
  a: 1.3,
  schema: HR_SCHEMA,
  params: (rng) => ({ n: rng.pick([2, 3]) }),
  twin: { key: "n", alt: (pp) => ({ n: pp.n === 2 ? 3 : 2 }) },
  statement: (pp, t) => [
    p("Для каждого отдела найдите ", t.v("n", pp.n), "-ю по величине ", { b: "различную" }, " зарплату. Отделы, где различных зарплат меньше, в ответ не входят."),
    p("Столбцы: ", c("department"), ", ", c("salary"), ". Сортировка по department."),
  ],
  data: (_pp, rng, size) => hrData(rng, size),
  reference: (pp) =>
    `SELECT department, salary FROM (SELECT department, salary, DENSE_RANK() OVER (PARTITION BY department ORDER BY salary DESC) AS r FROM (SELECT DISTINCT department, salary FROM employees)) WHERE r = ${pp.n} ORDER BY department`,
  ordered: true,
};

const topUserMonth: SqlTemplate<{ status: string }> = {
  id: "be-sql-top-user-month",
  specialization: "backend",
  kind: "sql",
  title: "Лучший покупатель месяца",
  skills: ["sql", "оконные функции"],
  b: 1.1,
  a: 1.2,
  schema: SHOP_SCHEMA,
  params: (rng) => ({ status: rng.pick(["paid", "new"]) }),
  statement: (pp) => [
    p("Для каждого месяца (формат ", c("YYYY-MM"), " по ", c("orders.created_at"), ") найдите пользователя с наибольшей суммой заказов в статусе ", c(`'${pp.status}'`), ". При равенстве сумм — пользователя с меньшим id."),
    p("Столбцы: ", c("month"), ", ", c("user_id"), ", ", c("total"), ". Сортировка по month."),
  ],
  data: (_pp, rng, size) => shopData(rng, size),
  reference: (pp) =>
    `SELECT month, user_id, total FROM (SELECT substr(created_at, 1, 7) AS month, user_id, SUM(amount) AS total, ROW_NUMBER() OVER (PARTITION BY substr(created_at, 1, 7) ORDER BY SUM(amount) DESC, user_id) AS rn FROM orders WHERE status = '${pp.status}' GROUP BY substr(created_at, 1, 7), user_id) WHERE rn = 1 ORDER BY month`,
  ordered: true,
};

const streak: SqlTemplate<{ n: number }> = {
  id: "be-sql-month-streak",
  specialization: "backend",
  kind: "sql",
  title: "Покупки несколько месяцев подряд",
  skills: ["sql", "оконные функции"],
  b: 2.2,
  a: 1.2,
  schema: SHOP_SCHEMA,
  params: (rng) => ({ n: rng.pick([2, 3]) }),
  twin: { key: "n", alt: (pp) => ({ n: pp.n === 2 ? 3 : 2 }) },
  statement: (pp, t) => [
    p("Найдите пользователей, у которых есть оплаченные заказы (", c("status = 'paid'"), ") как минимум в ", t.v("n", pp.n), " календарных месяцах ", { b: "подряд" }, " (внутри 2025 года)."),
    p("Столбец: ", c("user_id"), ". Каждый пользователь — один раз, сортировка по user_id."),
  ],
  data: (_pp, rng, size) => shopData(rng, size),
  reference: (pp) =>
    `WITH m AS (SELECT DISTINCT user_id, CAST(substr(created_at, 6, 2) AS INTEGER) AS mon FROM orders WHERE status = 'paid'),
g AS (SELECT user_id, mon - ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY mon) AS grp FROM m)
SELECT DISTINCT user_id FROM g GROUP BY user_id, grp HAVING COUNT(*) >= ${pp.n} ORDER BY user_id`,
  ordered: true,
};

export const backendSql = [statusCount, cityRevenue, inactive, secondSalary, topUserMonth, streak] as SqlTemplate[];
