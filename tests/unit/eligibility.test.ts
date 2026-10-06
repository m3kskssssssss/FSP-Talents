import { describe, expect, it } from "vitest";
import { checkEligibility, type PastAttempt } from "@/server/testing/eligibility";

const now = new Date("2026-10-06T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000);
const att = (grade: PastAttempt["grade"], score: number, days: number): PastAttempt => ({
  grade,
  score,
  status: "finished",
  startedAt: daysAgo(days),
  finishedAt: daysAgo(days),
});

describe("retake rules (hard rule #7)", () => {
  it("first attempt: any grade", () => {
    for (const g of ["junior", "middle", "senior"] as const) expect(checkEligibility([], g, now).ok).toBe(true);
  });

  it("same grade: not earlier than 14 days", () => {
    const r = checkEligibility([att("middle", 12, 13)], "middle", now);
    expect(r).toMatchObject({ ok: false, code: "cooldown" });
    expect(checkEligibility([att("middle", 12, 14)], "middle", now).ok).toBe(true);
  });

  it("failed middle -> junior immediately (downgrade is not forced, but allowed)", () => {
    expect(checkEligibility([att("middle", 10, 0)], "junior", now).ok).toBe(true);
  });

  it("higher grade requires >= 25/30 on the grade below", () => {
    expect(checkEligibility([att("junior", 24.9, 0)], "middle", now)).toMatchObject({ ok: false, code: "needs_confident_lower" });
    expect(checkEligibility([att("junior", 25, 0)], "middle", now).ok).toBe(true);
    // Confident junior does not unlock senior directly.
    expect(checkEligibility([att("junior", 29, 0)], "senior", now)).toMatchObject({ ok: false });
  });

  it("grade below the highest attempted counts as lower, not higher", () => {
    expect(checkEligibility([att("senior", 5, 0), att("junior", 10, 0)], "middle", now).ok).toBe(true);
  });

  it("climbing is free during the calibration week after the first attempt", () => {
    const h = [att("junior", 27, 3)];
    expect(checkEligibility(h, "middle", now, { grade: "junior", assignedAt: daysAgo(3) }).ok).toBe(true);
  });

  it("after calibration a higher grade opens 90 days after the category was assigned", () => {
    const h = [att("junior", 27, 30)];
    const cat = { grade: "junior" as const, assignedAt: daysAgo(30) };
    expect(checkEligibility(h, "middle", now, cat)).toMatchObject({ ok: false, code: "grade_change_cooldown" });
    const later = [att("junior", 27, 90)];
    expect(checkEligibility(later, "middle", now, { grade: "junior", assignedAt: daysAgo(90) }).ok).toBe(true);
  });

  it("cannot jump junior -> senior via middle in one day after calibration", () => {
    // Calibrated a month ago at junior, then confident middle is impossible before day 90.
    const h = [att("junior", 27, 40), att("middle", 26, 39)];
    expect(checkEligibility(h, "senior", now, { grade: "middle", assignedAt: daysAgo(39) })).toMatchObject({ ok: false, code: "grade_change_cooldown" });
  });

  it("grade change cooldown does not block tests at or below the active category", () => {
    const h = [att("middle", 22, 30)];
    const cat = { grade: "middle" as const, assignedAt: daysAgo(30) };
    expect(checkEligibility(h, "junior", now, cat).ok).toBe(true);
    expect(checkEligibility(h, "middle", now, cat).ok).toBe(true);
  });

  it("blocks while an attempt is in progress", () => {
    const h: PastAttempt[] = [{ grade: "junior", status: "in_progress", startedAt: now, finishedAt: null, score: null }];
    expect(checkEligibility(h, "junior", now)).toMatchObject({ ok: false, code: "in_progress" });
  });
});
