import { p2pl } from "./irt";

/**
 * Item calibration and leak detection.
 *
 * fitItem: 2PL logistic regression of responses on ability estimates (Newton
 * steps with a weak normal prior on a and b — keeps sparse items stable).
 * In production the same fit runs on real answers; in the prototype it runs
 * on synthetic candidates (scripts/calibrate.ts).
 */
export function fitItem(
  data: { theta: number; x: number }[],
  init: { a: number; b: number } = { a: 1, b: 0 },
  prior = { a: 1.1, sa: 0.5, b: 0, sb: 2 },
): { a: number; b: number; n: number } {
  let a = init.a;
  let b = init.b;
  for (let it = 0; it < 50; it++) {
    // gradient / Hessian of log-posterior w.r.t. (a, b) with z = a(theta - b)
    let ga = -(a - prior.a) / prior.sa ** 2;
    let gb = -(b - prior.b) / prior.sb ** 2;
    let haa = -1 / prior.sa ** 2;
    let hbb = -1 / prior.sb ** 2;
    let hab = 0;
    for (const { theta, x } of data) {
      const p = p2pl(theta, a, b);
      const r = x - p;
      const w = p * (1 - p);
      const d = theta - b;
      ga += r * d;
      gb += -r * a;
      haa += -w * d * d;
      hbb += -w * a * a;
      hab += w * a * d - r;
    }
    const det = haa * hbb - hab * hab;
    if (Math.abs(det) < 1e-9) break;
    let da = (hbb * ga - hab * gb) / det;
    let db = (haa * gb - hab * ga) / det;
    // If the Hessian is not negative definite, fall back to a small gradient step.
    if (!(haa < 0 && det > 0)) {
      da = -0.01 * ga;
      db = -0.01 * gb;
    }
    // Damped Newton: limit the step size.
    const step = Math.max(Math.abs(da), Math.abs(db));
    if (step > 0.5) {
      da *= 0.5 / step;
      db *= 0.5 / step;
    }
    a = Math.min(3, Math.max(0.2, a - da));
    b = Math.min(4, Math.max(-4, b - db));
    if (Math.abs(da) + Math.abs(db) < 1e-6) break;
  }
  return { a, b, n: data.length };
}

export interface ItemStats {
  id: string;
  answered: number;
  correct: number;
  /** Sum of model-predicted probabilities of a correct answer (at the theta before answering). */
  expected: number;
}

export const LEAK_RULE = { minAnswered: 30, minExcess: 0.15, minZ: 3 } as const;

/**
 * Leak drift: a template whose share of correct answers is far above what the
 * IRT model predicts for the people who got it is flagged and removed from
 * scoring until reviewed. Variance uses the binomial approximation.
 */
export function leakVerdict(s: ItemStats, rule = LEAK_RULE) {
  if (s.answered < rule.minAnswered) return { flagged: false, excess: 0, z: 0 };
  const pbar = Math.min(0.99, Math.max(0.01, s.expected / s.answered));
  const excess = (s.correct - s.expected) / s.answered;
  const z = (s.correct - s.expected) / Math.sqrt(s.answered * pbar * (1 - pbar));
  return { flagged: excess >= rule.minExcess && z >= rule.minZ, excess, z };
}
