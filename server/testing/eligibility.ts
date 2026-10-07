import { GRADE_TITLES, GRADES, TEST_CONFIG, gradeIndex, type Grade } from "../config";
import { DAY_MS } from "../lib/time";

export interface PastAttempt {
  grade: Grade;
  status: "in_progress" | "finished" | "expired" | "abandoned";
  finishedAt: Date | null;
  startedAt: Date;
  score: number | null;
}

/** The active category of the specialization, if any. */
export interface CurrentCategory {
  grade: Grade;
  assignedAt: Date;
}

export type Eligibility =
  | { ok: true }
  | {
      ok: false;
      code:
        | "in_progress"
        | "cooldown"
        | "needs_confident_lower"
        | "grade_change_cooldown"
        | "below_category";
      message: string;
      availableAt?: Date;
    };

/**
 * Retake rules (confirmed with the product owner):
 *  - the same grade can be retried once per `retrySameGradeDays` (14 days);
 *  - a lower grade than one already attempted is available immediately,
 *    but never below the active category: such a test could neither raise
 *    nor take away the category, so it is not offered at all;
 *  - a higher grade than any attempted before requires a confident result
 *    (>= 25/30) on the grade right below it;
 *  - the very first attempt in a specialization: any grade.
 * Grade change is limited in time (case requirement): during the first
 * `calibrationDays` after the first finished attempt the candidate may climb
 * freely (finding their level); after that, a test above the active category
 * opens `gradeChangeCooldownDays` after that category was assigned.
 * Downgrades are never forced: failing does not remove an existing category.
 */
export function checkEligibility(
  history: PastAttempt[],
  grade: Grade,
  now = new Date(),
  current?: CurrentCategory | null,
): Eligibility {
  if (history.some((a) => a.status === "in_progress")) {
    return {
      ok: false,
      code: "in_progress",
      message: "У вас есть незавершённая попытка — продолжите её.",
    };
  }
  const idx = gradeIndex(grade);
  if (current && idx < gradeIndex(current.grade)) {
    return {
      ok: false,
      code: "below_category",
      message: `У вас уже категория ${GRADE_TITLES[current.grade]} — тест на ${GRADE_TITLES[grade]} её не изменит.`,
    };
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

  if (current && idx > gradeIndex(current.grade)) {
    const firstDone = Math.min(...done.map((a) => (a.finishedAt ?? a.startedAt).getTime()));
    const calibrating = now.getTime() < firstDone + TEST_CONFIG.calibrationDays * DAY_MS;
    const availableAt = new Date(
      current.assignedAt.getTime() + TEST_CONFIG.gradeChangeCooldownDays * DAY_MS,
    );
    if (!calibrating && availableAt > now) {
      return {
        ok: false,
        code: "grade_change_cooldown",
        availableAt,
        message: `Грейд меняется не чаще раза в ${TEST_CONFIG.gradeChangeCooldownDays} дней. Тест на ${GRADE_TITLES[grade]} будет доступен ${availableAt.toLocaleDateString("ru-RU")}.`,
      };
    }
  }

  const maxAttempted = Math.max(...done.map((a) => gradeIndex(a.grade)));
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
