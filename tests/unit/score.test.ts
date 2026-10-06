import { describe, expect, it } from "vitest";
import { fspRaw, scoreCandidate, type CandidateInput, type FspAchievementInput, type NeedInput } from "@/server/matching/score";
import { extractSkills, normalizeSkill } from "@/server/matching/skills";

const now = new Date("2026-10-06T00:00:00Z");
const need: NeedInput = { grade: "middle", stack: ["python", "postgresql", "docker"], salaryFrom: 200000, salaryTo: 280000, format: "remote", city: null };
const base: CandidateInput = {
  grade: "middle",
  score: 22,
  trustLevel: "high",
  assignedAt: new Date("2026-09-20"),
  skills: [],
  salaryFrom: 220000,
  salaryTo: 260000,
  format: "remote",
  city: "Казань",
  lastActiveAt: new Date("2026-10-01"),
  achievements: [],
};
const ach = (place: number | null, extra: Partial<FspAchievementInput> = {}): FspAchievementInput => ({
  competition: "Чемпионат России по спортивному программированию",
  stage: "final",
  year: 2026,
  place,
  source: "fsp_registry",
  ...extra,
});

describe("matching score", () => {
  it("is deterministic and within 0..100", () => {
    const a = scoreCandidate(need, base, now);
    expect(scoreCandidate(need, base, now)).toEqual(a);
    expect(a.match).toBeGreaterThan(0);
    expect(a.match).toBeLessThanOrEqual(100);
  });

  it("one win outweighs a hundred participations without a place (diminishing returns)", () => {
    const win = fspRaw([ach(1)], now);
    const hundred = fspRaw(Array.from({ length: 100 }, () => ach(null)), now);
    expect(win).toBeGreaterThan(hundred);
    // and more achievements still help, but less and less
    const five = fspRaw(Array.from({ length: 5 }, () => ach(3)), now);
    const fifty = fspRaw(Array.from({ length: 50 }, () => ach(3)), now);
    expect(fifty).toBeGreaterThan(five);
    expect(fifty - five).toBeLessThan(five);
  });

  it("trust in source matters: registry > organizer > repo > self", () => {
    const v = (source: FspAchievementInput["source"]) => fspRaw([ach(1, { source })], now);
    expect(v("fsp_registry")).toBeGreaterThan(v("organizer"));
    expect(v("organizer")).toBeGreaterThan(v("repo"));
    expect(v("repo")).toBeGreaterThan(v("self"));
  });

  it("candidate without FSP history is scored normally, just without the bonus (hard rule #6)", () => {
    const r = scoreCandidate(need, base, now);
    expect(r.components.fsp).toBe(0);
    expect(r.cons).toContain("Истории в ФСП нет");
    const withFsp = scoreCandidate(need, { ...base, achievements: [ach(2)] }, now);
    expect(withFsp.match).toBeGreaterThan(r.match);
  });

  it("test-confirmed skills weigh more than declared ones; declared are marked", () => {
    const declared = scoreCandidate(need, { ...base, skills: need.stack.map((skill) => ({ skill, source: "declared" as const })) }, now);
    const tested = scoreCandidate(need, { ...base, skills: need.stack.map((skill) => ({ skill, source: "test_confirmed" as const })) }, now);
    expect(tested.components.stack).toBeGreaterThan(declared.components.stack);
    expect(declared.pros.join(" ")).toMatch(/Заявлен опыт.*не проверено тестом/);
    expect(tested.pros.join(" ")).toMatch(/подтверждены тестом/);
  });

  it("salary above the range is a penalty, not an exclusion", () => {
    const above = scoreCandidate(need, { ...base, salaryFrom: 350000 }, now);
    expect(above.match).toBeGreaterThan(0);
    expect(above.components.salary).toBeLessThan(1);
    expect(above.cons.join(" ")).toMatch(/выше вилки/);
    const upper = scoreCandidate(need, { ...base, salaryFrom: 270000 }, now);
    expect(upper.cons.join(" ")).toMatch(/верхней границе/);
  });

  it("higher test score -> higher match, other things equal", () => {
    expect(scoreCandidate(need, { ...base, score: 27 }, now).match).toBeGreaterThan(scoreCandidate(need, base, now).match);
  });

  it("always gives 2-4 arguments for and 1-2 against", () => {
    for (const c of [base, { ...base, achievements: [ach(1)], skills: need.stack.map((skill) => ({ skill, source: "test_confirmed" as const })) }]) {
      const r = scoreCandidate(need, c, now);
      expect(r.pros.length).toBeGreaterThanOrEqual(2);
      expect(r.pros.length).toBeLessThanOrEqual(4);
      expect(r.cons.length).toBeGreaterThanOrEqual(1);
      expect(r.cons.length).toBeLessThanOrEqual(2);
    }
  });
});

describe("skills dictionary", () => {
  it("normalises aliases and extracts skills from text", () => {
    expect(normalizeSkill("Postgres")).toBe("postgresql");
    expect(normalizeSkill("k8s")).toBe("kubernetes");
    expect(extractSkills("Ищем бэкендера: Python 3, Django/FastAPI, PostgreSQL, Redis, Docker, k8s. Go не нужен")).toEqual(
      ["django", "docker", "fastapi", "kubernetes", "postgresql", "python", "redis"],
    );
  });
});
