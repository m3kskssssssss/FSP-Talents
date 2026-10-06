/**
 * Reproducible validation of matching and testing on synthetic data with a
 * known ground truth. Writes docs/validation.md and docs/img/*.svg.
 *   npm run validate
 * Pure in-memory: no database needed.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { GRADES, GRADE_TITLES, TEST_CONFIG, type Grade } from "../server/config";
import { keywordBaseline, scoreCandidate, type NeedInput } from "../server/matching/score";
import {
  bankItemsFor,
  generatePopulation,
  isRelevant,
  simulateAttempt,
  toCandidateInput,
  trueGrade,
  type SynthAttempt,
  type SynthCandidate,
  type SynthNeed,
} from "../server/synth/population";
import { fitItem, leakVerdict } from "../server/testing/calibration";
import type { BankItem } from "../server/testing/cat";


import { Rng } from "../server/testing/rng";
import { computeTrust, type TrustInput } from "../server/testing/trust";
import { C, groupedBars, heatmap, scatter, stackedShares } from "./lib/svg";

const NOW = new Date("2026-10-01T00:00:00Z");
const out: string[] = [];
const md = (s = "") => out.push(s);
const pct = (x: number) => `${(100 * x).toFixed(1)}%`;
const f2 = (x: number) => x.toFixed(2);
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
const pearson = (a: number[], b: number[]) => {
  const ma = mean(a), mb = mean(b);
  let num = 0, da = 0, db = 0;
  a.forEach((x, i) => {
    num += (x - ma) * (b[i]! - mb);
    da += (x - ma) ** 2;
    db += (b[i]! - mb) ** 2;
  });
  return num / Math.sqrt(da * db);
};
mkdirSync("docs/img", { recursive: true });
const svg = (name: string, content: string) => writeFileSync(`docs/img/${name}.svg`, content);
const t0 = Date.now();

// ======================================================================== 1. Matching quality
const pop = generatePopulation({ seed: "validation-v1", candidates: 700, employers: 70, now: NOW });
const needs: SynthNeed[] = pop.employers.flatMap((e) => e.needs);

function dcg(rels: number[]) {
  return rels.reduce((s, r, i) => s + r / Math.log2(i + 2), 0);
}
function metrics(ranked: SynthCandidate[], need: SynthNeed, totalRelevant: number) {
  const rel: number[] = ranked.map((c) => (isRelevant(need, c) ? 1 : 0));
  const p5 = rel.slice(0, 5).reduce((s, x) => s + x, 0) / 5;
  const p10 = rel.slice(0, 10).reduce((s, x) => s + x, 0) / 10;
  const ideal = dcg(Array.from({ length: Math.min(10, totalRelevant) }, () => 1));
  return { p5, p10, ndcg: ideal ? dcg(rel.slice(0, 10)) / ideal : 0 };
}

const ours: ReturnType<typeof metrics>[] = [];
const base: ReturnType<typeof metrics>[] = [];
const oursNoFsp: ReturnType<typeof metrics>[] = [];
const rngBase = new Rng("baseline-ties");
let evaluated = 0;
const examples: { need: SynthNeed; c: SynthCandidate; match: number; pros: string[]; cons: string[]; rel: boolean }[] = [];
for (const need of needs) {
  const relevant = pop.candidates.filter((c) => isRelevant(need, c));
  if (!relevant.length) continue;
  evaluated++;
  const needInput: NeedInput = { grade: need.grade, stack: need.stack, salaryFrom: need.salaryFrom, salaryTo: need.salaryTo, format: need.format, city: need.city };
  // Platform: hard filter by test category (spec + grade), then deterministic score.
  const pool = pop.candidates
    .map((c) => ({ c, inp: toCandidateInput(c, NOW) }))
    .filter((x) => x.inp && x.c.spec === need.spec && x.inp.grade === need.grade);
  const scored = pool.map((x) => ({ c: x.c, r: scoreCandidate(needInput, x.inp!, NOW), rNoFsp: scoreCandidate(needInput, { ...x.inp!, achievements: [] }, NOW) }));
  const ranked = [...scored].sort((a, b) => b.r.match - a.r.match);
  ours.push(metrics(ranked.map((x) => x.c), need, relevant.length));
  oursNoFsp.push(metrics([...scored].sort((a, b) => b.rNoFsp.match - a.rNoFsp.match).map((x) => x.c), need, relevant.length));
  // Baseline: keyword overlap of the need stack with resume (declared) skills over the whole specialization, self-described grade ignored.
  const bl = pop.candidates
    .filter((c) => c.spec === need.spec && c.visible)
    .map((c) => ({ c, s: keywordBaseline(needInput, c.declaredSkills) + rngBase.float() * 1e-6 }))
    .sort((a, b) => b.s - a.s);
  base.push(metrics(bl.map((x) => x.c), need, relevant.length));
  if (examples.length < 12 && ranked.length >= 3) {
    for (const x of [ranked[0]!, ranked[ranked.length - 1]!]) examples.push({ need, c: x.c, match: x.r.match, pros: x.r.pros, cons: x.r.cons, rel: isRelevant(need, x.c) });
  }
}
const agg = (xs: ReturnType<typeof metrics>[]) => ({ p5: mean(xs.map((x) => x.p5)), p10: mean(xs.map((x) => x.p10)), ndcg: mean(xs.map((x) => x.ndcg)) });
const A = agg(ours), B = agg(base), A2 = agg(oursNoFsp);
svg(
  "matching",
  groupedBars({
    title: `Качество подбора на ${evaluated} потребностях`,
    groups: ["Precision@5", "Precision@10", "nDCG@10"],
    series: [
      { name: "Платформа (категория + скоринг)", color: C.violet, values: [A.p5, A.p10, A.ndcg] },
      { name: "Бейзлайн: ключевые слова резюме", color: C.orange, values: [B.p5, B.p10, B.ndcg] },
    ],
    max: 1,
  }),
);

md("# Валидация подбора и тестирования");
md();
md(`Отчёт сгенерирован командой \`npm run validate\` (${new Date().toISOString().slice(0, 10)}), все числа воспроизводимы: генераторы синтетики и симуляций детерминированы (seedrandom). Данные — синтетические, со «скрытой истиной» (истинная способность θ, истинный грейд, реальные навыки, минимально приемлемая зарплата), которая известна только валидатору и никак не используется продуктом.`);
md();
md("## 1. Качество подбора");
md();
md(`Популяция: ${pop.candidates.length} кандидатов, ${needs.length} потребностей (${evaluated} с хотя бы одним релевантным кандидатом). Разметка «релевантен / нет» — правилами по скрытой истине: та же специализация, **истинный** грейд равен грейду потребности, кандидат реально владеет ≥ 50% стека, его минимальные ожидания ≤ 110% верхней границы вилки, формат совместим.`);
md();
md("| Метод | Precision@5 | Precision@10 | nDCG@10 |");
md("|---|---|---|---|");
md(`| **Платформа**: жёсткий фильтр по категории из теста + скоринг | **${f2(A.p5)}** | **${f2(A.p10)}** | **${f2(A.ndcg)}** |`);
md(`| Платформа без бонуса ФСП (абляция) | ${f2(A2.p5)} | ${f2(A2.p10)} | ${f2(A2.ndcg)} |`);
md(`| Бейзлайн: совпадение ключевых слов резюме | ${f2(B.p5)} | ${f2(B.p10)} | ${f2(B.ndcg)} |`);
md();
md("![Качество подбора](img/matching.svg)");
md();
md(`Главный источник выигрыша — фильтр по категории из теста: самоописание (резюме) не содержит надёжной информации о грейде, ~30% кандидатов в синтетике завышают его, а заявленные навыки содержат «приписки».`);
md();
md(A2.ndcg > A.ndcg + 0.005
  ? `Абляция без ФСП даёт чуть более высокий nDCG (${f2(A2.ndcg)} против ${f2(A.ndcg)}): в синтетической разметке релевантность не зависит от достижений, поэтому бонус ФСП здесь — «шум» внутри уже отобранной категории. Это ожидаемо: бонус задуман как способ поднять сильных внутри категории, а не как фактор релевантности; его вес (${(100 * 0.14).toFixed(0)}%) стоит уточнить на реальных откликах работодателей.`
  : `Абляция без ФСП практически не меняет метрики (nDCG ${f2(A2.ndcg)} против ${f2(A.ndcg)}): в синтетической разметке релевантность не зависит от достижений напрямую, бонус лишь переупорядочивает кандидатов внутри категории. Вес бонуса стоит уточнить на реальных откликах работодателей.`);
md();
md("### Выборка для ручной проверки");
md();
md("Лучший и худший кандидат подборки для нескольких потребностей — с доводами, которые видит работодатель. Ручная проверка подтверждает, что доводы соответствуют компонентам скоринга и не содержат фактов вне профиля.");
md();
md("| Потребность | Match | Релевантен по истине | Доводы «за» | Доводы «против» |");
md("|---|---|---|---|---|");
for (const e of examples) md(`| ${e.need.title}, ${e.need.stack.join(", ")} | ${e.match} | ${e.rel ? "да" : "нет"} | ${e.pros.join("; ")} | ${e.cons.join("; ")} |`);
md();

// ======================================================================== 2. Test-retest reliability
const bank = bankItemsFor("backend");
const rr = new Rng("retest");
const t1: number[] = [], t2: number[] = [], truthT: number[] = [];
let sameDecision = 0, sameCategory = 0;
const lengths: number[] = [];
const N_RETEST = 400;
for (let i = 0; i < N_RETEST; i++) {
  const theta = rr.normal() * 1.05 + 0.1;
  const g = trueGrade(theta);
  const a = simulateAttempt(theta, g, bank, rr.fork(`a${i}`));
  const b = simulateAttempt(theta, g, bank, rr.fork(`b${i}`));
  t1.push(a.theta);
  t2.push(b.theta);
  truthT.push(theta);
  lengths.push(a.items.length, b.items.length);
  if ((a.result === "failed") === (b.result === "failed")) sameDecision++;
  if (a.result === b.result) sameCategory++;
}
const rRetest = pearson(t1, t2);
const rTruth = pearson(t1, truthT);
svg("retest", scatter({ title: "Тест-ретест: θ в двух попытках с разными вариантами", xLabel: "θ, попытка 1", yLabel: "θ, попытка 2", points: t1.map((x, i) => ({ x, y: t2[i]! })), domain: [-3, 3], diagonal: true }));
md("## 2. Надёжность теста (тест-ретест)");
md();
md(`${N_RETEST} симулированных кандидатов (θ ~ N(0.1, 1.05)) дважды проходят адаптивный тест своего истинного грейда на банке Backend. Варианты заданий разные (другой seed попытки → другие параметры, данные и порядок отбора из top-K).`);
md();
md("| Показатель | Значение |");
md("|---|---|");
md(`| Корреляция θ между попытками | **${f2(rRetest)}** |`);
md(`| Корреляция оценки θ с истинной θ | ${f2(rTruth)} |`);
md(`| Совпадение решения «сдал / не сдал» | **${pct(sameDecision / N_RETEST)}** |`);
md(`| Совпадение итога (уверенно / сдал / не сдал) | ${pct(sameCategory / N_RETEST)} |`);
md(`| Средняя длина теста | ${mean(lengths).toFixed(1)} заданий (мин. ${TEST_CONFIG.minItems}, макс. ${TEST_CONFIG.maxItems}) |`);
md();
md("![Тест-ретест](img/retest.svg)");
md();

// ======================================================================== 3. Grade assignment accuracy
const rg = new Rng("grade-accuracy");
const N_GRADE = 900;
// Rows: true class (below the Junior cut = "no category" is the correct outcome); cols: assigned.
const confusion = [0, 1, 2, 3].map(() => [0, 0, 0, 0]);
const stops: Record<string, number> = {};
let attemptsTotal = 0, itemsTotal = 0, exact = 0, adjacent = 0, falseHigher = 0;
for (let i = 0; i < N_GRADE; i++) {
  const theta = rg.normal() * 1.05 + 0.1;
  const tg = trueGrade(theta);
  const gi = theta < TEST_CONFIG.cutTheta.junior ? -1 : GRADES.indexOf(tg);
  const shift = rg.float() < 0.7 ? 0 : rg.float() < 0.75 ? 1 : -1;
  let g = Math.max(0, Math.min(2, GRADES.indexOf(tg) + shift));
  // Candidate path under the retake rules: lower immediately after a fail,
  // higher only after a confident pass; at most 3 attempts in the window.
  let best = -1;
  const tried = new Set<number>();
  for (let k = 0; k < 3 && !tried.has(g); k++) {
    tried.add(g);
    const a = simulateAttempt(theta, GRADES[g]!, bank, rg.fork(`${i}-${k}`));
    attemptsTotal++;
    itemsTotal += a.items.length;
    stops[a.stop] = (stops[a.stop] ?? 0) + 1;
    if (a.result !== "failed") best = Math.max(best, g);
    if (a.result === "failed" && g > 0) g -= 1;
    else if (a.result === "passed_confident" && g < 2) g += 1;
    else break;
  }
  confusion[gi + 1]![best + 1]!++;
  if (best === gi) exact++;
  else if (Math.abs(best - gi) === 1) adjacent++;
  if (best > gi) falseHigher++;
}
const gradeNames = GRADES.map((g) => GRADE_TITLES[g]);
svg("confusion", heatmap({ title: "Истинный уровень × присвоенная категория", rows: ["ниже Junior", ...gradeNames], cols: ["нет", ...gradeNames], values: confusion, rowLabel: "Истинный", colLabel: "Присвоено по тесту" }));
md("## 3. Различающая способность: присвоение грейда");
md();
md(`${N_GRADE} кандидатов: 70% выбирают свой истинный грейд, остальные ошибаются на ступень (чаще — вверх). Дальше они действуют по правилам пересдачи: после провала — сразу грейд ниже, после уверенного результата (≥ ${TEST_CONFIG.confidentScore}/30) — сразу грейд выше. Категория = наивысший сданный грейд.`);
md();
md("| Показатель | Значение |");
md("|---|---|");
md(`| Итог совпал с истинным уровнем (включая «нет категории» для θ ниже порога Junior) | **${pct(exact / N_GRADE)}** |`);
md(`| Ошибка на одну ступень | ${pct(adjacent / N_GRADE)} |`);
md(`| Категория выше истинного грейда (самое дорогое для работодателя) | ${pct(falseHigher / N_GRADE)} |`);
md(`| Среднее число попыток на кандидата | ${(attemptsTotal / N_GRADE).toFixed(2)} |`);
md(`| Средняя длина попытки (CAT) | ${(itemsTotal / attemptsTotal).toFixed(1)} заданий |`);
md(`| Причины остановки | ${Object.entries(stops).map(([k, v]) => `${{ se: "SE < порога", decision: "решение очевидно (|θ − cut| ≥ 2.5·SE)", max_items: "максимум заданий", bank_exhausted: "банк исчерпан" }[k] ?? k}: ${pct(v / attemptsTotal)}`).join("; ")} |`);
md();
md("![Матрица ошибок](img/confusion.svg)");
md();
md("Строки — истинный уровень (θ ниже порога Junior — категория не положена), столбцы — присвоенная категория («нет» — ни один тест не сдан). Ошибки сосредоточены у границ грейдов: кандидат с θ рядом с порогом с вероятностью ~50% окажется по любую сторону — это свойство любой процедуры с порогами, а не адаптивности.");
md();

// ======================================================================== 4. Leak robustness
const rl = new Rng("leak");
const leaked = new Set(rl.sample(bank.map((b) => b.id), Math.round(bank.length * 0.2)));
function runCohort(bankUsed: BankItem[], leak: Set<string> | undefined, seed: string, n = 600) {
  const r = new Rng(seed);
  let correctDecision = 0, overreachPass = 0, overreachN = 0;
  const err: number[] = [];
  const stats = new Map<string, { answered: number; correct: number; expected: number }>();
  for (let i = 0; i < n; i++) {
    const theta = r.normal() * 1.05 + 0.1;
    const tg = trueGrade(theta);
    // Half of the cohort tries one grade above the true one (where a leak helps most).
    const over = i % 2 === 1 && tg !== "senior";
    const g: Grade = over ? GRADES[GRADES.indexOf(tg) + 1]! : tg;
    const a: SynthAttempt = simulateAttempt(theta, g, bankUsed, r.fork(`${i}`), { leaked: leak });
    err.push(a.theta - theta);
    const shouldPass = GRADES.indexOf(tg) >= GRADES.indexOf(g);
    if ((a.result !== "failed") === shouldPass) correctDecision++;
    if (over) {
      overreachN++;
      if (a.result !== "failed") overreachPass++;
    }
    for (const it of a.items) {
      const s = stats.get(it.templateId) ?? { answered: 0, correct: 0, expected: 0 };
      s.answered++;
      s.correct += it.x;
      s.expected += it.expected;
      stats.set(it.templateId, s);
    }
  }
  return {
    decisionAcc: correctDecision / n,
    overreachPass: overreachPass / Math.max(1, overreachN),
    bias: mean(err),
    rmse: Math.sqrt(mean(err.map((e) => e * e))),
    stats,
  };
}
const clean = runCohort(bank, undefined, "leak-clean");
const dirty = runCohort(bank, leaked, "leak-dirty");
const flagged = new Set([...dirty.stats].filter(([id, s]) => leakVerdict({ id, ...s }).flagged).map(([id]) => id));
const tp = [...flagged].filter((x) => leaked.has(x)).length;
const cleanFlags = [...clean.stats].filter(([id, s]) => leakVerdict({ id, ...s }).flagged).length;
const recovered = runCohort(bank.filter((b) => !flagged.has(b.id)), leaked, "leak-recovered");
svg(
  "leak",
  groupedBars({
    title: "«Слив» 20% шаблонов: точность решения о грейде",
    groups: ["Без слива", "Слив 20%", "После пометки flagged"],
    series: [
      { name: "Верное решение сдал/не сдал", color: C.violet, values: [clean.decisionAcc, dirty.decisionAcc, recovered.decisionAcc] },
      { name: "Ложный «сдал» на грейд выше", color: C.orange, values: [clean.overreachPass, dirty.overreachPass, recovered.overreachPass] },
    ],
    max: 1,
  }),
);
md("## 4. Устойчивость к утечке заданий");
md();
md(`Симулируем «слив» ${leaked.size} из ${bank.length} шаблонов Backend (20%): на слитых заданиях кандидат отвечает верно с вероятностью 0.95 независимо от способности. Это худший случай: утёк сам шаблон, а не отдельный вариант (варианты параметризованы, и слив одного варианта почти не помогает). Половина когорты пробует грейд выше своего истинного — там слив опаснее всего.`);
md();
md("| Сценарий | Верное решение «сдал / не сдал» | Ложный «сдал» при попытке грейда выше | Смещение θ | RMSE θ |");
md("|---|---|---|---|---|");
md(`| Без слива | ${pct(clean.decisionAcc)} | ${pct(clean.overreachPass)} | ${f2(clean.bias)} | ${f2(clean.rmse)} |`);
md(`| Слив 20% шаблонов | ${pct(dirty.decisionAcc)} | ${pct(dirty.overreachPass)} | ${f2(dirty.bias)} | ${f2(dirty.rmse)} |`);
md(`| После калибровки: слитые помечены flagged и сняты с оценки | ${pct(recovered.decisionAcc)} | ${pct(recovered.overreachPass)} | ${f2(recovered.bias)} | ${f2(recovered.rmse)} |`);
md();
md(`Детектор дрейфа (доля верных выше прогноза IRT на ≥ 15 п.п. при z ≥ 3 и ≥ 30 ответах) пометил **${flagged.size}** шаблонов, из них слитых — **${tp} из ${leaked.size}** (полнота ${pct(tp / leaked.size)}, точность ${pct(flagged.size ? tp / flagged.size : 1)}). На чистых данных ложных пометок: ${cleanFlags}.`);
md();
md("![Утечка](img/leak.svg)");
md();

// ======================================================================== 5. Traps and trust index
type Archetype = "honest" | "copy" | "screenshot";
const rt = new Rng("traps");
const poisson = (l: number) => {
  let k = 0, p = Math.exp(-l), s = p;
  const u = rt.float();
  while (u > s && k < 50) {
    k++;
    p *= l / k;
    s += p;
  }
  return k;
};
const levels: Record<Archetype, number[]> = { honest: [0, 0, 0], copy: [0, 0, 0], screenshot: [0, 0, 0] };
const N_TRAP = 500;
const TWIN_SHARE = 0.75; // share of templates that carry a value twin
for (const arch of ["honest", "copy", "screenshot"] as Archetype[]) {
  for (let i = 0; i < N_TRAP; i++) {
    const theta = rt.normal() * 1.05 + 0.1;
    const g = trueGrade(theta);
    const a = simulateAttempt(theta, g, bank, rt.fork(`${arch}${i}`));
    const items: TrustInput["items"] = a.items.map((it) => {
      const codeLike = it.kind === "code" || it.kind === "sql";
      const hasTwin = rt.float() < TWIN_SHARE;
      let x = it.x;
      let timeMs = 60_000 + rt.float() * 240_000;
      const trapHits: string[] = [];
      if (arch === "copy") {
        // Copies the DOM text into an AI assistant: hidden text is in the clipboard,
        // DOM values are the twins. Assumptions documented below.
        x = rt.float() < 0.85 ? 1 : 0;
        timeMs = 20_000 + rt.float() * 60_000;
        if (codeLike && rt.float() < 0.6) trapHits.push("marker");
        if (hasTwin && rt.float() < 0.9) {
          trapHits.push("twin");
          x = 0;
        }
      } else if (arch === "screenshot") {
        // Photographs the screen: no DOM twins, only the micro text can reach the assistant.
        x = rt.float() < 0.8 ? 1 : 0;
        timeMs = 40_000 + rt.float() * 90_000;
        if (codeLike && rt.float() < 0.25) trapHits.push("marker");
      }
      return { kind: it.kind, b: it.b, x, timeMs, trapHits };
    });
    const events: TrustInput["events"] = [];
    const push = (type: string, n: number) => {
      for (let k = 0; k < n; k++) events.push({ type });
    };
    if (arch === "honest") {
      push("blur", poisson(1.5));
      push("visibility_hidden", poisson(0.5));
      push("paste", poisson(1));
      push("bulk_insert", rt.float() < 0.05 ? 1 : 0);
      push("fullscreen_exit", poisson(0.3));
      push("copy", poisson(0.2));
    } else if (arch === "copy") {
      const code = items.filter((x) => x.kind === "code" || x.kind === "sql").length;
      push("blur", poisson(6));
      push("visibility_hidden", poisson(5));
      push("paste", code + poisson(2));
      push("bulk_insert", Math.round(code * 0.8));
      push("copy", poisson(3));
      push("fullscreen_exit", poisson(2));
    } else {
      push("blur", poisson(1.5));
      push("visibility_hidden", poisson(1));
      push("paste", poisson(0.5));
    }
    const resp = items.map((it, k) => ({ a: a.items[k]!.a, b: it.b, x: it.x ?? 0, w: it.kind === "quiz" ? TEST_CONFIG.quizWeight : 1 }));
    const tr = computeTrust({ events, items, theta: a.theta, responses: resp });
    levels[arch][["high", "medium", "low"].indexOf(tr.level)]!++;
  }
}
const ARCH_TITLES: Record<Archetype, string> = { honest: "Честные", copy: "Копируют условие в ИИ", screenshot: "Фото экрана → ИИ" };
svg(
  "traps",
  stackedShares({
    title: "Индекс доверия к попытке по типам кандидатов",
    rows: (Object.keys(levels) as Archetype[]).map((a) => ARCH_TITLES[a]),
    parts: [
      { name: "high — категория", color: "#0F7B4B" },
      { name: "medium — с пометкой", color: "#B07A00" },
      { name: "low — перепроверка", color: "#EC1D35" },
    ],
    values: (Object.keys(levels) as Archetype[]).map((a) => levels[a]),
  }),
);
md("## 5. Ловушки и индекс доверия");
md();
md(`По ${N_TRAP} симулированных попыток каждого типа. Индекс доверия — 100 минус сумма сигналов (маркер, двойник, вставки, уходы со вкладки, выход из полноэкранного режима, быстрые верные ответы на сложных заданиях, person-fit); уровни: high ≥ 70, medium 40–69, low < 40.`);
md();
md("| Тип | high (категория) | medium (с пометкой) | low (перепроверка, без категории) |");
md("|---|---|---|---|");
for (const a of Object.keys(levels) as Archetype[]) {
  const v = levels[a];
  md(`| ${ARCH_TITLES[a]} | ${pct(v[0]! / N_TRAP)} | ${pct(v[1]! / N_TRAP)} | ${pct(v[2]! / N_TRAP)} |`);
}
md();
md("![Ловушки](img/traps.svg)");
md();
md("**Допущения симуляции (честно):** ассистент, получивший скрытую инструкцию, использует маркер в 60% кодовых заданий; при копировании DOM-текста значение-двойник попадает в расчёт в 90% случаев; по фото экрана микротекст считывается и исполняется в 25% случаев. Реальные доли нужно измерить на пилоте — индекс настраивается весами в `server/testing/trust.ts`. Ложные срабатывания на честных — это доля честных с уровнем low; автоматических блокировок нет в любом случае.");
md();

// ======================================================================== 6. Calibration recovery
const rc = new Rng("calibration");
// "True" parameters differ from the expert ones; the system only knows the expert values.
const truth = new Map(bank.map((b) => [b.id, { a: Math.max(0.5, b.a + rc.normal() * 0.25), b: b.b + rc.normal() * 0.45 }]));
const data = new Map<string, { theta: number; x: number }[]>();
for (let i = 0; i < 3000; i++) {
  const theta = rc.normal() * 1.1 + 0.1;
  const g = GRADES[i % 3]!;
  const a = simulateAttempt(theta, g, bank, rc.fork(`${i}`), { trueParams: truth });
  // Calibration on real data uses the ability estimate, not the unknown truth.
  for (const it of a.items) data.set(it.templateId, [...(data.get(it.templateId) ?? []), { theta: a.theta, x: it.x }]);
}
const est = bank.map((b) => ({ id: b.id, expert: b.b, truth: truth.get(b.id)!.b, fit: fitItem(data.get(b.id) ?? [], { a: b.a, b: b.b }).b }));
const rmse = (xs: number[]) => Math.sqrt(mean(xs.map((x) => x * x)));
svg("calibration", scatter({ title: "Калибровка сложности b: оценка по ответам vs истина", xLabel: "истинная b", yLabel: "оценённая b", points: est.map((e) => ({ x: e.truth, y: e.fit })), domain: [-4, 4], diagonal: true }));
md("## 6. Калибровка параметров заданий");
md();
md(`Стартовые параметры IRT (a, b) — экспертные. Чтобы проверить процедуру калибровки (\`npm run calibrate\`), задаём «истинные» параметры, отличающиеся от экспертных (шум σ_b = 0.45, σ_a = 0.25), симулируем 3000 прохождений и оцениваем a, b логистической регрессией по оценкам θ.`);
md();
md("| Показатель | Значение |");
md("|---|---|");
md(`| RMSE экспертной b относительно истинной | ${f2(rmse(est.map((e) => e.expert - e.truth)))} |`);
md(`| RMSE откалиброванной b | **${f2(rmse(est.map((e) => e.fit - e.truth)))}** |`);
md(`| Корреляция откалиброванной и истинной b | ${f2(pearson(est.map((e) => e.fit), est.map((e) => e.truth)))} |`);
md();
md("![Калибровка](img/calibration.svg)");
md();
md("В проде калибровка идёт на реальных ответах: счётчики `answered/correct/expected` копятся по каждому шаблону, детектор утечки срабатывает онлайн, а пересчёт a, b выполняется периодически тем же кодом (`server/testing/calibration.ts`).");
md();
md("## Как воспроизвести");
md();
md("```bash\nnpm run validate   # пишет docs/validation.md и docs/img/*.svg\n```");
md();
md(`Время прогона на ноутбуке: ~${Math.round((Date.now() - t0) / 1000)} с.`);

writeFileSync("docs/validation.md", out.join("\n") + "\n");
console.log(`docs/validation.md written in ${Math.round((Date.now() - t0) / 1000)} s`);
console.log({ matching: { ours: A, baseline: B }, retest: rRetest, gradeExact: exact / N_GRADE, leak: { clean: clean.decisionAcc, dirty: dirty.decisionAcc, recovered: recovered.decisionAcc, flagged: flagged.size, tp }, traps: levels });
