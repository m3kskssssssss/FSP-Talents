import { describe, expect, it } from "vitest";
import { TEST_CONFIG } from "@/server/config";
import { estimate, selectNext, shouldStop, type Administered, type BankItem } from "@/server/testing/cat";
import { decide, eap, info2pl, p2pl, personFitLz, scaledScore, thetaForScore } from "@/server/testing/irt";
import { Rng } from "@/server/testing/rng";
import { BANK } from "@/server/testing/bank";

describe("IRT", () => {
  it("2PL basics", () => {
    expect(p2pl(0, 1, 0)).toBeCloseTo(0.5);
    expect(info2pl(0, 2, 0)).toBeCloseTo(1);
  });

  it("scaled score: cut -> 18/30, monotone, confident >= 25", () => {
    for (const g of ["junior", "middle", "senior"] as const) {
      expect(scaledScore(TEST_CONFIG.cutTheta[g], g)).toBeCloseTo(18, 1);
      expect(scaledScore(TEST_CONFIG.cutTheta[g] + 1, g)).toBeGreaterThan(scaledScore(TEST_CONFIG.cutTheta[g], g));
      expect(decide(TEST_CONFIG.cutTheta[g] + 0.01, g).result).toBe("passed");
      expect(decide(TEST_CONFIG.cutTheta[g] - 0.05, g).result).toBe("failed");
      expect(decide(thetaForScore(25.2, g), g).result).toBe("passed_confident");
    }
  });

  it("EAP recovers theta from many responses", () => {
    const rng = new Rng("eap");
    const items = Array.from({ length: 200 }, () => ({ a: 1.3, b: rng.normal() * 1.5 }));
    for (const truth of [-1.5, 0, 1.2]) {
      const rs = items.map((it) => ({ ...it, x: rng.float() < p2pl(truth, it.a, it.b) ? 1 : 0, w: 1 }));
      const est = eap(rs);
      expect(Math.abs(est.theta - truth)).toBeLessThan(0.35);
      expect(est.se).toBeLessThan(0.25);
    }
  });

  it("person-fit flags an aberrant pattern (hard items right, easy wrong)", () => {
    const items = Array.from({ length: 16 }, (_, i) => ({ a: 1.5, b: -2 + i * 0.27, w: 1 }));
    const normal = items.map((it) => ({ ...it, x: it.b < 0 ? 1 : 0 }));
    const aberrant = items.map((it) => ({ ...it, x: it.b < 0 ? 0 : 1 }));
    expect(personFitLz(0, aberrant)).toBeLessThan(-2);
    expect(personFitLz(0, normal)).toBeGreaterThan(-1);
  });
});

describe("CAT", () => {
  const bank: BankItem[] = BANK.filter((t) => t.specialization === "backend").map((t) => ({ id: t.id, kind: t.kind, a: t.a, b: t.b }));

  function simulate(truth: number, grade: "junior" | "middle" | "senior", seed: string) {
    const rng = new Rng(seed);
    const adm: Administered[] = [];
    for (;;) {
      const stop = shouldStop(grade, adm, { bankLeft: bank.length - adm.length });
      if (stop) return { adm, stop };
      const it = selectNext(grade, adm, bank, rng)!;
      const x = rng.float() < p2pl(truth, it.a, it.b) ? 1 : 0;
      adm.push({ ...it, x });
    }
  }

  it("respects length limits, no repeats, quiz <= 30% at every prefix", () => {
    for (let i = 0; i < 60; i++) {
      const truth = new Rng(`t${i}`).normal();
      const { adm } = simulate(truth, (["junior", "middle", "senior"] as const)[i % 3]!, `cat${i}`);
      expect(adm.length).toBeGreaterThanOrEqual(TEST_CONFIG.minItems);
      expect(adm.length).toBeLessThanOrEqual(TEST_CONFIG.maxItems);
      expect(new Set(adm.map((a) => a.id)).size).toBe(adm.length);
      let q = 0;
      adm.forEach((a, k) => {
        if (a.kind === "quiz") q++;
        expect(q).toBeLessThanOrEqual(TEST_CONFIG.quizMaxShare * (k + 1) + 1e-9);
      });
    }
  });

  it("strong candidates score higher than weak ones on average", () => {
    const avg = (truth: number) => {
      let s = 0;
      for (let i = 0; i < 40; i++) {
        const { adm } = simulate(truth, "middle", `avg${truth}-${i}`);
        s += estimate("middle", adm).theta;
      }
      return s / 40;
    };
    expect(avg(1.5)).toBeGreaterThan(avg(-1.5) + 1.5);
  });
});
