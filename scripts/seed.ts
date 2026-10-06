/**
 * Deterministic synthetic data + demo accounts.
 *   npm run db:seed            # idempotent: skips synthetic data if already present
 *   npm run db:seed -- --reset # wipes ALL data first
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
config({ quiet: true });
import { eq, like, sql } from "drizzle-orm";
import { hashPassword } from "../server/auth/password";
import { CONSENT_VERSIONS, type Grade } from "../server/config";
import { closeDb, db } from "../server/db";
import {
  attemptItems,
  candidateContacts,
  candidateProfiles,
  candidateSkills,
  categories,
  consents,
  employers,
  fspAchievements,
  needs,
  testAttempts,
  users,
} from "../server/db/schema";
import { DAY_MS } from "../server/lib/time";
import { confirmedSkills, generatePopulation, type SynthCandidate } from "../server/synth/population";
import { Rng } from "../server/testing/rng";
import { syncTemplates } from "../server/services/testing";
import { seedInvitations } from "./seed-invitations";

export const DEMO_PASSWORD = "Demo12345";
const SYNTH_DOMAIN = "seed.test";
const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * DAY_MS);

async function chunked<T>(rows: T[], size: number, fn: (part: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += size) await fn(rows.slice(i, i + size));
}

async function reset() {
  const rows = await db().execute<{ tablename: string }>(sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
  const names = rows.map((r) => `"${r.tablename}"`).join(", ");
  if (names) await db().execute(sql.raw(`TRUNCATE ${names} RESTART IDENTITY CASCADE`));
  console.log("database wiped");
}


async function insertCandidate(c: SynthCandidate, email: string, passwordHash: string) {
  return db().transaction(async (tx) => {
    const [u] = await tx
      .insert(users)
      .values({ email, role: "candidate", passwordHash, emailVerifiedAt: daysAgo(400), createdAt: daysAgo(420) })
      .returning({ id: users.id });
    const userId = u!.id;
    await tx.insert(consents).values([
      { userId, kind: "pd_processing", version: CONSENT_VERSIONS.pd_processing },
      { userId, kind: "privacy_policy", version: CONSENT_VERSIONS.privacy_policy },
    ]);
    const [p] = await tx
      .insert(candidateProfiles)
      .values({
        userId,
        fullName: c.fullName,
        city: c.city,
        about: c.about,
        experienceYears: c.experienceYears,
        salaryExpectFrom: c.salaryFrom,
        salaryExpectTo: c.salaryTo,
        workFormat: c.format,
        visibility: c.visible ? "visible" : "hidden",
        fspId: c.achievements.some((a) => a.source === "fsp_registry") ? `FSP-${c.key.slice(4)}` : null,
        survey: { specialization: c.spec },
        onboardedAt: daysAgo(400),
        lastActiveAt: daysAgo(c.lastActiveDaysAgo),
      })
      .returning({ id: candidateProfiles.id });
    const profileId = p!.id;
    const phoneRng = new Rng(`phone/${c.key}`);
    await tx.insert(candidateContacts).values({
      profileId,
      data: {
        email,
        phone: `+7 900 ${phoneRng.int(100, 999)}-${phoneRng.int(10, 99)}-${phoneRng.int(10, 99)}`,
        telegram: `@${c.key}_dev`,
        links: [`https://github.com/${c.key}-demo`],
      },
    });
    const skills = c.declaredSkills.map((skill) => ({ profileId, skill, source: "declared" as const }));
    let best: { attemptId: string; grade: Grade; score: number; theta: number; se: number; trust: "high" | "medium" | "low"; at: Date } | null = null;
    for (const a of c.attempts) {
      const startedAt = daysAgo(a.daysAgo);
      const [row] = await tx
        .insert(testAttempts)
        .values({
          profileId,
          specialization: c.spec,
          targetGrade: a.grade,
          status: "finished",
          startedAt,
          deadlineAt: new Date(startedAt.getTime() + 60 * 60_000),
          finishedAt: new Date(startedAt.getTime() + (25 + a.items.length) * 60_000),
          theta: a.theta,
          se: a.se,
          score: a.score,
          result: a.result,
          trustIndex: a.trust === "high" ? 88 : a.trust === "medium" ? 55 : 25,
          trustLevel: a.trust,
          trustSignals: {
            synthetic: true,
            signals:
              a.trust === "high"
                ? []
                : [
                    { code: "tab_leave", title: "Уходы со вкладки / потеря фокуса", points: 14, count: 9 },
                    ...(a.trust === "low" ? [{ code: "twin", title: "Ответ посчитан по скрытому значению-двойнику", points: 40, count: 1 }, { code: "bulk_insert", title: "Вставка крупных блоков кода в редактор", points: 24, count: 3 }] : []),
                  ],
            answered: a.items.length,
          },
          seed: `seed-${c.key}-${a.grade}`,
          marker: `seed_${c.key}`,
        })
        .returning({ id: testAttempts.id });
      if (!a.items[0]!.templateId.startsWith("synthetic-")) {
        await tx.insert(attemptItems).values(
          a.items.map((it, k) => ({
            attemptId: row!.id,
            position: k,
            templateId: it.templateId,
            seed: `${c.key}-${k}`,
            renderedHash: "synthetic",
            marker: `seed_${c.key}`,
            servedAt: new Date(startedAt.getTime() + k * 3 * 60_000),
            answeredAt: new Date(startedAt.getTime() + (k * 3 + 2) * 60_000),
            isCorrect: it.x >= 1,
            partialScore: it.x,
            timeMs: 60_000 + k * 7_000,
            trapHits: a.trust === "low" && k === 2 ? ["twin"] : [],
          })),
        );
      }
      if (a.result !== "failed" && a.trust !== "low" && (!best || a.score > best.score)) {
        best = { attemptId: row!.id, grade: a.grade, score: a.score, theta: a.theta, se: a.se, trust: a.trust, at: new Date(startedAt.getTime() + 40 * 60_000) };
      }
    }
    if (best) {
      await tx.insert(categories).values({
        profileId,
        specialization: c.spec,
        grade: best.grade,
        score: best.score,
        theta: best.theta,
        se: best.se,
        trustLevel: best.trust,
        attemptId: best.attemptId,
        assignedAt: best.at,
      });
      for (const skill of confirmedSkills(c)) skills.push({ profileId, skill, source: "test_confirmed" as never });
    }
    if (skills.length) await tx.insert(candidateSkills).values(skills).onConflictDoNothing();
    if (c.achievements.length) {
      await tx.insert(fspAchievements).values(
        c.achievements.map((a, k) => ({
          profileId,
          competition: a.competition,
          discipline: a.discipline,
          stage: a.stage,
          year: a.year,
          place: a.place,
          rank: a.rank,
          source: a.source,
          trustLevel: a.source === "fsp_registry" ? ("high" as const) : a.source === "self" ? ("low" as const) : ("medium" as const),
          evidence: { synthetic: true },
          externalId: `${c.key}-${k}`,
        })),
      );
    }
    return profileId;
  });
}

async function upsertUser(email: string, role: "candidate" | "employer" | "admin", passwordHash: string) {
  const [existing] = await db().select().from(users).where(eq(users.email, email));
  if (existing) return { id: existing.id, created: false };
  const [u] = await db()
    .insert(users)
    .values({ email, role, passwordHash, emailVerifiedAt: now })
    .returning({ id: users.id });
  await db().insert(consents).values([
    { userId: u!.id, kind: "pd_processing", version: CONSENT_VERSIONS.pd_processing },
    { userId: u!.id, kind: "privacy_policy", version: CONSENT_VERSIONS.privacy_policy },
  ]);
  return { id: u!.id, created: true };
}

async function seedDemo(passwordHash: string) {
  // candidate@demo.ru: onboarding done, no category yet -> shows the "test -> category" path.
  const cand = await upsertUser("candidate@demo.ru", "candidate", passwordHash);
  if (cand.created) {
    const [p] = await db()
      .insert(candidateProfiles)
      .values({ userId: cand.id, fullName: "Анна Новикова", city: "Казань", about: "Python-разработчица, 2 года коммерческой разработки, люблю чистые API.", experienceYears: 2, salaryExpectFrom: 180000, salaryExpectTo: 230000, workFormat: "remote", survey: { specialization: "backend" } })
      .returning({ id: candidateProfiles.id });
    await db().insert(candidateContacts).values({ profileId: p!.id, data: { email: "candidate@demo.ru", phone: "+7 900 111-22-33", telegram: "@anna_demo" } });
    await db().insert(candidateSkills).values(["python", "django", "postgresql", "docker"].map((skill) => ({ profileId: p!.id, skill, source: "declared" as const })));
  }

  // strong@demo.ru: category Backend · Middle, FSP registry achievements, confirmed skills.
  const strong = await upsertUser("strong@demo.ru", "candidate", passwordHash);
  if (strong.created) {
    const [p] = await db()
      .insert(candidateProfiles)
      .values({ userId: strong.id, fullName: "Максим Соколов", city: "Москва", about: "Backend на Python и Go, высоконагруженные сервисы, призёр Чемпионата России по спортивному программированию.", experienceYears: 4, salaryExpectFrom: 260000, salaryExpectTo: 320000, workFormat: "hybrid", fspId: "FSP-000777", survey: { specialization: "backend" }, onboardedAt: now })
      .returning({ id: candidateProfiles.id });
    const profileId = p!.id;
    await db().insert(candidateContacts).values({ profileId, data: { email: "strong@demo.ru", phone: "+7 900 777-77-77", telegram: "@max_sokolov_demo", links: ["https://github.com/max-sokolov-demo"] } });
    const startedAt = daysAgo(12);
    const [a] = await db()
      .insert(testAttempts)
      .values({ profileId, specialization: "backend", targetGrade: "middle", status: "finished", startedAt, deadlineAt: new Date(startedAt.getTime() + 3600_000), finishedAt: new Date(startedAt.getTime() + 41 * 60_000), theta: 1.25, se: 0.31, score: 26.4, result: "passed_confident", trustIndex: 94, trustLevel: "high", trustSignals: { signals: [], answered: 13 }, seed: "demo-strong", marker: "demo_strong" })
      .returning({ id: testAttempts.id });
    await db().insert(categories).values({ profileId, specialization: "backend", grade: "middle", score: 26.4, theta: 1.25, se: 0.31, trustLevel: "high", attemptId: a!.id, assignedAt: new Date(startedAt.getTime() + 41 * 60_000) });
    await db().insert(candidateSkills).values([
      ...["python", "sql", "rest", "алгоритмы"].map((skill) => ({ profileId, skill, source: "test_confirmed" as const })),
      ...["go", "postgresql", "redis", "kafka", "docker", "kubernetes"].map((skill) => ({ profileId, skill, source: "declared" as const })),
    ]);
    await db().insert(fspAchievements).values([
      { profileId, competition: "Чемпионат России по спортивному программированию", discipline: "алгоритмическое", stage: "final" as const, year: now.getFullYear() - 1, place: 3, sportsCategory: "КМС", source: "fsp_registry" as const, trustLevel: "high" as const, externalId: "demo-1", evidence: { registryId: "FSP-000777/2025/1" } },
      { profileId, competition: "Кубок России по продуктовому программированию", discipline: "продуктовое", stage: "district" as const, year: now.getFullYear(), place: 1, source: "fsp_registry" as const, trustLevel: "high" as const, externalId: "demo-2", evidence: { registryId: "FSP-000777/2026/2" } },
      { profileId, competition: "Всероссийский хакатон ФСП", discipline: "продуктовое", stage: "regional" as const, year: now.getFullYear() - 2, place: null, rank: 41, source: "self" as const, trustLevel: "low" as const, externalId: "demo-3" },
    ]);
  }

  const emp = await upsertUser("employer@demo.ru", "employer", passwordHash);
  if (emp.created) {
    const [e] = await db().insert(employers).values({ userId: emp.id, companyName: "ООО «Кванта Софт»", inn: "7700000000", about: "Продуктовая компания: платёжная платформа для малого бизнеса, 40 инженеров.", site: "https://kvanta.example", city: "Москва", verifiedStatus: "verified" }).returning({ id: employers.id });
    await db().insert(needs).values([
      { employerId: e!.id, title: "Python-разработчик в платёжную команду", specialization: "backend" as const, grade: "middle" as const, stack: ["python", "postgresql", "redis", "docker"], salaryFrom: 230000, salaryTo: 300000, format: "hybrid" as const, city: "Москва", teamAbout: "Команда платёжного шлюза: 6 разработчиков, свой SRE, релизы дважды в неделю.", parsedBy: "form" as const },
      { employerId: e!.id, title: "Frontend-разработчик (React)", specialization: "frontend" as const, grade: "middle" as const, stack: ["react", "typescript", "nextjs"], salaryFrom: 200000, salaryTo: 270000, format: "remote" as const, city: null, teamAbout: "Личный кабинет продавца.", parsedBy: "form" as const },
      { employerId: e!.id, title: "Junior аналитик данных", specialization: "data" as const, grade: "junior" as const, stack: ["python", "sql", "pandas"], salaryFrom: 90000, salaryTo: 130000, format: "remote" as const, city: null, teamAbout: "Аналитика платежей и антифрод.", parsedBy: "form" as const },
    ]);
  }
  await upsertUser("admin@demo.ru", "admin", passwordHash);
}

async function main() {
  if (process.argv.includes("--reset")) await reset();
  await syncTemplates(true);
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const [{ n }] = (await db().select({ n: sql<number>`count(*)::int` }).from(users).where(like(users.email, `%@${SYNTH_DOMAIN}`))) as [{ n: number }];
  if (n > 0) {
    console.log(`synthetic data already present (${n} users) — use --reset to regenerate`);
  } else {
    const t0 = Date.now();
    const pop = generatePopulation({ now });
    for (const c of pop.candidates) await insertCandidate(c, `${c.key}@${SYNTH_DOMAIN}`, passwordHash);
    console.log(`candidates: ${pop.candidates.length}`);
    let needCount = 0;
    await chunked(pop.employers, 5, async (part) => {
      for (const e of part) {
        const [u] = await db().insert(users).values({ email: `${e.key}@${SYNTH_DOMAIN}`, role: "employer", passwordHash, emailVerifiedAt: now }).returning({ id: users.id });
        await db().insert(consents).values([
          { userId: u!.id, kind: "pd_processing", version: CONSENT_VERSIONS.pd_processing },
          { userId: u!.id, kind: "privacy_policy", version: CONSENT_VERSIONS.privacy_policy },
        ]);
        const [er] = await db().insert(employers).values({ userId: u!.id, companyName: e.companyName, about: e.about, city: e.city, verifiedStatus: "verified" }).returning({ id: employers.id });
        await db().insert(needs).values(e.needs.map((nd) => ({ employerId: er!.id, title: nd.title, specialization: nd.spec, grade: nd.grade, stack: nd.stack, salaryFrom: nd.salaryFrom, salaryTo: nd.salaryTo, format: nd.format, city: nd.city, teamAbout: nd.teamAbout, parsedBy: "form" as const })));
        needCount += e.needs.length;
      }
    });
    console.log(`employers: ${pop.employers.length}, needs: ${needCount} (${Math.round((Date.now() - t0) / 1000)} s)`);
  }
  await seedDemo(passwordHash);
  await seedInvitations();
  console.log("demo accounts ready (password: Demo12345)");
  await closeDb();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
