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
