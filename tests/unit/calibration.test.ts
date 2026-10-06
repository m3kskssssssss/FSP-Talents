import { describe, expect, it } from "vitest";
import { fitItem, leakVerdict } from "@/server/testing/calibration";
import { p2pl } from "@/server/testing/irt";
import { Rng } from "@/server/testing/rng";

describe("calibration", () => {
  it("recovers 2PL parameters from responses", () => {
    const rng = new Rng("fit");
    for (const truth of [{ a: 0.8, b: -1 }, { a: 1.5, b: 0.5 }, { a: 1.2, b: 1.8 }]) {
      const data = Array.from({ length: 1500 }, () => {
        const theta = rng.normal() * 1.2;
        return { theta, x: rng.float() < p2pl(theta, truth.a, truth.b) ? 1 : 0 };
      });
      const est = fitItem(data);
      expect(Math.abs(est.b - truth.b)).toBeLessThan(0.25);
      expect(Math.abs(est.a - truth.a)).toBeLessThan(0.35);
    }
  });

  it("flags a leaked item and leaves a normal one alone", () => {
    expect(leakVerdict({ id: "x", answered: 100, correct: 52, expected: 50 }).flagged).toBe(false);
    expect(leakVerdict({ id: "x", answered: 100, correct: 85, expected: 50 }).flagged).toBe(true);
    expect(leakVerdict({ id: "x", answered: 10, correct: 10, expected: 3 }).flagged).toBe(false);
  });
});
