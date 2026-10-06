import { describe, expect, it } from "vitest";
import { counterfactualHints } from "@/server/matching/counterfactual";
import { scoreCandidate, type CandidateInput, type NeedInput } from "@/server/matching/score";

const now = new Date("2026-10-06T12:00:00Z");
const cand = (id: string, o: Partial<CandidateInput> = {}): CandidateInput & { profileId: string } => ({
  profileId: id,
  grade: "middle",
  score: 22,
  trustLevel: "high",
  assignedAt: now,
  skills: [{ skill: "python", source: "test_confirmed" }],
  salaryFrom: 150000,
  salaryTo: 250000,
  format: "office",
  city: "Москва",
  lastActiveAt: now,
  achievements: [],
  ...o,
});
const need: NeedInput = { grade: "middle", stack: ["python"], salaryFrom: 180000, salaryTo: 220000, format: "office", city: "Москва" };

describe("counterfactual hints", () => {
  it("salary: names how many top candidates expect more and the smallest raise that reaches them", () => {
    const pool = [...Array.from({ length: 5 }, (_, i) => cand(`ok${i}`, { score: 19 })), ...Array.from({ length: 5 }, (_, i) => cand(`strong${i}`, { score: 29, salaryFrom: 240000 }))];
    const h = counterfactualHints(need, pool, now).find((x) => x.kind === "salary")!;
    expect(h.change.salaryTo).toBe(245000);
    expect(h.resolved).toBe(5);
    expect(h.text).toMatch(/^5 кандидатов в подборке ждут больше верха вилки\. При верхе 245\s000 ₽ \(\+10%\) в пределы войдут 5$/);
  });

  it("salary: an invitation floor above the range counts as out of reach and is called out", () => {
    const pool = [cand("a", { inviteFloor: 260000 }), cand("b")];
    const h = counterfactualHints(need, pool, now).find((x) => x.kind === "salary")!;
    expect(h.change.salaryTo).toBe(265000);
    expect(h.text).toMatch(/порог приглашений/);
  });

  it("a floor above the range zeroes the salary component (the invitation cannot be delivered)", () => {
    const withFloor = scoreCandidate(need, cand("a", { inviteFloor: 260000 }), now);
    const without = scoreCandidate(need, cand("b"), now);
    expect(withFloor.components.salary).toBe(0);
    expect(withFloor.match).toBeLessThan(without.match);
  });

  it("format and city: top candidates preferring remote work or living elsewhere", () => {
    const pool = [cand("r1", { format: "remote", city: "Казань" }), cand("r2", { format: "remote" }), cand("o1")];
    const hints = counterfactualHints(need, pool, now);
    expect(hints.find((h) => h.kind === "format")).toMatchObject({ resolved: 2, change: { format: "remote" } });
    expect(hints.find((h) => h.kind === "city")).toMatchObject({ resolved: 1, change: { city: null } });
  });

  it("no hints when nothing conflicts", () => {
    expect(counterfactualHints(need, Array.from({ length: 12 }, (_, i) => cand(`c${i}`)), now)).toEqual([]);
  });
});
