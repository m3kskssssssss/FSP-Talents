import { and, desc, eq, sql } from "drizzle-orm";
import type { z } from "zod";
import type { Specialization } from "../config";
import { db } from "../db";
import { applications, candidateProfiles, categories, employers, vacancies } from "../db/schema";
import { conflict, forbidden, notFound } from "../lib/errors";
import type { vacancyCreateSchema } from "../schemas/vacancies";
import { audit } from "./audit";
import { maskName } from "./matching";
import { chatsPath, openChat } from "./chats";
import { notify } from "./notifications";

export async function createVacancy(employerId: string, v: z.infer<typeof vacancyCreateSchema>) {
  const [row] = await db()
    .insert(vacancies)
    .values({
      employerId,
      title: v.title,
      description: v.description,
      specialization: v.specialization,
      grade: v.grade,
      stack: v.stack,
      salaryFrom: v.salaryFrom,
      salaryTo: v.salaryTo,
      format: v.format ?? null,
      city: v.city ?? null,
    })
    .returning();
  return row!;
}

export async function listOpenVacancies(spec?: Specialization) {
  return db()
    .select({ v: vacancies, company: employers.companyName, verified: employers.verifiedStatus })
    .from(vacancies)
    .innerJoin(employers, eq(employers.id, vacancies.employerId))
    .where(
      spec
        ? and(eq(vacancies.status, "open"), eq(vacancies.specialization, spec))
        : eq(vacancies.status, "open"),
    )
    .orderBy(desc(vacancies.createdAt))
    .limit(100);
}

export async function listEmployerVacancies(employerId: string) {
  return db()
    .select({
      v: vacancies,
      applications: sql<number>`(SELECT count(*)::int FROM ${applications} a WHERE a.vacancy_id = ${vacancies.id})`,
    })
    .from(vacancies)
    .where(eq(vacancies.employerId, employerId))
    .orderBy(desc(vacancies.createdAt));
}

export async function closeVacancy(employerId: string, id: string) {
  const r = await db()
    .update(vacancies)
    .set({ status: "closed" })
    .where(and(eq(vacancies.id, id), eq(vacancies.employerId, employerId)))
    .returning();
  if (!r.length) throw notFound("Вакансия не найдена");
  return r[0];
}

/**
 * Applying requires an active category in the vacancy's specialization (the
 * platform is category-first) and discloses contacts to THIS employer.
 */
export async function apply(
  profileId: string,
  userId: string,
  vacancyId: string,
  coverLetter?: string,
) {
  const [v] = await db().select().from(vacancies).where(eq(vacancies.id, vacancyId));
  if (!v || v.status !== "open") throw notFound("Вакансия не найдена или закрыта");
  const [cat] = await db()
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.profileId, profileId),
        eq(categories.specialization, v.specialization),
        eq(categories.status, "active"),
      ),
    );
  if (!cat) throw forbidden("Откликнуться можно с категорией этой специализации — пройдите тест");
  return db().transaction(async (tx) => {
    const [dup] = await tx
      .select({ id: applications.id })
      .from(applications)
      .where(and(eq(applications.vacancyId, vacancyId), eq(applications.profileId, profileId)));
    if (dup) throw conflict("Вы уже откликнулись на эту вакансию");
    const [a] = await tx
      .insert(applications)
      .values({ vacancyId, profileId, coverLetter: coverLetter ?? null })
      .returning();
    await audit(tx, {
      actorUserId: userId,
      action: "contacts.disclosed",
      entity: "candidate_profile",
      entityId: profileId,
      meta: { employerId: v.employerId, applicationId: a!.id },
    });
    const [e] = await tx
      .select({ userId: employers.userId })
      .from(employers)
      .where(eq(employers.id, v.employerId));
    await notify(tx, e!.userId, {
      title: "Новый отклик на вакансию",
      body: v.title,
      link: `/employer/vacancies/${v.id}`,
    });
    return a!;
  });
}

export async function myApplications(profileId: string) {
  return db()
    .select({
      a: applications,
      title: vacancies.title,
      company: employers.companyName,
      salaryFrom: vacancies.salaryFrom,
      salaryTo: vacancies.salaryTo,
    })
    .from(applications)
    .innerJoin(vacancies, eq(vacancies.id, applications.vacancyId))
    .innerJoin(employers, eq(employers.id, vacancies.employerId))
    .where(eq(applications.profileId, profileId))
    .orderBy(desc(applications.createdAt));
}

export async function vacancyApplications(employerId: string, vacancyId: string) {
  const [v] = await db().select().from(vacancies).where(eq(vacancies.id, vacancyId));
  if (!v || v.employerId !== employerId) throw notFound("Вакансия не найдена");
  const rows = await db()
    .select({ a: applications, fullName: candidateProfiles.fullName, city: candidateProfiles.city })
    .from(applications)
    .innerJoin(candidateProfiles, eq(candidateProfiles.id, applications.profileId))
    .where(eq(applications.vacancyId, vacancyId))
    .orderBy(desc(applications.createdAt));
  // The applicant chose to reveal themselves to this employer.
  return {
    vacancy: v,
    items: rows.map((r) => ({
      ...r.a,
      candidateName: r.fullName || maskName(r.fullName),
      city: r.city,
    })),
  };
}

export async function setApplicationStatus(
  employerId: string,
  applicationId: string,
  status: "viewed" | "accepted" | "declined",
) {
  const [row] = await db()
    .select({
      a: applications,
      employerId: vacancies.employerId,
      title: vacancies.title,
      userId: candidateProfiles.userId,
    })
    .from(applications)
    .innerJoin(vacancies, eq(vacancies.id, applications.vacancyId))
    .innerJoin(candidateProfiles, eq(candidateProfiles.id, applications.profileId))
    .where(eq(applications.id, applicationId));
  if (!row || row.employerId !== employerId) throw notFound("Отклик не найден");
  if (row.a.status === "accepted" || row.a.status === "declined")
    throw conflict("Решение по отклику уже принято");
  await db().transaction(async (tx) => {
    await tx.update(applications).set({ status }).where(eq(applications.id, applicationId));
    let link = "/candidate/vacancies";
    if (status === "accepted") {
      const chatId = await openChat(tx, {
        employerId,
        profileId: row.a.profileId,
        title: row.title,
        reason: `Компания пригласила вас по отклику на вакансию «${row.title}». Обсудите детали здесь.`,
      });
      link = chatsPath("candidate", chatId);
    }
    if (status !== "viewed") {
      await notify(tx, row.userId, {
        title:
          status === "accepted"
            ? "Компания пригласила вас по отклику — открыт чат"
            : "Отклик отклонён",
        body: row.title,
        link,
      });
    }
  });
  return { ok: true };
}
