import { FSP_CONFIG, GRADE_TITLES, MATCH_WEIGHTS, TEST_CONFIG, WORK_FORMAT_TITLES, type Grade, type WorkFormat } from "../config";
import { DAY_MS } from "../lib/time";
import { IMPLIES, skillTitle } from "./skills";

export interface NeedInput {
  grade: Grade | null;
  stack: string[];
  salaryFrom: number | null;
  salaryTo: number | null;
  format: WorkFormat | null;
  city: string | null;
}

export type SkillSource = "declared" | "resume" | "test_confirmed";

export interface FspAchievementInput {
  competition: string;
  stage: "regional" | "district" | "final";
  year: number;
  place: number | null;
  source: "fsp_registry" | "organizer" | "repo" | "self";
}

export interface CandidateInput {
  grade: Grade;
  score: number;
  trustLevel: "high" | "medium" | "low";
  assignedAt: Date;
  skills: { skill: string; source: SkillSource }[];
  salaryFrom: number | null;
  salaryTo: number | null;
  format: WorkFormat | null;
  city: string | null;
  lastActiveAt: Date;
  achievements: FspAchievementInput[];
  /**
   * false = the candidate took the test for this grade but did not reach the
   * pass score. They stay visible (Q&A: "show with a status and rank lower,
   * do not hide"), but always below confirmed candidates.
   */
  confirmed?: boolean;
}

export type Component = keyof typeof MATCH_WEIGHTS;

export interface MatchResult {
  match: number;
  components: Record<Component, number>;
  pros: string[];
  cons: string[];
  stack: { skill: string; title: string; level: "test" | "implied" | "resume" | "declared" | "missing" }[];
  fspRaw: number;
}

// ---------------------------------------------------------------- FSP bonus

export function placeWeight(place: number | null) {
  if (place === null || place > 50) return 0.02; // participation without a place
  if (place === 1) return 1;
  if (place === 2) return 0.75;
  if (place === 3) return 0.6;
  if (place <= 10) return 0.3;
  return 0.12;
}

export function achievementWeight(a: FspAchievementInput, now: Date) {
  const age = Math.max(0, now.getFullYear() - a.year);
  const fresh = Math.pow(0.5, age / FSP_CONFIG.halfLifeYears);
  return placeWeight(a.place) * FSP_CONFIG.trustWeight[a.source] * FSP_CONFIG.stageWeight[a.stage] * fresh;
}

/**
 * Diminishing returns: the top-5 achievements count in full, the rest only
 * logarithmically. One win outweighs a hundred participations without a place.
 */
export function fspRaw(achievements: FspAchievementInput[], now: Date) {
  const ws = achievements.map((a) => achievementWeight(a, now)).sort((x, y) => y - x);
  const top = ws.slice(0, FSP_CONFIG.topN).reduce((s, x) => s + x, 0);
  const rest = ws.slice(FSP_CONFIG.topN).reduce((s, x) => s + x, 0);
  return top + FSP_CONFIG.tailWeight * Math.log(1 + rest);
}

const saturate = (x: number, half: number) => x / (x + half);

// ---------------------------------------------------------------- components

const SOURCE_WEIGHT = { test: 1, implied: 0.8, resume: 0.6, declared: 0.5, missing: 0 } as const;

export function stackLevels(needStack: string[], skills: CandidateInput["skills"]) {
  const bySource = (src: SkillSource) => new Set(skills.filter((s) => s.source === src).map((s) => s.skill));
  const test = bySource("test_confirmed");
  const resume = bySource("resume");
  const declared = bySource("declared");
  const implied = new Set<string>();
  for (const t of test) for (const i of IMPLIES[t] ?? []) implied.add(i);
  return needStack.map((skill) => ({
    skill,
    title: skillTitle(skill),
    level: test.has(skill)
      ? ("test" as const)
      : implied.has(skill)
        ? ("implied" as const)
        : resume.has(skill)
          ? ("resume" as const)
          : declared.has(skill)
            ? ("declared" as const)
            : ("missing" as const),
  }));
}

export function salaryFit(need: NeedInput, c: CandidateInput) {
  if (!need.salaryTo || !c.salaryFrom) return { score: 0.75, position: "unknown" as const };
  const top = need.salaryTo;
  const bottom = need.salaryFrom ?? top;
  if (c.salaryFrom <= top) {
    const upper = bottom + 0.8 * (top - bottom);
    return { score: 1, position: c.salaryFrom >= upper && top > bottom ? ("upper" as const) : ("inside" as const) };
  }
  const over = (c.salaryFrom - top) / top;
  // Above the range is a penalty, not an exclusion.
  return { score: Math.max(0, 1 - over * 3), position: "above" as const, over };
}

export function formatCityFit(need: NeedInput, c: CandidateInput) {
  let f = 1;
  if (need.format && c.format && need.format !== c.format) {
    if (need.format === "hybrid" || c.format === "hybrid") f = 0.6;
    else if (need.format === "office" && c.format === "remote") f = 0.25;
    else f = 0.5; // need remote, candidate prefers office
  }
  let city = 1;
  const needsPresence = need.format !== "remote";
  if (needsPresence && need.city && c.city && need.city.toLowerCase() !== c.city.toLowerCase()) city = need.format === "hybrid" ? 0.5 : 0.35;
  return f * city;
}

export function freshness(c: CandidateInput, now: Date) {
  const testDays = (now.getTime() - c.assignedAt.getTime()) / DAY_MS;
  const activeDays = (now.getTime() - c.lastActiveAt.getTime()) / DAY_MS;
  const testFresh = testDays <= 90 ? 1 : Math.max(0.3, Math.exp(-(testDays - 90) / 365));
  const activeFresh = activeDays <= 30 ? 1 : Math.max(0.2, Math.exp(-(activeDays - 30) / 120));
  return { score: 0.6 * testFresh + 0.4 * activeFresh, testDays, activeDays };
}

const listRu = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} и ${xs[xs.length - 1]}`);
const rub = (n: number) => `${new Intl.NumberFormat("ru-RU").format(n)} ₽`;
const STAGE_TITLE = { regional: "региональный этап", district: "окружной этап", final: "финал" } as const;

// ---------------------------------------------------------------- main

/**
 * Deterministic, explainable match score 0..100. Every argument "for" and
 * "against" is derived from the same component values that form the score.
 */
export function scoreCandidate(need: NeedInput, c: CandidateInput, now = new Date()): MatchResult {
  // test: position of the scaled score between "just passed minus a margin" and the maximum.
  let test = Math.min(1, Math.max(0, (c.score - (TEST_CONFIG.passScore - 6)) / (TEST_CONFIG.scaleMax - (TEST_CONFIG.passScore - 6))));
  if (c.trustLevel === "medium") test *= 0.9;

  const levels = stackLevels(need.stack, c.skills);
  const stack = levels.length ? levels.reduce((s, l) => s + SOURCE_WEIGHT[l.level], 0) / levels.length : 0.6;

  const raw = fspRaw(c.achievements, now);
  const fsp = saturate(raw, 1.5);
  const sal = salaryFit(need, c);
  const fc = formatCityFit(need, c);
  const fr = freshness(c, now);

  const components: Record<Component, number> = { test, stack, fsp, salary: sal.score, formatCity: fc, freshness: fr.score };
  const total = (Object.keys(MATCH_WEIGHTS) as Component[]).reduce((s, k) => s + MATCH_WEIGHTS[k] * components[k], 0);
  const sumW = Object.values(MATCH_WEIGHTS).reduce((s, x) => s + x, 0);
  const match = Math.round((100 * total) / sumW);

  // ---- arguments, each tagged with its weighted contribution for ordering
  const pros: { t: string; w: number }[] = [];
  const cons: { t: string; w: number }[] = [];
  const g = GRADE_TITLES[c.grade];
  if (c.confirmed === false) cons.push({ t: `Грейд ${g} не подтверждён: ${c.score.toFixed(1)}/30 при пороге ${TEST_CONFIG.passScore}`, w: 1 });
  else if (c.score >= TEST_CONFIG.confidentScore) pros.push({ t: `Уверенно сдал тест ${g}: ${c.score.toFixed(1)}/30`, w: MATCH_WEIGHTS.test * test + 0.05 });
  else pros.push({ t: `Тест ${g} сдан: ${c.score.toFixed(1)}/30`, w: MATCH_WEIGHTS.test * test * 0.6 });

  const byLevel = (lv: string) => levels.filter((l) => l.level === lv).map((l) => l.title);
  const tested = byLevel("test");
  const implied = byLevel("implied");
  const claimed = [...byLevel("resume"), ...byLevel("declared")];
  const missing = byLevel("missing");
  if (tested.length) pros.push({ t: `${listRu(tested)} ${tested.length > 1 ? "подтверждены" : "подтверждён"} тестом`, w: MATCH_WEIGHTS.stack * (tested.length / levels.length) + 0.02 });
  if (implied.length) pros.push({ t: `${listRu(implied)} — косвенно подтверждено тестом`, w: MATCH_WEIGHTS.stack * 0.8 * (implied.length / levels.length) });
  if (claimed.length) pros.push({ t: `Заявлен опыт: ${listRu(claimed)} (не проверено тестом)`, w: MATCH_WEIGHTS.stack * 0.5 * (claimed.length / levels.length) });
  if (missing.length) cons.push({ t: `Нет данных о навыках: ${listRu(missing.slice(0, 4))}`, w: MATCH_WEIGHTS.stack * (missing.length / levels.length) });

  if (c.achievements.length) {
    const best = [...c.achievements].sort((a, b) => achievementWeight(b, now) - achievementWeight(a, now))[0]!;
    const conf = c.achievements.filter((a) => a.source !== "self").length;
    if (best.place && best.place <= 3) {
      pros.push({ t: `Призёр ФСП: ${best.place} место, ${best.competition} (${STAGE_TITLE[best.stage]}, ${best.year})`, w: MATCH_WEIGHTS.fsp * fsp + 0.03 });
    } else if (conf > 0) {
      pros.push({ t: `Участие в соревнованиях ФСП: ${conf} подтверждённых результатов`, w: MATCH_WEIGHTS.fsp * fsp });
    } else {
      pros.push({ t: `Достижения ФСП заявлены, но не подтверждены`, w: MATCH_WEIGHTS.fsp * fsp * 0.5 });
    }
  } else {
    cons.push({ t: "Истории в ФСП нет", w: 0.01 });
  }

  if (sal.position === "inside") pros.push({ t: `Ожидания ${rub(c.salaryFrom!)} — в пределах вилки`, w: MATCH_WEIGHTS.salary * 0.7 });
  if (sal.position === "upper") cons.push({ t: `Ожидания ${rub(c.salaryFrom!)} — на верхней границе вилки`, w: 0.03 });
  if (sal.position === "above") cons.push({ t: `Ожидания ${rub(c.salaryFrom!)} — выше вилки на ${Math.round((sal.over ?? 0) * 100)}%`, w: MATCH_WEIGHTS.salary * (1 - sal.score) + 0.04 });

  if (need.format && c.format && need.format !== c.format) {
    cons.push({ t: `Предпочитает формат «${WORK_FORMAT_TITLES[c.format]}»`, w: MATCH_WEIGHTS.formatCity * (1 - fc) });
  } else if (need.format && c.format === need.format) {
    pros.push({ t: `Готов к формату «${WORK_FORMAT_TITLES[c.format]}»`, w: MATCH_WEIGHTS.formatCity * 0.5 });
  }
  if (need.format !== "remote" && need.city && c.city && need.city.toLowerCase() !== c.city.toLowerCase()) {
    cons.push({ t: `Другой город: ${c.city}`, w: MATCH_WEIGHTS.formatCity * 0.6 });
  }
  if (c.trustLevel === "medium") cons.push({ t: "Категория с пометкой: средний индекс доверия к попытке", w: 0.05 });
  if (fr.testDays > 365) cons.push({ t: `Тест пройден более года назад`, w: MATCH_WEIGHTS.freshness * 0.5 });
  else if (fr.testDays <= 30) pros.push({ t: `Тест пройден недавно — ${Math.max(1, Math.round(fr.testDays))} дн. назад`, w: MATCH_WEIGHTS.freshness * 0.3 });
  if (fr.activeDays > 90) cons.push({ t: `Не заходил на платформу ${Math.round(fr.activeDays)} дн.`, w: MATCH_WEIGHTS.freshness * 0.4 });

  // Always give at least two arguments "for" and one "against", derived from components.
  if (pros.length < 2 && c.confirmed !== false) pros.push({ t: `Категория ${g} присвоена по результату теста, а не по резюме`, w: 0 });
  if (!cons.length) {
    // Weakest component that is genuinely weak; otherwise an honest "no notable minuses".
    const valid: Partial<Record<Component, boolean>> = {
      test: c.score < TEST_CONFIG.confidentScore,
      stack: levels.length > 0 && components.stack < 0.9,
      // Only mention FSP as a weakness for candidates who do have some history but no podium.
      fsp: c.achievements.length > 0 && !c.achievements.some((x) => x.place !== null && x.place <= 3) && components.fsp < 0.3,
      salary: sal.position === "unknown",
      formatCity: components.formatCity < 1,
      freshness: components.freshness < 0.9,
    };
    const phrase: Record<Component, string> = {
      test: "Результат теста ближе к порогу, чем у лидеров подборки",
      stack: "Часть стека не подтверждена тестом",
      fsp: "Подтверждённых призовых мест в ФСП нет",
      salary: "Ожидания по зарплате не указаны",
      formatCity: "Формат работы совпадает не полностью",
      freshness: "Профиль давно не обновлялся",
    };
    const weakest = (Object.keys(components) as Component[]).filter((k) => valid[k]).sort((a, b) => components[a] - components[b])[0];
    cons.push({ t: weakest ? phrase[weakest] : "Явных минусов по данным теста и профиля нет", w: 0 });
  }

  return {
    match,
    components,
    pros: pros.sort((a, b) => b.w - a.w).slice(0, 4).map((x) => x.t),
    cons: cons.sort((a, b) => b.w - a.w).slice(0, 2).map((x) => x.t),
    stack: levels,
    fspRaw: raw,
  };
}

/** Baseline for validation: keyword overlap of the need stack with claimed skills only. */
export function keywordBaseline(need: NeedInput, skills: string[]) {
  if (!need.stack.length) return 0;
  const s = new Set(skills);
  return need.stack.filter((x) => s.has(x)).length / need.stack.length;
}
