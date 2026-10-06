import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { candidateProfiles, candidateSkills, consents, searches, testAttempts, users } from "@/server/db/schema";
import { addToShortlist, listShortlist, searchBase, searchForNeed, searchResults } from "@/server/services/matching";
import { createNeed } from "@/server/services/needs";
import { needCreateSchema } from "@/server/schemas/needs";
import { resetDb } from "../helpers/db";
import { makeCandidate, makeCategorized, makeEmployer } from "../helpers/factories";

const needInput = needCreateSchema.parse({
  title: "Python backend",
  specialization: "backend",
  grade: "middle",
  stack: ["Python", "Postgres"],
  salaryFrom: 200000,
  salaryTo: 300000,
  format: "remote",
});

describe("matching service", () => {
  beforeEach(resetDb);

  it("builds the pool from test categories only and never exposes contacts", async () => {
    const emp = await makeEmployer();
    const need = await createNeed(emp.employerId, needInput);
    const strong = await makeCategorized({
      score: 27,
      fullName: "Анна Новикова",
      skills: [{ skill: "python", source: "test_confirmed" }, { skill: "sql", source: "test_confirmed" }],
      fsp: [{ place: 1 }],
      contacts: { email: "anna-secret@mail.ru", phone: "+7 900 000-00-01", telegram: "@anna_secret" },
    });
    const declared = await makeCategorized({ score: 20, skills: [{ skill: "python", source: "declared" }] });
    const junior = await makeCategorized({ grade: "junior", score: 28 });
    const hidden = await makeCategorized({ score: 29 });
    await db().update(candidateProfiles).set({ visibility: "hidden" }).where(eq(candidateProfiles.id, hidden.profileId));
    const revoked = await makeCategorized({ score: 29 });
    await db().update(consents).set({ revokedAt: new Date() }).where(eq(consents.userId, revoked.user.id));
    const deleted = await makeCategorized({ score: 29 });
    await db().update(users).set({ deletedAt: new Date() }).where(eq(users.id, deleted.user.id));
    await makeCategorized({ spec: "frontend", score: 29 });
    // Rule #5: no category -> not in the results, whatever the resume says.
    const noCat = await makeCandidate();
    await db().insert(candidateSkills).values({ profileId: noCat.profileId, skill: "python", source: "declared" });

    const { searchId, total } = await searchForNeed(emp.employerId, need.id);
    expect(total).toBe(3);
    const res = await searchResults(emp.employerId, searchId, {});
    expect(res.items.map((c) => c.profileId)).toEqual([strong.profileId, declared.profileId, junior.profileId]);
    expect(res.items[2]!.near).toBe(true);
    expect(res.items[0]!.displayName).toBe("Анна Н.");
    expect(res.items[0]!.pros.join(" ")).toMatch(/Python.*подтвержд/);
    expect(res.items[1]!.pros.join(" ")).toMatch(/не проверено тестом/);
    // Hard rule #2: no contact data in any form.
    const json = JSON.stringify(res);
    for (const secret of ["anna-secret", "900 000", "@anna_secret", "Новикова"]) expect(json).not.toContain(secret);
    expect(Object.keys(res.items[0]!)).not.toContain("contacts");
  });

  it("filters work on top of the snapshot; reset restores it", async () => {
    const emp = await makeEmployer();
    const need = await createNeed(emp.employerId, needInput);
    const withFsp = await makeCategorized({ score: 21, fsp: [{ place: 2 }], city: "Казань" });
    await makeCategorized({ score: 26, city: "Москва" });
    await makeCategorized({ grade: "senior", score: 20 });
    const { searchId } = await searchForNeed(emp.employerId, need.id);
    const [before] = await db().select().from(searches).where(eq(searches.id, searchId));

    const fsp = await searchResults(emp.employerId, searchId, { onlyFsp: true });
    expect(fsp.items.map((c) => c.profileId)).toEqual([withFsp.profileId]);
    expect((await searchResults(emp.employerId, searchId, { city: "казань" })).total).toBe(1);
    expect((await searchResults(emp.employerId, searchId, { includeNear: false })).total).toBe(2);
    expect((await searchResults(emp.employerId, searchId, { minScore: 25 })).total).toBe(1);

    const reset = await searchResults(emp.employerId, searchId, {});
    expect(reset.total).toBe(3);
    const [after] = await db().select().from(searches).where(eq(searches.id, searchId));
    expect(after!.baseSnapshot).toEqual(before!.baseSnapshot);
  });

  it("unconfirmed grade: shown last with a status, not hidden (Q&A)", async () => {
    const emp = await makeEmployer();
    const need = await createNeed(emp.employerId, needInput);
    const confirmed = await makeCategorized({ score: 19 });
    const failedAt = (profileId: string, opts: { grade?: "junior" | "middle" | "senior"; answered?: number; trust?: "high" | "low"; score?: number } = {}) =>
      db().insert(testAttempts).values({
        profileId,
        specialization: "backend",
        targetGrade: opts.grade ?? "middle",
        status: "finished",
        deadlineAt: new Date(),
        finishedAt: new Date(),
        score: opts.score ?? 16,
        theta: 0,
        se: 0.4,
        result: "failed",
        trustLevel: opts.trust ?? "high",
        trustSignals: { answered: opts.answered ?? 14 },
        seed: "s",
        marker: "m",
      });
    const unconf = await makeCandidate({ fullName: "Пётр Петров" });
    await failedAt(unconf.profileId, { score: 17 });
    const lowTrust = await makeCandidate();
    await failedAt(lowTrust.profileId, { trust: "low" });
    const abandoned = await makeCandidate();
    await failedAt(abandoned.profileId, { answered: 2 });
    const otherGrade = await makeCandidate();
    await failedAt(otherGrade.profileId, { grade: "senior" });
    // Has a confirmed junior category: shown as junior (near), not as unconfirmed middle.
    const juniorCat = await makeCategorized({ grade: "junior", score: 26 });
    await failedAt(juniorCat.profileId);

    const { searchId } = await searchForNeed(emp.employerId, need.id);
    const res = await searchResults(emp.employerId, searchId, {});
    expect(res.items.map((c) => c.profileId)).toEqual([confirmed.profileId, juniorCat.profileId, unconf.profileId]);
    const last = res.items[2]!;
    expect(last.confirmed).toBe(false);
    expect(last.category.score).toBe(17);
    expect(last.cons[0]).toMatch(/не подтверждён/);
    expect(res.items[1]!.confirmed).toBe(true);
    expect((await searchResults(emp.employerId, searchId, { includeUnconfirmed: false })).total).toBe(2);
    // Can still be shortlisted and opened.
    await addToShortlist(emp.employerId, unconf.profileId);
  });

  it("other employers cannot open someone else's search or need", async () => {
    const a = await makeEmployer();
    const b = await makeEmployer();
    const need = await createNeed(a.employerId, needInput);
    const { searchId } = await searchForNeed(a.employerId, need.id);
    await expect(searchResults(b.employerId, searchId, {})).rejects.toMatchObject({ status: 404 });
    await expect(searchForNeed(b.employerId, need.id)).rejects.toMatchObject({ status: 404 });
  });

  it("base search without a need and shortlist", async () => {
    const emp = await makeEmployer();
    const c = await makeCategorized({ score: 24, skills: [{ skill: "python", source: "test_confirmed" }] });
    const { searchId, total } = await searchBase(emp.employerId, { specialization: "backend", stack: ["python"] });
    expect(total).toBe(1);
    expect((await searchResults(emp.employerId, searchId, {})).items[0]!.profileId).toBe(c.profileId);
    await addToShortlist(emp.employerId, c.profileId);
    const sl = await listShortlist(emp.employerId);
    expect(sl.map((x) => x.profileId)).toEqual([c.profileId]);
    const nobody = await makeCandidate();
    await expect(addToShortlist(emp.employerId, nobody.profileId)).rejects.toMatchObject({ status: 404 });
  });
});
