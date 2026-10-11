import { and, asc, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { INVITATION_CONFIG } from "../config";
import { db, type DbOrTx } from "../db";
import {
  employerReports,
  applications,
  candidateContacts,
  candidateProfiles,
  candidateSkills,
  categories,
  employers,
  fspAchievements,
  invitationEvents,
  invitations,
  needs,
  users,
  vacancies,
} from "../db/schema";
import { appUrl } from "../env";
import { conflict, notFound, tooMany, unprocessable } from "../lib/errors";
import { addDays } from "../lib/time";
import { formatMoney } from "../lib/money";
import {
  isOpen,
  STATUS_TITLES,
  transition,
  type Actor,
  type InvitationAction,
  type InvitationStatus,
} from "../invitations/fsm";
import { sendMailSafe } from "../mail";
import { skillTitle } from "../matching/skills";
import type { InvitationCreate } from "../schemas/invitations";
import { audit } from "./audit";
import { photoUrl, pickShowcase } from "./candidate";
import { openChat } from "./chats";
import { loadPool, maskName } from "./matching";
import { notify } from "./notifications";
import { employerReputation } from "./reputation";

type InvitationRow = typeof invitations.$inferSelect;

// ---------------------------------------------------------------- transitions

async function apply(
  tx: DbOrTx,
  inv: InvitationRow,
  action: InvitationAction,
  actor: Actor,
  actorUserId: string | null,
  note?: string,
) {
  const t = transition(inv.status, action, actor);
  if (!t.ok) throw conflict(t.reason, { from: inv.status, action });
  const now = new Date();
  const patch: Partial<InvitationRow> = { status: t.to };
  if (t.to === "viewed") patch.viewedAt = now;
  if (t.to === "accepted" || t.to === "declined" || t.to === "withdrawn") patch.decidedAt = now;
  if (t.to === "declined" && note) patch.declineReason = note;
  // Optimistic concurrency: the status must not have changed in between.
  const updated = await tx
    .update(invitations)
    .set(patch)
    .where(and(eq(invitations.id, inv.id), eq(invitations.status, inv.status)))
    .returning();
  if (!updated.length) throw conflict("Статус приглашения уже изменился — обновите страницу");
  await tx.insert(invitationEvents).values({
    invitationId: inv.id,
    fromStatus: inv.status,
    toStatus: t.to,
    actorUserId,
    note: note ?? null,
  });
  return updated[0]!;
}

/** Lazy expiry: no cron on the free plan, open invitations past `expiresAt` expire on read. */
async function expireStale(where: ReturnType<typeof eq>) {
  const stale = await db()
    .select()
    .from(invitations)
    .where(
      and(
        where,
        inArray(invitations.status, ["sent", "viewed"]),
        sql`${invitations.expiresAt} < now()`,
      ),
    );
  for (const inv of stale) {
    await db().transaction(async (tx) => {
      try {
        await apply(tx, inv, "expire", "system", null);
      } catch {
        /* concurrently changed */
      }
    });
  }
}

// ---------------------------------------------------------------- create

export async function createInvitation(
  employerId: string,
  actorUserId: string,
  input: InvitationCreate,
) {
  // Defence in depth for hard rule #1 (the route also validates with Zod).
  if (
    !Number.isInteger(input.salaryFrom) ||
    !Number.isInteger(input.salaryTo) ||
    input.salaryFrom <= 0 ||
    input.salaryFrom > input.salaryTo
  ) {
    throw unprocessable("Вилка зарплаты обязательна: целые «от» и «до», 0 < от ≤ до");
  }
  const [cand] = await loadPool({ profileIds: [input.profileId], unconfirmed: true });
  if (!cand) throw notFound("Кандидат не найден или скрыл профиль");
  if (cand.inviteFloor && input.salaryTo < cand.inviteFloor) {
    throw unprocessable(
      `Кандидат принимает приглашения с верхом вилки от ${cand.inviteFloor.toLocaleString("ru-RU")} ₽ — поднимите вилку или выберите другого кандидата`,
      { code: "below_invite_floor", inviteFloor: cand.inviteFloor },
    );
  }
  if (input.needId) {
    const [n] = await db()
      .select({ e: needs.employerId })
      .from(needs)
      .where(eq(needs.id, input.needId));
    if (!n || n.e !== employerId) throw notFound("Потребность не найдена");
  }
  const inv = await db().transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${employerId}))`);
    const [{ n }] = (await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(invitations)
      .where(
        and(
          eq(invitations.employerId, employerId),
          gte(invitations.createdAt, new Date(Date.now() - 24 * 3600_000)),
        ),
      )) as [{ n: number }];
    // The daily quota depends on reputation: spam and complaints shrink it, accepted invitations grow it.
    const { dailyQuota } = await employerReputation(employerId, tx);
    if (n >= dailyQuota)
      throw tooMany(`Лимит — ${dailyQuota} приглашений в сутки (зависит от репутации компании)`);
    const dup = await tx
      .select({ id: invitations.id })
      .from(invitations)
      .where(
        and(
          eq(invitations.employerId, employerId),
          eq(invitations.profileId, input.profileId),
          input.needId ? eq(invitations.needId, input.needId) : isNull(invitations.needId),
          inArray(invitations.status, ["sent", "viewed"]),
        ),
      );
    if (dup.length)
      throw conflict(
        "Этому кандидату уже отправлено приглашение на эту позицию — дождитесь ответа",
      );
    const [row] = await tx
      .insert(invitations)
      .values({
        employerId,
        profileId: input.profileId,
        needId: input.needId ?? null,
        title: input.title,
        description: input.description,
        salaryFrom: input.salaryFrom,
        salaryTo: input.salaryTo,
        format: input.format ?? null,
        expiresAt: addDays(new Date(), INVITATION_CONFIG.expiresAfterDays),
      })
      .returning();
    await tx
      .insert(invitationEvents)
      .values({ invitationId: row!.id, fromStatus: null, toStatus: "sent", actorUserId });
    const [u] = await tx
      .select({ userId: candidateProfiles.userId })
      .from(candidateProfiles)
      .where(eq(candidateProfiles.id, input.profileId));
    const [e] = await tx
      .select({ name: employers.companyName })
      .from(employers)
      .where(eq(employers.id, employerId));
    await notify(tx, u!.userId, {
      title: `Приглашение от ${e!.name}`,
      body: `${input.title} · ${formatMoney(input.salaryFrom)} – ${formatMoney(input.salaryTo)}`,
      link: `/candidate/invitations/${row!.id}`,
    });
    return { row: row!, candidateUserId: u!.userId, company: e!.name };
  });
  const [cu] = await db()
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, inv.candidateUserId));
  if (cu) {
    await sendMailSafe({
      to: cu.email,
      subject: `Приглашение от ${inv.company} — ФСП Таланты`,
      text: `${inv.company} приглашает вас на позицию «${input.title}».\nВилка: ${formatMoney(input.salaryFrom)} – ${formatMoney(input.salaryTo)}.\n\nОткрыть: ${appUrl()}/candidate/invitations/${inv.row.id}\nКонтакты станут доступны компании только если вы примете приглашение.`,
    });
  }
  return inv.row;
}

// ---------------------------------------------------------------- candidate side

export async function listForCandidate(profileId: string) {
  await expireStale(eq(invitations.profileId, profileId));
  return db()
    .select({
      inv: invitations,
      company: employers.companyName,
      verified: employers.verifiedStatus,
    })
    .from(invitations)
    .innerJoin(employers, eq(employers.id, invitations.employerId))
    .where(eq(invitations.profileId, profileId))
    .orderBy(desc(invitations.createdAt));
}

async function history(invitationId: string) {
  return db()
    .select()
    .from(invitationEvents)
    .where(eq(invitationEvents.invitationId, invitationId))
    .orderBy(asc(invitationEvents.at));
}

async function ownedByCandidate(profileId: string, id: string) {
  const [inv] = await db().select().from(invitations).where(eq(invitations.id, id));
  // Hard rule #4: other people's invitations look exactly like missing ones.
  if (!inv || inv.profileId !== profileId) throw notFound("Приглашение не найдено");
  return inv;
}

/** Opening an invitation marks it as viewed (sent -> viewed). */
export async function getForCandidate(profileId: string, userId: string, id: string) {
  await expireStale(eq(invitations.id, id));
  let inv = await ownedByCandidate(profileId, id);
  if (inv.status === "sent") {
    inv = await db().transaction(async (tx) => {
      const r = await apply(tx, inv, "view", "candidate", userId);
      const [e] = await tx
        .select({ userId: employers.userId })
        .from(employers)
        .where(eq(employers.id, inv.employerId));
      await notify(tx, e!.userId, {
        title: "Кандидат просмотрел приглашение",
        body: inv.title,
        link: `/employer/invitations/${inv.id}`,
      });
      return r;
    });
  }
  const [e] = await db().select().from(employers).where(eq(employers.id, inv.employerId));
  return {
    invitation: inv,
    company: {
      name: e!.companyName,
      about: e!.about,
      site: e!.site,
      city: e!.city,
      verified: e!.verifiedStatus === "verified",
    },
    reputation: await employerReputation(inv.employerId),
    reported:
      (
        await db()
          .select({ id: employerReports.id })
          .from(employerReports)
          .where(
            and(
              eq(employerReports.invitationId, inv.id),
              eq(employerReports.reporterProfileId, profileId),
            ),
          )
      ).length > 0,
    history: await history(inv.id),
  };
}

export async function decide(
  profileId: string,
  userId: string,
  id: string,
  decision: "accept" | "decline",
  reason?: string,
) {
  await expireStale(eq(invitations.id, id));
  let inv = await ownedByCandidate(profileId, id);
  const res = await db().transaction(async (tx) => {
    // Deciding from the list without opening the card still counts as viewing it first.
    if (inv.status === "sent") inv = await apply(tx, inv, "view", "candidate", userId);
    const updated = await apply(
      tx,
      inv,
      decision,
      "candidate",
      userId,
      decision === "decline" ? reason : undefined,
    );
    const [e] = await tx
      .select({ userId: employers.userId, name: employers.companyName })
      .from(employers)
      .where(eq(employers.id, inv.employerId));
    if (decision === "accept") {
      // Contacts become available to this employer: record the disclosure.
      await audit(tx, {
        actorUserId: userId,
        action: "contacts.disclosed",
        entity: "candidate_profile",
        entityId: profileId,
        meta: { employerId: inv.employerId, invitationId: inv.id },
      });
      await openChat(tx, {
        employerId: inv.employerId,
        profileId,
        title: inv.title,
        reason: `Кандидат принял приглашение «${inv.title}». Теперь можно договориться о встрече здесь.`,
      });
    }
    await notify(tx, e!.userId, {
      title:
        decision === "accept"
          ? "Кандидат принял приглашение — контакты открыты"
          : "Кандидат отклонил приглашение",
      body: inv.title,
      link: `/employer/invitations/${inv.id}`,
    });
    return { updated, employerUserId: e!.userId };
  });
  const [eu] = await db()
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, res.employerUserId));
  if (eu) {
    await sendMailSafe({
      to: eu.email,
      subject:
        decision === "accept"
          ? "Кандидат принял приглашение — ФСП Таланты"
          : "Кандидат отклонил приглашение — ФСП Таланты",
      text: `Позиция «${inv.title}»: ${decision === "accept" ? "приглашение принято, контакты доступны в карточке кандидата" : "приглашение отклонено"}.\n${appUrl()}/employer/invitations/${inv.id}`,
    });
  }
  return res.updated;
}

// ---------------------------------------------------------------- employer side

export async function listForEmployer(employerId: string, status?: InvitationStatus) {
  await expireStale(eq(invitations.employerId, employerId));
  const rows = await db()
    .select({ inv: invitations, fullName: candidateProfiles.fullName, needTitle: needs.title })
    .from(invitations)
    .innerJoin(candidateProfiles, eq(candidateProfiles.id, invitations.profileId))
    .leftJoin(needs, eq(needs.id, invitations.needId))
    .where(
      status
        ? and(eq(invitations.employerId, employerId), eq(invitations.status, status))
        : eq(invitations.employerId, employerId),
    )
    .orderBy(desc(invitations.createdAt));
  // Full name only once the candidate accepted (contacts are disclosed then).
  return rows.map((r) => ({
    ...r.inv,
    candidateName: r.inv.status === "accepted" ? r.fullName : maskName(r.fullName),
    needTitle: r.needTitle,
  }));
}

export async function getForEmployer(employerId: string, id: string) {
  await expireStale(eq(invitations.id, id));
  const [inv] = await db().select().from(invitations).where(eq(invitations.id, id));
  if (!inv || inv.employerId !== employerId) throw notFound("Приглашение не найдено");
  return { invitation: inv, history: await history(inv.id) };
}

export async function withdraw(employerId: string, userId: string, id: string) {
  const { invitation } = await getForEmployer(employerId, id);
  return db().transaction(async (tx) => {
    const r = await apply(tx, invitation, "withdraw", "employer", userId);
    const [p] = await tx
      .select({ userId: candidateProfiles.userId })
      .from(candidateProfiles)
      .where(eq(candidateProfiles.id, invitation.profileId));
    await notify(tx, p!.userId, {
      title: "Компания отозвала приглашение",
      body: invitation.title,
      link: `/candidate/invitations/${id}`,
    });
    return r;
  });
}

// ---------------------------------------------------------------- contacts access

/**
 * Hard rule #2: an employer may see a candidate's contacts only after the
 * candidate accepted THIS employer's invitation or applied to its vacancy.
 */
export async function hasContactAccess(employerId: string, profileId: string) {
  const [acc] = await db()
    .select({ id: invitations.id })
    .from(invitations)
    .where(
      and(
        eq(invitations.employerId, employerId),
        eq(invitations.profileId, profileId),
        eq(invitations.status, "accepted"),
      ),
    )
    .limit(1);
  if (acc) return true;
  const [app] = await db()
    .select({ id: applications.id })
    .from(applications)
    .innerJoin(vacancies, eq(vacancies.id, applications.vacancyId))
    .where(and(eq(vacancies.employerId, employerId), eq(applications.profileId, profileId)))
    .limit(1);
  return Boolean(app);
}

/** Candidate profile as seen by an employer. Contacts are attached only with access, and each read is audited. */
export async function candidateForEmployer(
  employerId: string,
  actorUserId: string,
  profileId: string,
) {
  const [pool] = await loadPool({ profileIds: [profileId], unconfirmed: true });
  const related = await db()
    .select({
      id: invitations.id,
      status: invitations.status,
      title: invitations.title,
      createdAt: invitations.createdAt,
    })
    .from(invitations)
    .where(and(eq(invitations.employerId, employerId), eq(invitations.profileId, profileId)))
    .orderBy(desc(invitations.createdAt));
  const access = await hasContactAccess(employerId, profileId);
  if (!pool && !related.length && !access) throw notFound("Кандидат не найден");
  const [p] = await db()
    .select()
    .from(candidateProfiles)
    .where(eq(candidateProfiles.id, profileId));
  if (!p) throw notFound("Кандидат не найден");
  const [cats, skills, achs] = await Promise.all([
    db()
      .select()
      .from(categories)
      .where(and(eq(categories.profileId, profileId), eq(categories.status, "active"))),
    db().select().from(candidateSkills).where(eq(candidateSkills.profileId, profileId)),
    db()
      .select()
      .from(fspAchievements)
      .where(eq(fspAchievements.profileId, profileId))
      .orderBy(desc(fspAchievements.year)),
  ]);
  let contacts: { email?: string; phone?: string; telegram?: string; links?: string[] } | null =
    null;
  if (access) {
    const [c] = await db()
      .select()
      .from(candidateContacts)
      .where(eq(candidateContacts.profileId, profileId));
    contacts = c?.data ?? {};
    await audit(db(), {
      actorUserId,
      action: "contacts.viewed",
      entity: "candidate_profile",
      entityId: profileId,
      meta: { employerId },
    });
  }
  return {
    profileId,
    displayName: access ? p.fullName : maskName(p.fullName),
    city: p.city,
    about: p.about,
    experienceYears: p.experienceYears,
    salaryExpect: { from: p.salaryExpectFrom, to: p.salaryExpectTo },
    inviteFloor: p.inviteFloor,
    workFormat: p.workFormat,
    categories: cats.map((c) => ({
      specialization: c.specialization,
      grade: c.grade,
      score: c.score,
      trustLevel: c.trustLevel,
      assignedAt: c.assignedAt,
    })),
    /** Claimed grade the test did not confirm (only when there is no active category). */
    unconfirmed:
      pool && pool.confirmed === false
        ? { specialization: pool.specialization, grade: pool.grade, score: pool.score }
        : null,
    skills: skills.map((s) => ({ skill: s.skill, title: skillTitle(s.skill), source: s.source })),
    achievements: achs.map((a) => ({
      competition: a.competition,
      discipline: a.discipline,
      stage: a.stage,
      year: a.year,
      place: a.place,
      source: a.source,
      trustLevel: a.trustLevel,
    })),
    showcase: pickShowcase(p.showcase, achs).map((a) => ({
      id: a.id,
      competition: a.competition,
      discipline: a.discipline,
      stage: a.stage,
      year: a.year,
      place: a.place,
      source: a.source,
      certificate: a.certificate,
    })),
    workHistory: p.workHistory,
    /** Opens together with the contacts. */
    photo: access ? photoUrl(`/api/v1/candidates/${profileId}/photo`, p.photoKey) : null,
    invitations: related.map((r) => ({ ...r, statusTitle: STATUS_TITLES[r.status] })),
    contacts,
    contactAccess: access,
  };
}

export { isOpen };
