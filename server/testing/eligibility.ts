import { GRADE_TITLES, GRADES, TEST_CONFIG, gradeIndex, type Grade } from "../config";
import { DAY_MS } from "../lib/time";

export interface PastAttempt {
  grade: Grade;
  status: "in_progress" | "finished" | "expired" | "abandoned";
  finishedAt: Date | null;
  startedAt: Date;
  score: number | null;
}

export type Eligibility =
  | { ok: true }
  | { ok: false; code: "in_progress" | "cooldown" | "needs_confident_lower"; message: string; availableAt?: Date };

/**
 * Retake rules (confirmed with the product owner):
 *  - the same grade can be retried once per `retrySameGradeDays` (14 days);
 *  - a lower grade than one already attempted is available immediately;
 *  - a higher grade than any attempted before requires a confident result
 *    (>= 25/30) on the grade right below it;
 *  - the very first attempt in a specialization: any grade.
 * Downgrades are never forced: failing does not remove an existing category.
 */
export function checkEligibility(history: PastAttempt[], grade: Grade, now = new Date()): Eligibility {
  if (history.some((a) => a.status === "in_progress")) {
    return { ok: false, code: "in_progress", message: "У вас есть незавершённая попытка — продолжите её." };
  }
  const done = history.filter((a) => a.status !== "in_progress");
  if (!done.length) return { ok: true };

  const sameGrade = done
    .filter((a) => a.grade === grade)
    .map((a) => (a.finishedAt ?? a.startedAt).getTime())
    .sort((x, y) => y - x)[0];
  if (sameGrade !== undefined) {
    const availableAt = new Date(sameGrade + TEST_CONFIG.retrySameGradeDays * DAY_MS);
    if (availableAt > now) {
      return {
        ok: false,
        code: "cooldown",
        availableAt,
        message: `Повторная попытка на ${GRADE_TITLES[grade]} будет доступна ${availableAt.toLocaleDateString("ru-RU")}.`,
      };
    }
  }

  const maxAttempted = Math.max(...done.map((a) => gradeIndex(a.grade)));
  const idx = gradeIndex(grade);
  if (idx > maxAttempted) {
    const lower = GRADES[idx - 1]!;
    const best = Math.max(-1, ...done.filter((a) => a.grade === lower).map((a) => a.score ?? 0));
    if (best < TEST_CONFIG.confidentScore) {
      return {
        ok: false,
        code: "needs_confident_lower",
        message: `Чтобы перейти к ${GRADE_TITLES[grade]}, наберите не меньше ${TEST_CONFIG.confidentScore}/${TEST_CONFIG.scaleMax} на тесте ${GRADE_TITLES[lower]}.`,
      };
    }
  }
  return { ok: true };
}
