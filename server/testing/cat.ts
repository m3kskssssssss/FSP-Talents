import { TEST_CONFIG, type Grade } from "../config";
import { eap, info2pl, PRIOR, type Response } from "./irt";
import type { Rng } from "./rng";
import type { TaskKind } from "./types";

export interface BankItem {
  id: string;
  kind: TaskKind;
  a: number;
  b: number;
  /** Share of attempts in which the item was already served (0..1). */
  exposureRate?: number;
}

export interface Administered {
  id: string;
  kind: TaskKind;
  a: number;
  b: number;
  /** Score in [0,1]; undefined while unanswered. */
  x?: number;
}

/** Item limits are numbers (not literals) so that the express check can override them. */
export type CatConfig = Omit<typeof TEST_CONFIG, "minItems" | "maxItems"> & { minItems: number; maxItems: number };

export const itemWeight = (kind: TaskKind, cfg: CatConfig = TEST_CONFIG) => (kind === "quiz" ? cfg.quizWeight : 1);

export function toResponses(items: Administered[], cfg: CatConfig = TEST_CONFIG): Response[] {
  return items
    .filter((i) => i.x !== undefined)
    .map((i) => ({ a: i.a, b: i.b, x: i.x!, w: itemWeight(i.kind, cfg) }));
}

/** Current ability estimate; before any answer it is the start point of the chosen grade. */
export function estimate(grade: Grade, items: Administered[], cfg: CatConfig = TEST_CONFIG) {
  const rs = toResponses(items, cfg);
  if (!rs.length) return { theta: cfg.startTheta[grade], se: PRIOR.sd };
  // Prior centred between population mean and the chosen grade: the choice is
  // informative but must not dominate the evidence.
  return eap(rs, { mean: cfg.startTheta[grade] / 2, sd: PRIOR.sd });
}

function kindShares(bank: BankItem[], cfg: CatConfig) {
  const counts = new Map<TaskKind, number>();
  for (const b of bank) counts.set(b.kind, (counts.get(b.kind) ?? 0) + 1);
  const total = bank.length || 1;
  const shares = new Map<TaskKind, number>();
  for (const [k, c] of counts) shares.set(k, k === "quiz" ? Math.min(c / total, cfg.quizMaxShare * 0.7) : c / total);
  const sum = [...shares.values()].reduce((s, v) => s + v, 0) || 1;
  for (const [k, v] of shares) shares.set(k, v / sum);
  return shares;
}

/**
 * Picks the next item: maximum Fisher information at the current theta,
 * subject to content balancing (kind shares, quiz <= 30% at every prefix,
 * no three items of the same kind in a row) and exposure control
 * (randomesque choice among top-K, penalty for over-exposed items).
 */
export function selectNext(
  grade: Grade,
  administered: Administered[],
  bank: BankItem[],
  rng: Rng,
  cfg: CatConfig = TEST_CONFIG,
): BankItem | null {
  const used = new Set(administered.map((a) => a.id));
  const pool = bank.filter((b) => !used.has(b.id));
  if (!pool.length) return null;
  const { theta } = estimate(grade, administered, cfg);
  const n = administered.length;
  const quizCount = administered.filter((a) => a.kind === "quiz").length;
  const lastTwo = administered.slice(-2).map((a) => a.kind);
  const shares = kindShares(bank, cfg);
  const kindCount = (k: TaskKind) => administered.filter((a) => a.kind === k).length;

  const scored = pool
    .filter((it) => {
      if (it.kind === "quiz" && quizCount + 1 > cfg.quizMaxShare * (n + 1)) return false;
      if (lastTwo.length === 2 && lastTwo[0] === it.kind && lastTwo[1] === it.kind) return false;
      return true;
    })
    .map((it) => {
      const deficit = (shares.get(it.kind) ?? 0) * (n + 1) - kindCount(it.kind);
      const balance = Math.exp(0.9 * Math.max(-2, Math.min(2, deficit)));
      const exposure = 1 / (1 + 4 * Math.max(0, (it.exposureRate ?? 0) - 0.3));
      const weight = itemWeight(it.kind, cfg);
      return { it, score: info2pl(theta, it.a * Math.sqrt(weight), it.b) * balance * exposure };
    })
    .sort((x, y) => y.score - x.score);

  const candidates = scored.length ? scored : pool.map((it) => ({ it, score: 1 }));
  const top = candidates.slice(0, Math.min(cfg.topK, candidates.length));
  return rng.pick(top).it;
}

export type StopReason = "se" | "decision" | "max_items" | "bank_exhausted" | "deadline";

export function shouldStop(
  grade: Grade,
  administered: Administered[],
  opts: { bankLeft: number; now?: Date; deadline?: Date },
  cfg: CatConfig = TEST_CONFIG,
): StopReason | null {
  if (opts.deadline && opts.now && opts.now >= opts.deadline) return "deadline";
  const answered = administered.filter((a) => a.x !== undefined).length;
  if (answered >= cfg.maxItems) return "max_items";
  if (opts.bankLeft <= 0) return "bank_exhausted";
  if (answered < cfg.minItems) return null;
  const { theta, se } = estimate(grade, administered, cfg);
  if (se < cfg.seStop) return "se";
  if (Math.abs(theta - cfg.cutTheta[grade]) / se >= cfg.decisionZ) return "decision";
  return null;
}
