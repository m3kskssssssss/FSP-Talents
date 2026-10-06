import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { candidateContacts, candidateProfiles, consents, employers, users } from "@/server/db/schema";
import { registerSchema } from "@/server/schemas/auth";
import { authenticate, register, verifyEmail } from "@/server/services/accounts";
import { resetDb } from "../helpers/db";

const base = {
  email: "Ivan@Example.ru",
  password: "secret123",
  role: "candidate" as const,
  fullName: "Иван Петров",
  consents: { pd_processing: true as const, privacy_policy: true as const },
};

describe("accounts", () => {
  beforeEach(resetDb);

  it("registers a candidate with consents, profile, separate contacts and hashed password", async () => {
    const res = await register(registerSchema.parse(base));
    expect(res.verifyUrl).toContain("/verify-email?token=");
    const [u] = await db().select().from(users).where(eq(users.id, res.userId));
    expect(u!.email).toBe("ivan@example.ru");
    expect(u!.passwordHash).toMatch(/^\$argon2id\$/);
    expect(u!.emailVerifiedAt).toBeNull();
    const cs = await db().select().from(consents).where(eq(consents.userId, res.userId));
    expect(cs.map((c) => c.kind).sort()).toEqual(["pd_processing", "privacy_policy"]);
    expect(cs.every((c) => c.version.length > 0)).toBe(true);
    const [p] = await db().select().from(candidateProfiles).where(eq(candidateProfiles.userId, res.userId));
    const [c] = await db().select().from(candidateContacts).where(eq(candidateContacts.profileId, p!.id));
    expect(c!.data.email).toBe("ivan@example.ru");
  });

  it("requires PD consent", () => {
    const r = registerSchema.safeParse({ ...base, consents: { pd_processing: false, privacy_policy: true } });
    expect(r.success).toBe(false);
  });

  it("requires company name for employers", async () => {
    expect(registerSchema.safeParse({ ...base, role: "employer" }).success).toBe(false);
    const res = await register(registerSchema.parse({ ...base, role: "employer", companyName: "ООО Ромашка" }));
    const [e] = await db().select().from(employers).where(eq(employers.userId, res.userId));
    expect(e!.companyName).toBe("ООО Ромашка");
  });

  it("rejects duplicate email with 409", async () => {
    await register(registerSchema.parse(base));
    await expect(register(registerSchema.parse(base))).rejects.toMatchObject({ status: 409 });
  });

  it("blocks login until email is verified; token is single-use", async () => {
    const res = await register(registerSchema.parse(base));
    expect(await authenticate("ivan@example.ru", "secret123")).toEqual({ ok: false, reason: "email_not_verified" });
    const token = new URL(res.verifyUrl!).searchParams.get("token")!;
    await verifyEmail(token);
    const ok = await authenticate("ivan@example.ru", "secret123");
    expect(ok.ok).toBe(true);
    await expect(verifyEmail(token)).rejects.toMatchObject({ code: "invalid_token" });
    expect(await authenticate("ivan@example.ru", "wrong-pass1")).toEqual({ ok: false, reason: "invalid_credentials" });
    expect(await authenticate("nobody@example.ru", "secret123")).toEqual({ ok: false, reason: "invalid_credentials" });
  });
});
