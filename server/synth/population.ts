import { GRADES, TEST_CONFIG, type Grade, type WorkFormat } from "../config";
import type { CandidateInput, FspAchievementInput } from "../matching/score";
import { BANK } from "../testing/bank";
import { estimate, selectNext, shouldStop, type Administered, type BankItem } from "../testing/cat";
import { decide, p2pl } from "../testing/irt";
import { Rng } from "../testing/rng";
import {
  CITY_WEIGHTS,
  COMPANY_ABOUT,
  COMPANY_NAMES,
  COMPANY_PREFIX,
  FEMALE_FIRST,
  FSP_COMPETITIONS,
  LAST_BASE,
  MALE_FIRST,
  NEED_TITLES,
  STACKS,
} from "./dictionaries";

export type SynthSpec = "backend" | "frontend" | "data" | "qa";
export const SYNTH_SPECS: [SynthSpec, number][] = [
  ["backend", 35],
  ["frontend", 25],
  ["data", 20],
  ["qa", 20],
];

/** Ground truth used only by validation; never shown in the product. */
export interface Truth {
  theta: number;
  grade: Grade;
  skills: string[];
  /** Minimal salary the candidate would really accept. */
  minSalary: number;
  format: WorkFormat;
  city: string;
}

export interface SynthCandidate {
  key: string;
  fullName: string;
  city: string;
  experienceYears: number;
  about: string;
  spec: SynthSpec;
  chosenGrade: Grade;
  salaryFrom: number;
  salaryTo: number;
  format: WorkFormat;
  visible: boolean;
  lastActiveDaysAgo: number;
  declaredSkills: string[];
  achievements: (FspAchievementInput & { discipline: string; rank: number | null })[];
  attempts: SynthAttempt[];
  truth: Truth;
}

export interface SynthAttempt {
  grade: Grade;
  daysAgo: number;
  theta: number;
  se: number;
  score: number;
  result: "passed_confident" | "passed" | "failed";
  items: { templateId: string; x: number; a: number; b: number; kind: Administered["kind"]; expected: number }[];
  stop: string;
  trust: "high" | "medium" | "low";
}

export interface SynthEmployer {
  key: string;
  companyName: string;
  about: string;
  city: string;
  needs: SynthNeed[];
}

export interface SynthNeed {
  title: string;
  spec: SynthSpec;
  grade: Grade;
  stack: string[];
  salaryFrom: number;
  salaryTo: number;
  format: WorkFormat;
  city: string | null;
  teamAbout: string;
}

const weighted = <T,>(rng: Rng, items: [T, number][]) => {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rng.float() * total;
  for (const [x, w] of items) {
    r -= w;
    if (r <= 0) return x;
  }
  return items[items.length - 1]![0];
};

export const trueGrade = (theta: number): Grade =>
  theta >= TEST_CONFIG.cutTheta.senior ? "senior" : theta >= TEST_CONFIG.cutTheta.middle ? "middle" : "junior";

const BASE_SALARY: Record<Grade, [number, number]> = { junior: [70_000, 140_000], middle: [160_000, 280_000], senior: [280_000, 450_000] };
const BIG_CITY = new Set(["Москва", "Санкт-Петербург"]);
const round10k = (x: number) => Math.round(x / 10_000) * 10_000;

/**
 * IRT parameters of the bank used for simulation. For specializations whose
 * real bank is not ready yet, a synthetic bank with the same distribution of
 * difficulty/discrimination and item kinds is used.
 */
export function bankItemsFor(spec: SynthSpec): BankItem[] {
  const real = BANK.filter((t) => t.specialization === spec);
  if (real.length >= 12) return real.map((t) => ({ id: t.id, kind: t.kind, a: t.a, b: t.b }));
  const rng = new Rng(`synthetic-bank/${spec}`);
  const kinds: Administered["kind"][] = spec === "frontend" ? ["code", "code", "calc", "quiz"] : ["code", "sql", "calc", "quiz"];
  return Array.from({ length: 26 }, (_, i) => ({
    id: `synthetic-${spec}-${i}`,
    kind: kinds[i % kinds.length]!,
    a: 0.9 + rng.float() * 0.7,
    b: -2 + (4.2 * i) / 25 + rng.normal() * 0.15,
  }));
}

export function simulateAttempt(
  theta: number,
  grade: Grade,
  bank: BankItem[],
  rng: Rng,
  opts: { leaked?: Set<string>; trueParams?: Map<string, { a: number; b: number }> } = {},
): SynthAttempt {
  const adm: Administered[] = [];
  const expected: number[] = [];
  let stop: string;
  for (;;) {
    const s = shouldStop(grade, adm, { bankLeft: bank.length - adm.length });
    if (s) {
      stop = s;
      break;
    }
    const it = selectNext(grade, adm, bank, rng)!;
    const before = estimate(grade, adm);
    expected.push(p2pl(before.theta, it.a, it.b));
    // Responses follow the TRUE item parameters (unknown to the system when calibrating).
    const tp = opts.trueParams?.get(it.id) ?? it;
    // A leaked item is answered correctly by most candidates regardless of ability.
    const p = opts.leaked?.has(it.id) ? 0.95 : p2pl(theta, tp.a, tp.b);
    adm.push({ ...it, x: rng.float() < p ? 1 : 0 });
  }
  const est = estimate(grade, adm);
  const d = decide(est.theta, grade);
  return {
    grade,
    daysAgo: 0,
    theta: est.theta,
    se: est.se,
    score: d.score,
    result: d.result,
    items: adm.map((a, k) => ({ templateId: a.id, x: a.x!, a: a.a, b: a.b, kind: a.kind, expected: expected[k]! })),
    trust: "high",
    stop,
  };
}

function personName(rng: Rng) {
  const female = rng.bool(0.38);
  const first = rng.pick(female ? FEMALE_FIRST : MALE_FIRST);
  const last = rng.pick(LAST_BASE) + (female ? "а" : "");
  return `${first} ${last}`;
}

function achievementsFor(rng: Rng, theta: number, now: Date) {
  if (!rng.bool(0.4)) return [];
  const n = Math.max(1, Math.round(Math.abs(rng.normal()) * 3 + 1));
  return Array.from({ length: n }, () => {
    const comp = rng.pick(FSP_COMPETITIONS);
    const stage = weighted(rng, [["regional", 6], ["district", 3], ["final", Math.max(0.3, 1 + theta)]] as [FspAchievementInput["stage"], number][]);
    // Stronger candidates take places more often.
    const pPlace = Math.min(0.85, Math.max(0.05, 0.3 + 0.25 * theta));
    const place = rng.bool(pPlace) ? Math.min(60, Math.max(1, Math.round(Math.abs(rng.normal()) * (8 - 2 * theta) + 1))) : null;
    const source = weighted(rng, [["fsp_registry", 6], ["organizer", 2], ["repo", 1], ["self", 2]] as [FspAchievementInput["source"], number][]);
    return {
      competition: comp.name,
      discipline: comp.discipline,
      stage,
      year: now.getFullYear() - rng.int(0, 4),
      place,
      rank: place ? null : rng.int(30, 400),
      source,
    };
  });
}

export function generateCandidate(rng: Rng, i: number, now: Date): SynthCandidate {
  const spec = weighted(rng, SYNTH_SPECS);
  const theta = Math.max(-2.8, Math.min(2.8, rng.normal() * 1.05 + 0.1));
  const grade = trueGrade(theta);
  const city = weighted(rng, CITY_WEIGHTS);
  const format = weighted(rng, [["remote", 45], ["hybrid", 35], ["office", 20]] as [WorkFormat, number][]);
  const st = STACKS[spec];
  const nCore = spec === "backend" ? 1 : st.core.length;
  const trueSkills = [...rng.sample(st.core, nCore), ...rng.sample(st.extra, rng.int(3, 7))];
  // Declared skills: mostly true, sometimes padded with claims that are not real.
  const declared = trueSkills.filter(() => rng.bool(0.85));
  if (rng.bool(0.3)) declared.push(...rng.sample(st.extra.filter((x) => !trueSkills.includes(x)), rng.int(1, 3)));
  const [lo, hi] = BASE_SALARY[grade];
  const minSalary = round10k((lo + (hi - lo) * rng.float()) * (BIG_CITY.has(city) ? 1.15 : 1));
  // Some candidates ask more than they would accept.
  const salaryFrom = round10k(minSalary * (1 + Math.max(0, rng.normal() * 0.1)));
  // Self-chosen grade: usually right, sometimes optimistic, rarely modest.
  const gi = GRADES.indexOf(grade);
  const shift = weighted(rng, [[0, 70], [1, 22], [-1, 8]] as [number, number][]);
  const chosen = GRADES[Math.max(0, Math.min(2, gi + shift))]!;
  const bank = bankItemsFor(spec);
  const attempts: SynthAttempt[] = [];
  if (rng.bool(0.9)) {
    const first = simulateAttempt(theta, chosen, bank, rng.fork("a1"));
    first.daysAgo = rng.int(5, 300);
    attempts.push(first);
    if (first.result === "failed" && gi < GRADES.indexOf(chosen)) {
      const second = simulateAttempt(theta, GRADES[GRADES.indexOf(chosen) - 1]!, bank, rng.fork("a2"));
      second.daysAgo = Math.max(1, first.daysAgo - rng.int(0, 3));
      attempts.push(second);
    }
    // A small share of attempts carry anti-fraud signals.
    const last = attempts[attempts.length - 1]!;
    last.trust = weighted(rng, [["high", 90], ["medium", 7], ["low", 3]] as ["high" | "medium" | "low", number][]);
  }
  const years = Math.max(0, Math.round((theta + 1.5) * 2 + rng.normal()));
  return {
    key: `cand${String(i).padStart(3, "0")}`,
    fullName: personName(rng),
    city,
    experienceYears: years,
    about: `${spec === "data" ? "Работаю с данными" : spec === "qa" ? "Обеспечиваю качество продуктов" : "Разрабатываю"} ${years ? `${years} ${years === 1 ? "год" : years < 5 ? "года" : "лет"}` : "первый год"}. Интересны задачи с ${trueSkills.slice(0, 2).join(" и ")}.`,
    spec,
    chosenGrade: chosen,
    salaryFrom,
    salaryTo: round10k(salaryFrom * 1.25),
    format,
    visible: rng.bool(0.95),
    lastActiveDaysAgo: Math.round(Math.abs(rng.normal()) * 40),
    declaredSkills: [...new Set(declared)],
    achievements: achievementsFor(rng, theta, now),
    attempts,
    truth: { theta, grade, skills: trueSkills, minSalary, format, city },
  };
}

export function generateEmployer(rng: Rng, i: number): SynthEmployer {
  const city = weighted(rng, CITY_WEIGHTS);
  const n = rng.int(2, 3);
  const needs: SynthNeed[] = Array.from({ length: n }, () => {
    const spec = weighted(rng, SYNTH_SPECS);
    const grade = weighted(rng, [["junior", 25], ["middle", 45], ["senior", 30]] as [Grade, number][]);
    const st = STACKS[spec];
    const stack = [...rng.sample(st.core, spec === "backend" ? 1 : Math.min(2, st.core.length)), ...rng.sample(st.extra, rng.int(2, 4))];
    const [lo, hi] = BASE_SALARY[grade];
    const k = BIG_CITY.has(city) ? 1.15 : 1;
    const from = round10k((lo + (hi - lo) * rng.float() * 0.5) * k);
    const format = weighted(rng, [["remote", 40], ["hybrid", 40], ["office", 20]] as [WorkFormat, number][]);
    return {
      title: `${rng.pick(NEED_TITLES[spec])} (${grade[0]!.toUpperCase()}${grade.slice(1)})`,
      spec,
      grade,
      stack: [...new Set(stack)],
      salaryFrom: from,
      salaryTo: round10k(from * (1.25 + rng.float() * 0.3)),
      format,
      city: format === "remote" ? null : city,
      teamAbout: rng.pick(COMPANY_ABOUT),
    };
  });
  return {
    key: `emp${String(i).padStart(2, "0")}`,
    companyName: `${rng.pick(COMPANY_PREFIX)} «${COMPANY_NAMES[i % COMPANY_NAMES.length]}»`,
    about: rng.pick(COMPANY_ABOUT),
    city,
    needs,
  };
}

export function generatePopulation(opts: { seed?: string; candidates?: number; employers?: number; now?: Date } = {}) {
  const rng = new Rng(opts.seed ?? "fsp-synth-v1");
  const now = opts.now ?? new Date();
  const candidates = Array.from({ length: opts.candidates ?? 320 }, (_, i) => generateCandidate(rng.fork(`c${i}`), i + 1, now));
  const employers = Array.from({ length: opts.employers ?? 32 }, (_, i) => generateEmployer(rng.fork(`e${i}`), i + 1));
  return { candidates, employers };
}

/** Ground-truth relevance used by validation (never by the ranking itself). */
export function isRelevant(need: SynthNeed, c: SynthCandidate) {
  if (need.spec !== c.spec || need.grade !== c.truth.grade) return false;
  const have = new Set(c.truth.skills);
  const cover = need.stack.filter((s) => have.has(s)).length / Math.max(1, need.stack.length);
  if (cover < 0.5) return false;
  if (c.truth.minSalary > need.salaryTo * 1.1) return false;
  if (need.format === "office" && c.truth.format === "remote") return false;
  if (need.format !== "remote" && need.city && need.city !== c.truth.city && c.truth.format !== "remote" && need.format === "office") return false;
  return true;
}

// ---------------------------------------------------------------- helpers shared by seed and validation

const MAIN_LANG: Record<SynthSpec, string> = { backend: "python", frontend: "javascript", data: "python", qa: "python" };

/** Best passed attempt that is trusted enough to give a category (same rule as the product). */
export function categoryOf(c: SynthCandidate) {
  let best: SynthAttempt | null = null;
  for (const a of c.attempts) {
    if (a.result === "failed" || a.trust === "low") continue;
    if (!best || GRADES.indexOf(a.grade) > GRADES.indexOf(best.grade) || (a.grade === best.grade && a.score > best.score)) best = a;
  }
  return best;
}

/** Skills confirmed by the test: main language, SQL where tested, and two true skills from bank topics. */
export function confirmedSkills(c: SynthCandidate) {
  const s = new Set<string>([MAIN_LANG[c.spec]]);
  if (c.spec === "backend" || c.spec === "data") s.add("sql");
  for (const x of c.truth.skills.slice(0, 2)) s.add(x);
  return [...s];
}

export function toCandidateInput(c: SynthCandidate, now: Date): CandidateInput | null {
  const cat = categoryOf(c);
  if (!cat || !c.visible) return null;
  return {
    grade: cat.grade,
    score: cat.score,
    trustLevel: cat.trust,
    assignedAt: new Date(now.getTime() - cat.daysAgo * 86400000),
    skills: [
      ...c.declaredSkills.map((skill) => ({ skill, source: "declared" as const })),
      ...confirmedSkills(c).map((skill) => ({ skill, source: "test_confirmed" as const })),
    ],
    salaryFrom: c.salaryFrom,
    salaryTo: c.salaryTo,
    format: c.format,
    city: c.city,
    lastActiveAt: new Date(now.getTime() - c.lastActiveDaysAgo * 86400000),
    achievements: c.achievements,
  };
}
