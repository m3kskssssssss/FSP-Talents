import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db, type DbOrTx } from "../db";
import { candidateProfiles, employerReports, employers, invitations } from "../db/schema";
import { reputationFrom, type Reputation } from "../invitations/reputation";
import { DAY_MS } from "../lib/time";
import { conflict, notFound } from "../lib/errors";
import { audit } from "./audit";

export const REPORT_REASONS = {
  fake_vacancy: "Похоже на фиктивную вакансию",
  salary_mismatch: "Условия не соответствуют заявленным",
  spam: "Спам или массовая рассылка",
  inappropriate: "Некорректное поведение",
  other: "Другое",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;

export interface EmployerReputation extends Reputation {
  sent: number;
  accepted: number;
  declined: number;
  since: Date;
  verified: boolean;
}

/** Reputation of an employer from its own history (90-day window, complaints 30 days). */
export async function employerReputation(employerId: string, tx: DbOrTx = db(), now = new Date()): Promise<EmployerReputation> {
  const from90 = new Date(now.getTime() - 90 * DAY_MS);
  const from30 = new Date(now.getTime() - 30 * DAY_MS);
  const [[e], [inv], [all], [rep]] = await Promise.all([
    tx.select({ createdAt: employers.createdAt, verified: employers.verifiedStatus }).from(employers).where(eq(employers.id, employerId)),
    tx
      .select({
        sent: sql<number>`count(*)::int`,
        viewed: sql<number>`count(*) filter (where ${invitations.viewedAt} is not null)::int`,
        accepted: sql<number>`count(*) filter (where ${invitations.status} = 'accepted')::int`,
        declined: sql<number>`count(*) filter (where ${invitations.status} = 'declined')::int`,
        withdrawn: sql<number>`count(*) filter (where ${invitations.status} = 'withdrawn')::int`,
      })
      .from(invitations)
      .where(and(eq(invitations.employerId, employerId), gte(invitations.createdAt, from90))),
    tx.select({ n: sql<number>`count(*)::int` }).from(invitations).where(eq(invitations.employerId, employerId)),
    tx
      .select({
        recent: sql<number>`count(*) filter (where ${employerReports.status} <> 'dismissed' and ${employerReports.createdAt} >= ${from30.toISOString()}::timestamptz)::int`,
        confirmed: sql<number>`count(*) filter (where ${employerReports.status} = 'confirmed')::int`,
      })
      .from(employerReports)
      .where(eq(employerReports.employerId, employerId)),
  ]);
  if (!e) throw notFound("Компания не найдена");
  const verified = e.verified === "verified";
  const r = reputationFrom({
    sent: inv!.sent,
    viewed: inv!.viewed,
    accepted: inv!.accepted,
    declined: inv!.declined,
    withdrawn: inv!.withdrawn,
    complaints: rep!.recent,
    confirmedComplaints: rep!.confirmed,
    verified,
    totalSent: all!.n,
  });
  return { ...r, sent: inv!.sent, accepted: inv!.accepted, declined: inv!.declined, since: e.createdAt, verified };
}

/**
 * A candidate reports an invitation. One report per invitation; an open
 * invitation is declined at the same time (the candidate is not interested
 * in a suspicious offer: the caller declines it, see `wasOpen`). Moderators review reports, nothing is blocked
 * automatically — only the daily quota shrinks while reports are open.
 */
export async function reportInvitation(profileId: string, userId: string, invitationId: string, reason: ReportReason, note?: string) {
  const [inv] = await db().select().from(invitations).where(eq(invitations.id, invitationId));
  if (!inv || inv.profileId !== profileId) throw notFound("Приглашение не найдено");
  const inserted = await db()
    .insert(employerReports)
    .values({ employerId: inv.employerId, invitationId, reporterProfileId: profileId, reason, note: note ?? null })
    .onConflictDoNothing()
    .returning({ id: employerReports.id });
  if (!inserted.length) throw conflict("Вы уже пожаловались на это приглашение");
  await audit(db(), { actorUserId: userId, action: "employer.reported", entity: "invitation", entityId: invitationId, meta: { reason } });
  return { id: inserted[0]!.id, wasOpen: inv.status === "sent" || inv.status === "viewed" };
}

export async function listReports(status?: "open" | "confirmed" | "dismissed") {
  const rows = await db()
    .select({
      r: employerReports,
      company: employers.companyName,
      employerId: employers.id,
      invitationTitle: invitations.title,
      salaryFrom: invitations.salaryFrom,
      salaryTo: invitations.salaryTo,
      reporter: candidateProfiles.fullName,
    })
    .from(employerReports)
    .innerJoin(employers, eq(employers.id, employerReports.employerId))
    .leftJoin(invitations, eq(invitations.id, employerReports.invitationId))
    .innerJoin(candidateProfiles, eq(candidateProfiles.id, employerReports.reporterProfileId))
    .where(status ? eq(employerReports.status, status) : undefined)
    .orderBy(desc(employerReports.createdAt))
    .limit(200);
  const ids = [...new Set(rows.map((x) => x.employerId))];
  const reps = new Map(await Promise.all(ids.map(async (id) => [id, await employerReputation(id)] as const)));
  return rows.map((x) => ({ ...x.r, company: x.company, invitationTitle: x.invitationTitle, salaryFrom: x.salaryFrom, salaryTo: x.salaryTo, reporter: x.reporter, reputation: reps.get(x.employerId)! }));
}

export async function resolveReport(adminUserId: string, id: string, decision: "confirmed" | "dismissed", note?: string) {
  const [r] = await db()
    .update(employerReports)
    .set({ status: decision, resolvedAt: new Date(), resolvedBy: adminUserId, resolutionNote: note ?? null })
    .where(and(eq(employerReports.id, id), inArray(employerReports.status, ["open", "confirmed", "dismissed"])))
    .returning();
  if (!r) throw notFound("Жалоба не найдена");
  await audit(db(), { actorUserId: adminUserId, action: `report.${decision}`, entity: "employer_report", entityId: id, meta: { employerId: r.employerId } });
  return r;
}
