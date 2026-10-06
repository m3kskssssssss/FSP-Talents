import { and, eq, isNull } from "drizzle-orm";
import { auth } from "../auth";
import { db } from "../db";
import { candidateProfiles, employers, users } from "../db/schema";
import { forbidden, unauthorized } from "../lib/errors";
import type { Role } from "../services/accounts";

export type Actor = { userId: string; role: Role; email: string };

/**
 * Resolves the current user from the session AND re-reads role/deletion from
 * the DB: JWT claims alone are not trusted for authorisation decisions.
 */
export async function currentActor(): Promise<Actor | null> {
  const session = await auth();
  const uid = session?.user?.id;
  if (!uid) return null;
  const [u] = await db()
    .select({ id: users.id, role: users.role, email: users.email })
    .from(users)
    .where(and(eq(users.id, uid), isNull(users.deletedAt)));
  return u ? { userId: u.id, role: u.role, email: u.email } : null;
}

export async function requireActor(...roles: Role[]): Promise<Actor> {
  const a = await currentActor();
  if (!a) throw unauthorized();
  if (roles.length && !roles.includes(a.role)) throw forbidden();
  return a;
}

export async function candidateProfileId(userId: string) {
  const [p] = await db().select({ id: candidateProfiles.id }).from(candidateProfiles).where(eq(candidateProfiles.userId, userId));
  if (!p) throw forbidden("Профиль кандидата не найден");
  return p.id;
}

export async function employerId(userId: string) {
  const [e] = await db().select({ id: employers.id }).from(employers).where(eq(employers.userId, userId));
  if (!e) throw forbidden("Профиль работодателя не найден");
  return e.id;
}

export async function requireCandidate() {
  const a = await requireActor("candidate");
  return { ...a, profileId: await candidateProfileId(a.userId) };
}

export async function requireEmployer() {
  const a = await requireActor("employer");
  return { ...a, employerId: await employerId(a.userId) };
}
