import { and, eq, isNull } from "drizzle-orm";
import { CONSENT_VERSIONS } from "../config";
import { db, type DbOrTx } from "../db";
import {
  candidateContacts,
  candidateProfiles,
  consents,
  emailTokens,
  employers,
  users,
} from "../db/schema";
import { env } from "../env";
import { hashPassword, verifyPassword } from "../auth/password";
import { randomToken, sha256 } from "../lib/crypto";
import { AppError, conflict, unprocessable } from "../lib/errors";
import { addDays } from "../lib/time";
import { sendMailSafe } from "../mail";
import type { RegisterInput } from "../schemas/auth";

export type Role = "candidate" | "employer" | "admin";

export async function issueEmailToken(tx: DbOrTx, userId: string, kind: "verify_email" | "reset_password") {
  const token = randomToken();
  await tx.insert(emailTokens).values({ userId, kind, tokenHash: sha256(token), expiresAt: addDays(new Date(), 2) });
  return token;
}

export async function grantConsents(tx: DbOrTx, userId: string, kinds: (keyof typeof CONSENT_VERSIONS)[]) {
  if (!kinds.length) return;
  await tx.insert(consents).values(kinds.map((kind) => ({ userId, kind, version: CONSENT_VERSIONS[kind] })));
}

export async function register(input: RegisterInput) {
  const passwordHash = await hashPassword(input.password);
  const { userId, token } = await db().transaction(async (tx) => {
    const existing = await tx.select({ id: users.id }).from(users).where(eq(users.email, input.email));
    if (existing.length) throw conflict("Пользователь с таким email уже зарегистрирован");
    const [u] = await tx.insert(users).values({ email: input.email, passwordHash, role: input.role }).returning();
    const userId = u!.id;
    const kinds: (keyof typeof CONSENT_VERSIONS)[] = ["pd_processing", "privacy_policy"];
    if (input.consents.marketing) kinds.push("marketing");
    await grantConsents(tx, userId, kinds);
    await createRoleEntity(tx, userId, input.role, { fullName: input.fullName, companyName: input.companyName, email: input.email });
    const token = await issueEmailToken(tx, userId, "verify_email");
    return { userId, token };
  });
  const verifyUrl = `${env().APP_URL}/verify-email?token=${encodeURIComponent(token)}`;
  const delivered = await sendMailSafe({
    to: input.email,
    subject: "Подтвердите email — ФСП Таланты",
    text: `Здравствуйте! Чтобы завершить регистрацию, перейдите по ссылке:\n${verifyUrl}\n\nСсылка действует 48 часов.`,
  });
  return { userId, verifyUrl: env().DEMO_MODE ? verifyUrl : undefined, delivered };
}

export async function createRoleEntity(
  tx: DbOrTx,
  userId: string,
  role: Role,
  extra: { fullName?: string; companyName?: string; email?: string },
) {
  if (role === "candidate") {
    const [p] = await tx.insert(candidateProfiles).values({ userId, fullName: extra.fullName ?? "" }).returning();
    await tx.insert(candidateContacts).values({ profileId: p!.id, data: extra.email ? { email: extra.email } : {} });
  } else if (role === "employer") {
    await tx.insert(employers).values({ userId, companyName: extra.companyName ?? "Компания" });
  }
}

export async function verifyEmail(token: string) {
  const hash = sha256(token);
  return db().transaction(async (tx) => {
    const [t] = await tx
      .select()
      .from(emailTokens)
      .where(and(eq(emailTokens.tokenHash, hash), eq(emailTokens.kind, "verify_email")));
    if (!t || t.usedAt) throw new AppError(400, "invalid_token", "Ссылка недействительна или уже использована");
    if (t.expiresAt < new Date()) throw new AppError(400, "token_expired", "Срок действия ссылки истёк");
    await tx.update(emailTokens).set({ usedAt: new Date() }).where(eq(emailTokens.id, t.id));
    await tx.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, t.userId));
    return { userId: t.userId };
  });
}

export async function resendVerification(email: string) {
  const [u] = await db().select().from(users).where(and(eq(users.email, email), isNull(users.deletedAt)));
  // Same response whether or not the user exists: do not leak registrations.
  if (!u || u.emailVerifiedAt) return { verifyUrl: undefined };
  const token = await issueEmailToken(db(), u.id, "verify_email");
  const verifyUrl = `${env().APP_URL}/verify-email?token=${encodeURIComponent(token)}`;
  await sendMailSafe({ to: email, subject: "Подтвердите email — ФСП Таланты", text: `Ссылка: ${verifyUrl}` });
  return { verifyUrl: env().DEMO_MODE ? verifyUrl : undefined };
}

let dummyHash: Promise<string> | undefined;

export type AuthFailure = "invalid_credentials" | "email_not_verified";

export async function authenticate(
  email: string,
  password: string,
): Promise<{ ok: true; user: { id: string; email: string; role: Role } } | { ok: false; reason: AuthFailure }> {
  const [u] = await db().select().from(users).where(and(eq(users.email, email), isNull(users.deletedAt)));
  if (!u || !u.passwordHash) {
    // Equalise timing with a dummy verification so that unknown emails are not distinguishable.
    dummyHash ??= hashPassword("dummy-password-0");
    await verifyPassword(await dummyHash, password);
    return { ok: false, reason: "invalid_credentials" };
  }
  if (!(await verifyPassword(u.passwordHash, password))) return { ok: false, reason: "invalid_credentials" };
  if (!u.emailVerifiedAt) return { ok: false, reason: "email_not_verified" };
  return { ok: true, user: { id: u.id, email: u.email, role: u.role } };
}

/** Used by OIDC (Keycloak / "FSP ID") sign-in: find or create a verified candidate. */
export async function upsertOidcUser(email: string, fullName?: string) {
  const normalized = email.trim().toLowerCase();
  const [u] = await db().select().from(users).where(eq(users.email, normalized));
  if (u) {
    if (u.deletedAt) throw unprocessable("Аккаунт удалён");
    if (!u.emailVerifiedAt) await db().update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, u.id));
    return { id: u.id, email: u.email, role: u.role };
  }
  return db().transaction(async (tx) => {
    const [nu] = await tx
      .insert(users)
      .values({ email: normalized, role: "candidate", emailVerifiedAt: new Date() })
      .returning();
    await createRoleEntity(tx, nu!.id, "candidate", { fullName, email: normalized });
    // Consents for OIDC users are collected on first visit of the cabinet.
    return { id: nu!.id, email: nu!.email, role: nu!.role };
  });
}

export async function hasActiveConsent(userId: string, kind: keyof typeof CONSENT_VERSIONS) {
  const rows = await db()
    .select({ id: consents.id })
    .from(consents)
    .where(and(eq(consents.userId, userId), eq(consents.kind, kind), isNull(consents.revokedAt)))
    .limit(1);
  return rows.length > 0;
}
