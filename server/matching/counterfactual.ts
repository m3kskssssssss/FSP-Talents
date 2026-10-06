import { WORK_FORMAT_TITLES, type WorkFormat } from "../config";
import { formatCityFit, scoreCandidate, type CandidateInput, type NeedInput } from "./score";

/**
 * "What if" hints for the employer, computed by the same deterministic
 * score. A hint names a conflict among the current top candidates (salary,
 * format, city) and the smallest change of the need that resolves it, with
 * the counts it is based on — as explainable as the ranking itself.
 */
export interface Hint {
  kind: "salary" | "format" | "city";
  text: string;
  /** Top candidates whose conflict the change resolves. */
  resolved: number;
  /** Candidates that would newly enter the top. */
  newInTop: number;
  /** The changed need parameters. */
  change: Partial<Pick<NeedInput, "salaryTo" | "format" | "city">>;
}

type Cand = CandidateInput & { profileId: string };

const rub = (n: number) => `${new Intl.NumberFormat("ru-RU").format(n)} ₽`;
const roundUp = (n: number, step = 5000) => Math.ceil(n / step) * step;
const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10,
    m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
};
const cands = (n: number) => `${n} ${plural(n, "кандидат", "кандидата", "кандидатов")}`;
/** Verb agreement with a number: 1, 21, 31… take the singular. */
const verb = (n: number, one: string, many: string) => (n % 10 === 1 && n % 100 !== 11 ? one : many);

function top(need: NeedInput, pool: Cand[], now: Date, n: number) {
  return pool
    .map((c) => ({ c, m: scoreCandidate(need, c, now).match }))
    .sort((a, b) => b.m - a.m || b.c.score - a.c.score)
    .slice(0, n)
    .map((x) => x.c);
}

const gain = (base: Cand[], next: Cand[]) => {
  const was = new Set(base.map((c) => c.profileId));
  return next.filter((c) => !was.has(c.profileId)).length;
};

/** Within reach: the invitation floor is met and expectations fit under the upper bound. */
export const fitsSalary = (c: CandidateInput, salaryTo: number) => (c.inviteFloor ?? 0) <= salaryTo && (c.salaryFrom ?? 0) <= salaryTo;

export function counterfactualHints(need: NeedInput, pool: Cand[], now = new Date()): Hint[] {
  if (!pool.length) return [];
  const n = Math.min(10, pool.length);
  const base = top(need, pool, now, n);
  const hints: Hint[] = [];
  const topLabel = n === pool.length ? "в подборке" : `в топ-${n}`;

  // 1) Salary: the smallest raise (+10/20/30%) that brings top candidates within reach.
  if (need.salaryTo) {
    const outside = base.filter((c) => !fitsSalary(c, need.salaryTo!));
    for (const pct of [0.1, 0.2, 0.3]) {
      if (!outside.length) break;
      const salaryTo = roundUp(need.salaryTo * (1 + pct));
      const resolved = outside.filter((c) => fitsSalary(c, salaryTo)).length;
      if (resolved > 0) {
        const floors = outside.filter((c) => (c.inviteFloor ?? 0) > need.salaryTo!).length;
        hints.push({
          kind: "salary",
          text:
            `${cands(outside.length)} ${topLabel} ${verb(outside.length, "ждёт", "ждут")} больше верха вилки` +
            (floors ? ` (у ${floors} — порог приглашений, приглашение не дойдёт)` : "") +
            `. При верхе ${rub(salaryTo)} (+${Math.round(pct * 100)}%) в пределы ${verb(resolved, "войдёт", "войдут")} ${resolved}`,
          resolved,
          newInTop: gain(base, top({ ...need, salaryTo }, pool, now, n)),
          change: { salaryTo },
        });
        break;
      }
    }
  }

  // 2) Format: top candidates who prefer a different format.
  const alternatives: WorkFormat[] = need.format === "office" ? ["hybrid", "remote"] : need.format === "hybrid" ? ["remote"] : [];
  const misfit = base.filter((c) => c.format && formatCityFit({ ...need, city: null }, c) < 1);
  // The alternative that fully suits most of them; on a tie the smaller change (hybrid before remote).
  const best = alternatives
    .map((format) => ({ format, resolved: misfit.filter((c) => c.format === format).length }))
    .sort((a, b) => b.resolved - a.resolved)[0];
  if (best && best.resolved > 0) {
    hints.push({
      kind: "format",
      text: `${cands(misfit.length)} ${topLabel} ${verb(misfit.length, "предпочитает", "предпочитают")} другой формат. С форматом «${WORK_FORMAT_TITLES[best.format]}» он полностью подойдёт ${best.resolved}`,
      resolved: best.resolved,
      newInTop: gain(base, top({ ...need, format: best.format }, pool, now, n)),
      change: { format: best.format },
    });
  }

  // 3) City: a city requirement for office/hybrid work.
  if (need.city && need.format !== "remote") {
    const elsewhere = base.filter((c) => c.city && c.city.toLowerCase() !== need.city!.toLowerCase()).length;
    if (elsewhere > 0) {
      hints.push({
        kind: "city",
        text: `${cands(elsewhere)} ${topLabel} ${verb(elsewhere, "живёт", "живут")} не в городе ${need.city}. Без привязки к городу (релокация или удалёнка) это перестанет быть минусом`,
        resolved: elsewhere,
        newInTop: gain(base, top({ ...need, city: null }, pool, now, n)),
        change: { city: null },
      });
    }
  }
  return hints.sort((a, b) => b.resolved - a.resolved);
}
