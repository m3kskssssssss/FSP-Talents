import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ quiet: true });
import { eq } from "drizzle-orm";
import { hashPassword } from "../server/auth/password";
import { closeDb, db } from "../server/db";
import { users } from "../server/db/schema";
import { createRoleEntity, grantConsents, type Role } from "../server/services/accounts";

export const DEMO_PASSWORD = "Demo12345";

async function upsertDemo(email: string, role: Role, extra: { fullName?: string; companyName?: string }) {
  const [existing] = await db().select().from(users).where(eq(users.email, email));
  if (existing) return existing.id;
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  return db().transaction(async (tx) => {
    const [u] = await tx.insert(users).values({ email, role, passwordHash, emailVerifiedAt: new Date() }).returning();
    await grantConsents(tx, u!.id, ["pd_processing", "privacy_policy"]);
    await createRoleEntity(tx, u!.id, role, { ...extra, email });
    return u!.id;
  });
}

async function main() {
  await upsertDemo("candidate@demo.ru", "candidate", { fullName: "Анна Новикова" });
  await upsertDemo("strong@demo.ru", "candidate", { fullName: "Максим Соколов" });
  await upsertDemo("employer@demo.ru", "employer", { companyName: "ООО «Кванта Софт»" });
  await upsertDemo("admin@demo.ru", "admin", {});
  console.log("demo accounts ready");
  await closeDb();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
