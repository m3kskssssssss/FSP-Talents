/**
 * Invitations in every status (sent, viewed, accepted, declined, withdrawn,
 * expired) with a consistent event history. Deterministic and idempotent.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../server/db";
import { candidateProfiles, employers, invitationEvents, invitations, needs, users } from "../server/db/schema";
import { DAY_MS } from "../server/lib/time";
import { scoreCandidate } from "../server/matching/score";
import { loadPool, toNeedInput } from "../server/services/matching";
import type { InvitationStatus } from "../server/invitations/fsm";
import { Rng } from "../server/testing/rng";

const STATUSES: [InvitationStatus, number][] = [
  ["sent", 3],
  ["viewed", 2],
  ["accepted", 3],
  ["declined", 2],
  ["withdrawn", 1],
  ["expired", 1],
];
const REASONS = ["Сейчас не рассматриваю смену работы", "Не подходит формат работы", "Ожидания по зарплате выше", "Интересна другая предметная область"];

function pickStatus(rng: Rng): InvitationStatus {
  const total = STATUSES.reduce((s, [, w]) => s + w, 0);
  let r = rng.float() * total;
  for (const [s, w] of STATUSES) if ((r -= w) <= 0) return s;
  return "sent";
}

export async function seedInvitations() {
  const [{ n }] = (await db().select({ n: sql<number>`count(*)::int` }).from(invitations)) as [{ n: number }];
  if (n > 0) return;
  const rng = new Rng("seed-invitations-v1");
  const now = Date.now();
  const emps = await db()
    .select({ id: employers.id, userId: employers.userId, email: users.email })
    .from(employers)
    .innerJoin(users, eq(users.id, employers.userId));
  let created = 0;
  for (const e of emps) {
    const isDemo = e.email === "employer@demo.ru";
    const ns = await db().select().from(needs).where(eq(needs.employerId, e.id));
    for (const need of ns.slice(0, 2)) {
      const pool = await loadPool({ spec: need.specialization, grades: [need.grade] });
      const ranked = pool
        .filter((c) => !c.fullName.startsWith("Максим Соколов"))
        .map((c) => ({ c, m: scoreCandidate(toNeedInput(need), c).match }))
        .sort((a, b) => b.m - a.m)
        .slice(0, isDemo ? 5 : rng.int(2, 4));
      for (const [k, { c }] of ranked.entries()) {
        const status: InvitationStatus = isDemo ? (["accepted", "viewed", "sent", "declined", "expired"] as const)[k % 5]! : pickStatus(rng);
        const createdAt = new Date(now - rng.int(1, 20) * DAY_MS - rng.int(0, 600) * 60_000);
        const viewedAt = status === "sent" || (status === "withdrawn" && rng.bool()) || (status === "expired" && rng.bool()) ? null : new Date(createdAt.getTime() + rng.int(1, 48) * 3600_000);
        const decidedAt = ["accepted", "declined", "withdrawn"].includes(status) ? new Date((viewedAt ?? createdAt).getTime() + rng.int(1, 72) * 3600_000) : null;
        const expiresAt = status === "expired" ? new Date(createdAt.getTime() + 14 * DAY_MS) : new Date(Math.max(now + DAY_MS, createdAt.getTime() + 14 * DAY_MS));
        const [inv] = await db()
          .insert(invitations)
          .values({
            employerId: e.id,
            profileId: c.profileId,
            needId: need.id,
            title: need.title,
            description: need.teamAbout ?? "Подробности расскажем на звонке.",
            salaryFrom: need.salaryFrom,
            salaryTo: need.salaryTo,
            format: need.format,
            status,
            declineReason: status === "declined" ? rng.pick(REASONS) : null,
            createdAt,
            viewedAt,
            decidedAt,
            expiresAt: status === "expired" ? new Date(Math.min(expiresAt.getTime(), now - DAY_MS)) : expiresAt,
          })
          .returning();
        const ev: (typeof invitationEvents.$inferInsert)[] = [{ invitationId: inv!.id, fromStatus: null, toStatus: "sent", actorUserId: e.userId, at: createdAt }];
        if (viewedAt) ev.push({ invitationId: inv!.id, fromStatus: "sent", toStatus: "viewed", at: viewedAt });
        if (decidedAt) ev.push({ invitationId: inv!.id, fromStatus: viewedAt ? "viewed" : "sent", toStatus: status, at: decidedAt, note: status === "declined" ? inv!.declineReason : null });
        if (status === "expired") ev.push({ invitationId: inv!.id, fromStatus: viewedAt ? "viewed" : "sent", toStatus: "expired", at: inv!.expiresAt });
        await db().insert(invitationEvents).values(ev);
        created++;
      }
    }
  }
  // strong@demo.ru gets an open invitation from a synthetic company, to show the candidate side.
  const [strong] = await db()
    .select({ profileId: candidateProfiles.id })
    .from(candidateProfiles)
    .innerJoin(users, eq(users.id, candidateProfiles.userId))
    .where(eq(users.email, "strong@demo.ru"));
  const [other] = await db()
    .select({ id: employers.id, userId: employers.userId })
    .from(employers)
    .innerJoin(users, eq(users.id, employers.userId))
    .where(and(inArray(users.email, ["emp01@seed.test"])));
  if (strong && other) {
    const createdAt = new Date(now - 2 * DAY_MS);
    const [inv] = await db()
      .insert(invitations)
      .values({ employerId: other.id, profileId: strong.profileId, title: "Senior Python-разработчик (платформа данных)", description: "Проектирование сервисов приёма событий, 2000 RPS, Kafka и ClickHouse. Команда из 8 человек.", salaryFrom: 300000, salaryTo: 380000, format: "remote", createdAt, expiresAt: new Date(now + 12 * DAY_MS) })
      .returning();
    await db().insert(invitationEvents).values({ invitationId: inv!.id, toStatus: "sent", actorUserId: other.userId, at: createdAt });
    created++;
  }
  console.log(`invitations: ${created}`);
}
