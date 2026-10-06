import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { candidateProfiles, employers, users } from "@/server/db/schema";
import { createRoleEntity, grantConsents, type Role } from "@/server/services/accounts";

let n = 0;

/** Creates a verified user with consents and the role entity. Password hash is a stub. */
export async function makeUser(role: Role, extra: { fullName?: string; companyName?: string } = {}) {
  n++;
  const email = `${role}${n}-${Date.now()}@t.ru`;
  return db().transaction(async (tx) => {
    const [u] = await tx.insert(users).values({ email, role, passwordHash: "x", emailVerifiedAt: new Date() }).returning();
    await grantConsents(tx, u!.id, ["pd_processing", "privacy_policy"]);
    await createRoleEntity(tx, u!.id, role, { ...extra, email });
    return u!;
  });
}

export async function makeCandidate(extra: { fullName?: string } = {}) {
  const u = await makeUser("candidate", { fullName: extra.fullName ?? "Кандидат" });
  const [p] = await db().select().from(candidateProfiles).where(eq(candidateProfiles.userId, u.id));
  return { user: u, profileId: p!.id };
}

export async function makeEmployer(companyName = "ООО Тест") {
  const u = await makeUser("employer", { companyName });
  const [e] = await db().select().from(employers).where(eq(employers.userId, u.id));
  return { user: u, employerId: e!.id };
}

import { candidateContacts, candidateSkills, categories, consents, fspAchievements } from "@/server/db/schema";

export async function makeCategorized(opts: {
  spec?: "backend" | "frontend" | "data" | "qa";
  grade?: "junior" | "middle" | "senior";
  score?: number;
  fullName?: string;
  city?: string;
  salaryFrom?: number;
  skills?: { skill: string; source: "declared" | "resume" | "test_confirmed" }[];
  fsp?: { place: number | null; source?: "fsp_registry" | "self" }[];
  contacts?: { email?: string; phone?: string; telegram?: string };
}) {
  const c = await makeCandidate({ fullName: opts.fullName ?? "Иван Иванов" });
  await db()
    .update(candidateProfiles)
    .set({ city: opts.city ?? "Москва", salaryExpectFrom: opts.salaryFrom ?? 200000, salaryExpectTo: (opts.salaryFrom ?? 200000) + 50000, workFormat: "remote" })
    .where(eq(candidateProfiles.id, c.profileId));
  await db()
    .insert(categories)
    .values({ profileId: c.profileId, specialization: opts.spec ?? "backend", grade: opts.grade ?? "middle", score: opts.score ?? 22, theta: 0.5, se: 0.3 });
  if (opts.skills?.length) await db().insert(candidateSkills).values(opts.skills.map((s) => ({ ...s, profileId: c.profileId })));
  if (opts.fsp?.length)
    await db().insert(fspAchievements).values(
      opts.fsp.map((f, i) => ({
        profileId: c.profileId,
        competition: "Чемпионат России",
        discipline: "алгоритмическое",
        stage: "final" as const,
        year: 2026,
        place: f.place,
        source: f.source ?? ("fsp_registry" as const),
        trustLevel: "high" as const,
        externalId: `x${i}`,
      })),
    );
  if (opts.contacts) await db().update(candidateContacts).set({ data: opts.contacts }).where(eq(candidateContacts.profileId, c.profileId));
  return c;
}

export { consents };
