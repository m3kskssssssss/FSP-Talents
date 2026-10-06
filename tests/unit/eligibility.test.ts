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

  it("blocks while an attempt is in progress", () => {
    const h: PastAttempt[] = [{ grade: "junior", status: "in_progress", startedAt: now, finishedAt: null, score: null }];
    expect(checkEligibility(h, "junior", now)).toMatchObject({ ok: false, code: "in_progress" });
  });
});
