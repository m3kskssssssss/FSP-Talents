import { GRADE_TITLES, SPECIALIZATION_TITLES, WORK_FORMAT_TITLES, type Grade, type Specialization, type WorkFormat } from "@/server/config";

export const specTitle = (s: string) => SPECIALIZATION_TITLES[s as Specialization] ?? s;
export const gradeTitle = (g: string) => GRADE_TITLES[g as Grade] ?? g;
export const formatTitle = (f: string | null | undefined) => (f ? (WORK_FORMAT_TITLES[f as WorkFormat] ?? f) : "Любой");
export const categoryTitle = (s: string, g: string) => `${specTitle(s)} · ${gradeTitle(g)}`;

const rub = new Intl.NumberFormat("ru-RU");
export const money = (n: number | null | undefined) => (n == null ? "—" : `${rub.format(n)} ₽`);
// All salaries on the platform are gross (before personal income tax); the label says so everywhere.
export const SALARY_BASIS = "до НДФЛ";
export const salaryRange = (from: number | null | undefined, to: number | null | undefined) =>
  from == null && to == null
    ? "не указаны"
    : `${from === to ? money(from) : `${rub.format(from ?? 0)} – ${money(to)}`} ${SALARY_BASIS}`;

export const date = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }) : "—";
export const dateTime = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

export const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};
