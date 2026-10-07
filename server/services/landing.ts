import { and, count, countDistinct, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "../db";
import {
  candidateProfiles,
  candidateSkills,
  categories,
  employers,
  fspAchievements,
  taskTemplates,
  vacancies,
} from "../db/schema";
import { skillTitle } from "../matching/skills";
import { listOpenVacancies } from "./vacancies";

/**
 * Data for the public landing page. Nothing here identifies a person: no
 * names, ids or contacts — only the category, test result and skills that an
 * employer would see before an invitation is accepted.
 */
export async function landingData() {
  const [stats, candidates, jobs] = await Promise.all([
    landingStats(),
    featuredCandidates(6),
    listOpenVacancies().then((r) => r.slice(0, 5)),
  ]);
  return {
    stats,
    candidates,
    vacancies: jobs.map(({ v, company, verified }) => ({
      id: v.id,
      title: v.title,
      company,
      verified: verified === "verified",
      specialization: v.specialization,
      grade: v.grade,
      salaryFrom: v.salaryFrom,
      salaryTo: v.salaryTo,
      format: v.format,
      city: v.city,
      stack: v.stack.slice(0, 4).map(skillTitle),
    })),
  };
}

async function landingStats() {
  const visibleCategory = and(
    eq(categories.status, "active"),
    eq(candidateProfiles.visibility, "visible"),
  );
  const [[cand], [vac], [emp], [tpl]] = await Promise.all([
    db()
      .select({ n: countDistinct(categories.profileId) })
      .from(categories)
      .innerJoin(candidateProfiles, eq(candidateProfiles.id, categories.profileId))
      .where(visibleCategory),
    db().select({ n: count() }).from(vacancies).where(eq(vacancies.status, "open")),
    db().select({ n: count() }).from(employers).where(eq(employers.verifiedStatus, "verified")),
    db().select({ n: count() }).from(taskTemplates).where(eq(taskTemplates.status, "active")),
  ]);
  return {
    candidates: cand?.n ?? 0,
    vacancies: vac?.n ?? 0,
    employers: emp?.n ?? 0,
    templates: tpl?.n ?? 0,
  };
}

/** Strongest visible candidates, one specialization after another so the row is varied. */
async function featuredCandidates(limit: number) {
  const top = await db()
    .select({
      profileId: categories.profileId,
      specialization: categories.specialization,
      grade: categories.grade,
      score: categories.score,
      city: candidateProfiles.city,
      experienceYears: candidateProfiles.experienceYears,
      workFormat: candidateProfiles.workFormat,
    })
    .from(categories)
    .innerJoin(candidateProfiles, eq(candidateProfiles.id, categories.profileId))
    .where(
      and(
        eq(categories.status, "active"),
        eq(categories.trustLevel, "high"),
        eq(candidateProfiles.visibility, "visible"),
      ),
    )
    .orderBy(desc(categories.score))
    .limit(80);
  const bySpec = new Map<string, typeof top>();
  for (const c of top) bySpec.set(c.specialization, [...(bySpec.get(c.specialization) ?? []), c]);
  const picked: typeof top = [];
  const seen = new Set<string>();
  while (picked.length < limit && [...bySpec.values()].some((l) => l.length)) {
    for (const list of bySpec.values()) {
      const c = list.shift();
      if (c && !seen.has(c.profileId) && picked.length < limit) {
        seen.add(c.profileId);
        picked.push(c);
      }
    }
  }
  if (!picked.length) return [];
  const ids = picked.map((c) => c.profileId);
  const [skills, achs] = await Promise.all([
    db().select().from(candidateSkills).where(inArray(candidateSkills.profileId, ids)),
    db()
      .select({ profileId: fspAchievements.profileId, place: fspAchievements.place })
      .from(fspAchievements)
      .where(and(inArray(fspAchievements.profileId, ids), ne(fspAchievements.source, "self"))),
  ]);
  return picked.map((c) => {
    const own = skills
      .filter((s) => s.profileId === c.profileId)
      .sort(
        (a, b) => Number(b.source === "test_confirmed") - Number(a.source === "test_confirmed"),
      );
    const mine = achs.filter((a) => a.profileId === c.profileId);
    const places = mine.map((a) => a.place).filter((p): p is number => p !== null);
    return {
      specialization: c.specialization,
      grade: c.grade,
      score: c.score,
      city: c.city,
      experienceYears: c.experienceYears,
      workFormat: c.workFormat,
      skills: [...new Set(own.map((s) => s.skill))]
        .slice(0, 4)
        .map((s) => ({
          title: skillTitle(s),
          confirmed: own.some((o) => o.skill === s && o.source === "test_confirmed"),
        })),
      achievements: mine.length,
      bestPlace: places.length ? Math.min(...places) : null,
    };
  });
}

export type LandingData = Awaited<ReturnType<typeof landingData>>;
