import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { candidateProfiles, candidateSkills, consents, searches, users } from "@/server/db/schema";
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
