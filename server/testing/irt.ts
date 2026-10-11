import { TEST_CONFIG, type Grade } from "../config";

/** 2PL item response function. */
export const p2pl = (theta: number, a: number, b: number) => 1 / (1 + Math.exp(-a * (theta - b)));

/** Fisher information of a 2PL item at theta. */
export const info2pl = (theta: number, a: number, b: number) => {
  const p = p2pl(theta, a, b);
  return a * a * p * (1 - p);
};

export interface Response {
  a: number;
  b: number;
  /** Observed score in [0, 1]; fractional for partially passed hidden tests. */
  x: number;
  /** Likelihood weight (conceptual questions count less). */
  w: number;
}

const GRID: number[] = Array.from({ length: 161 }, (_, i) => -4 + i * 0.05);
export const PRIOR = { mean: 0, sd: 1.25 };

/**
 * Expected a posteriori estimate of theta with a normal prior. Fractional
 * Bernoulli likelihood: L = prod (P^x (1-P)^(1-x))^w. Returns mean and SD.
 */
export function eap(responses: Response[], prior = PRIOR): { theta: number; se: number } {
  let num = 0;
  let den = 0;
  const logPost: number[] = [];
  let max = -Infinity;
  for (const t of GRID) {
    let lp = -0.5 * ((t - prior.mean) / prior.sd) ** 2;
    for (const r of responses) {
      const p = Math.min(Math.max(p2pl(t, r.a, r.b), 1e-9), 1 - 1e-9);
      lp += r.w * (r.x * Math.log(p) + (1 - r.x) * Math.log(1 - p));
    }
    logPost.push(lp);
    if (lp > max) max = lp;
  }
  const post = logPost.map((lp) => Math.exp(lp - max));
  for (let i = 0; i < GRID.length; i++) {
    num += GRID[i]! * post[i]!;
    den += post[i]!;
  }
  const theta = num / den;
  let v = 0;
  for (let i = 0; i < GRID.length; i++) v += (GRID[i]! - theta) ** 2 * post[i]!;
  return { theta, se: Math.sqrt(v / den) };
}

// ---------------------------------------------------------------- scaled score

const REF_ITEMS = 30;
const REF_A = 1.2;
const REF_SPREAD = 1.6;

function refScore(theta: number, center: number) {
  let s = 0;
  for (let i = 0; i < REF_ITEMS; i++) {
    const b = center + REF_SPREAD * (-1 + (2 * i) / (REF_ITEMS - 1));
    s += p2pl(theta, REF_A, b);
  }
  return s;
}

/**
 * Offset of the reference form relative to the grade cut so that a candidate
 * exactly at the cut scores `passScore` (18/30). Found by bisection once.
 */
const REF_OFFSET = (() => {
  let lo = -3;
  let hi = 3;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    // A larger center makes the form harder -> lower score.
    if (refScore(0, mid) > TEST_CONFIG.passScore) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
})();

/**
 * Scaled score 0..30: expected number correct on a virtual 30-item reference
 * form of the grade (true-score equating). Comparable across adaptive attempts.
 */
export function scaledScore(theta: number, grade: Grade) {
  return refScore(theta, TEST_CONFIG.cutTheta[grade] + REF_OFFSET);
}

/** Inverse of scaledScore (theta that yields the given score), for docs & tests. */
export function thetaForScore(score: number, grade: Grade) {
  let lo = -6;
  let hi = 6;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (scaledScore(mid, grade) < score) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export type AttemptResult = "passed_confident" | "passed" | "failed";

export function decide(theta: number, grade: Grade): { score: number; result: AttemptResult } {
  const score = Math.round(scaledScore(theta, grade) * 10) / 10;
  const result: AttemptResult =
    score >= TEST_CONFIG.confidentScore ? "passed_confident" : score >= TEST_CONFIG.passScore ? "passed" : "failed";
  return { score, result };
}

/** Why an attempt got its score: the IRT scale, or one of the evidence limits below. */
export type ScoreBasis = "irt" | "no_correct" | "incomplete";

/**
 * Final score of an attempt. The EAP estimate leans on a prior centred near the
 * chosen grade, so with little or no evidence it still maps to points (no
 * answers -> 18/30, six wrong -> ~8/30). Points must be earned instead:
 *  - not a single correct answer (none given, all skipped or wrong) -> 0;
 *  - fewer than `minScoredItems` answers -> only the correct answers count,
 *    and the attempt fails (the scale needs more evidence than that).
 * `answers` are the scores in [0,1] of the answered items.
 */
export function attemptScore(theta: number, grade: Grade, answers: number[]): { score: number; result: AttemptResult; basis: ScoreBasis } {
  const { basis, earned } = scoreBasis(answers);
  if (basis === "no_correct") return { score: 0, result: "failed", basis };
  const d = decide(theta, grade);
  if (basis === "incomplete") return { score: Math.min(d.score, earned), result: "failed", basis };
  return { ...d, basis };
}

/** Which rule of attemptScore applies, and the points actually earned. */
export function scoreBasis(answers: number[]): { basis: ScoreBasis; earned: number } {
  const earned = Math.round(answers.reduce((s, x) => s + x, 0) * 10) / 10;
  if (earned === 0) return { basis: "no_correct", earned };
  if (answers.length < TEST_CONFIG.minScoredItems) return { basis: "incomplete", earned };
  return { basis: "irt", earned };
}

/** Standardised person-fit statistic lz (Drasgow et al.). Large negative = aberrant pattern. */
export function personFitLz(theta: number, responses: Response[]) {
  let l0 = 0;
  let e = 0;
  let v = 0;
  for (const r of responses) {
    const p = Math.min(Math.max(p2pl(theta, r.a, r.b), 1e-6), 1 - 1e-6);
    const x = r.x >= 0.5 ? 1 : 0;
    l0 += x * Math.log(p) + (1 - x) * Math.log(1 - p);
    e += p * Math.log(p) + (1 - p) * Math.log(1 - p);
    v += p * (1 - p) * Math.log(p / (1 - p)) ** 2;
  }
  return v > 0 ? (l0 - e) / Math.sqrt(v) : 0;
}
