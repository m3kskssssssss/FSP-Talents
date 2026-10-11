import { and, asc, count, desc, eq, gte, inArray, isNull, notExists, or, sql } from "drizzle-orm";
import { CHALLENGE_CONFIG, type Grade, type Specialization } from "../config";
import { db } from "../db";
import {
  candidateProfiles,
  categories,
  challengeAssignments,
  challenges,
  employers,
} from "../db/schema";
import { conflict, notFound } from "../lib/errors";
import { DAY_MS } from "../lib/time";
import type { z } from "zod";
import type { challengeCreateSchema } from "../schemas/challenges";
import { maskName } from "../lib/names";
import { notify } from "./notifications";

/**
 * Regular employer challenges (ТЗ: "система периодически предлагает кандидату
 * задачу от работодателя — решить её или предложить подход").
 *
 * - The employer writes a short task for a specialization (optionally a grade).
 *   `exact` tasks carry a reference answer and are checked by the system,
 *   `open` ones ("suggest an approach") are graded by the employer 0..3.
 * - A candidate with an active category gets at most one task per
 *   CHALLENGE_CONFIG.periodDays. The task is chosen among active ones of their
 *   category, the least exposed first, so different candidates of the same
 *   category get different tasks and none of them is shown to everyone.
 * - The result never changes the grade (only the test does). It refreshes the
 *   profile (`lastActiveAt` feeds the freshness component of the ranking) and
 *   a good result appears in the candidate's "pros" for employers.
 */

export type ChallengeInput = z.infer<typeof challengeCreateSchema>;

const PERIOD_MS = CHALLENGE_CONFIG.periodDays * DAY_MS;

/** "  42,0. " and "42.0" are the same answer. */
export function normalizeAnswer(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/[.;!]+$/, "");
}

// ---------------------------------------------------------------- employer side

export async function createChallenge(employerId: string, input: ChallengeInput) {
  const [c] = await db()
    .insert(challenges)
    .values({
      employerId,
      title: input.title,
      statement: input.statement,
      specialization: input.specialization,
      grade: input.grade ?? null,
      kind: input.kind,
      expectedAnswer: input.kind === "exact" ? (input.expectedAnswer ?? null) : null,
    })
    .returning({ id: challenges.id });
  return { id: c!.id };
}

export async function closeChallenge(employerId: string, challengeId: string) {
  const [c] = await db()
    .update(challenges)
    .set({ status: "closed" })
    .where(and(eq(challenges.id, challengeId), eq(challenges.employerId, employerId)))
    .returning({ id: challenges.id });
  if (!c) throw notFound("Задача не найдена");
  return { ok: true };
}

export async function listEmployerChallenges(employerId: string) {
  const rows = await db()
    .select()
    .from(challenges)
    .where(eq(challenges.employerId, employerId))
    .orderBy(desc(challenges.createdAt));
  if (!rows.length) return [];
  const stats = await db()
    .select({
      challengeId: challengeAssignments.challengeId,
      status: challengeAssignments.status,
      n: count(),
      avg: sql<number | null>`avg(${challengeAssignments.score})::float`,
    })
    .from(challengeAssignments)
    .where(
      inArray(
        challengeAssignments.challengeId,
        rows.map((r) => r.id),
      ),
    )
    .groupBy(challengeAssignments.challengeId, challengeAssignments.status);
  return rows.map((c) => {
    const s = stats.filter((x) => x.challengeId === c.id);
    const by = (st: string) => s.find((x) => x.status === st)?.n ?? 0;
    return {
      ...c,
      offered: s.reduce((a, x) => a + x.n, 0),
      waiting: by("submitted"),
      graded: by("graded"),
      skipped: by("skipped"),
      avgScore: s.find((x) => x.status === "graded")?.avg ?? null,
    };
  });
}

/** Answers to my challenges: those waiting for my grade first. No contacts, masked names. */
export async function listSubmissions(employerId: string) {
  const rows = await db()
    .select({
      id: challengeAssignments.id,
      status: challengeAssignments.status,
      answer: challengeAssignments.answer,
      score: challengeAssignments.score,
      feedback: challengeAssignments.feedback,
      submittedAt: challengeAssignments.submittedAt,
      gradedAt: challengeAssignments.gradedAt,
      profileId: challengeAssignments.profileId,
      fullName: candidateProfiles.fullName,
      challengeId: challenges.id,
      title: challenges.title,
      kind: challenges.kind,
    })
    .from(challengeAssignments)
    .innerJoin(challenges, eq(challenges.id, challengeAssignments.challengeId))
    .innerJoin(candidateProfiles, eq(candidateProfiles.id, challengeAssignments.profileId))
    .where(
      and(
        eq(challenges.employerId, employerId),
        inArray(challengeAssignments.status, ["submitted", "graded"]),
      ),
    )
    .orderBy(
      sql`CASE WHEN ${challengeAssignments.status} = 'submitted' THEN 0 ELSE 1 END`,
      desc(challengeAssignments.submittedAt),
    )
    .limit(100);
  return rows.map(({ fullName, ...r }) => ({ ...r, displayName: maskName(fullName) }));
}

export async function gradeSubmission(
  employerId: string,
  assignmentId: string,
  input: { score: number; feedback?: string | null },
) {
  const [a] = await db()
    .select({
      id: challengeAssignments.id,
      status: challengeAssignments.status,
      profileId: challengeAssignments.profileId,
      title: challenges.title,
      userId: candidateProfiles.userId,
    })
    .from(challengeAssignments)
    .innerJoin(challenges, eq(challenges.id, challengeAssignments.challengeId))
    .innerJoin(candidateProfiles, eq(candidateProfiles.id, challengeAssignments.profileId))
    .where(and(eq(challengeAssignments.id, assignmentId), eq(challenges.employerId, employerId)));
  if (!a) throw notFound("Ответ не найден");
  if (a.status !== "submitted") throw conflict("Этот ответ уже оценён");
  await db().transaction(async (tx) => {
    await tx
      .update(challengeAssignments)
      .set({ status: "graded", score: input.score, feedback: input.feedback ?? null, gradedAt: new Date() })
      .where(eq(challengeAssignments.id, assignmentId));
    await notify(tx, a.userId, {
      title: `Оценка по задаче «${a.title}»: ${input.score}/3`,
      body: input.feedback ?? undefined,
      link: "/candidate/challenges",
    });
  });
  return { ok: true };
}

// ---------------------------------------------------------------- candidate side

async function activeCategories(profileId: string) {
  return db()
    .select({ specialization: categories.specialization, grade: categories.grade })
    .from(categories)
    .where(and(eq(categories.profileId, profileId), eq(categories.status, "active")));
}

/**
 * Offers the next challenge if the period has passed and nothing is pending.
 * Called when the candidate opens the cabinet, so no scheduler is needed;
 * idempotent under repeated calls (the unique index guards double inserts).
 */
export async function offerNext(profileId: string, now = new Date()) {
  const cats = await activeCategories(profileId);
  if (!cats.length) return null;
  const [last] = await db()
    .select({ status: challengeAssignments.status, offeredAt: challengeAssignments.offeredAt })
    .from(challengeAssignments)
    .where(eq(challengeAssignments.profileId, profileId))
    .orderBy(desc(challengeAssignments.offeredAt))
    .limit(1);
  if (last && (last.status === "offered" || now.getTime() - last.offeredAt.getTime() < PERIOD_MS)) return null;

  const fits = or(
    ...cats.map((c) =>
      and(
        eq(challenges.specialization, c.specialization as Specialization),
        or(isNull(challenges.grade), eq(challenges.grade, c.grade as Grade)),
      ),
    ),
  );
  const exposure = sql<number>`(SELECT count(*) FROM ${challengeAssignments} x WHERE x.challenge_id = ${challenges.id})`;
  const [pick] = await db()
    .select({ id: challenges.id, title: challenges.title, company: employers.companyName })
    .from(challenges)
    .innerJoin(employers, eq(employers.id, challenges.employerId))
    .where(
      and(
        eq(challenges.status, "active"),
        fits,
        notExists(
          db()
            .select({ one: sql`1` })
            .from(challengeAssignments)
            .where(
              and(
                eq(challengeAssignments.challengeId, challenges.id),
                eq(challengeAssignments.profileId, profileId),
              ),
            ),
        ),
      ),
    )
    .orderBy(asc(exposure), asc(challenges.createdAt))
    .limit(1);
  if (!pick) return null;

  const [p] = await db()
    .select({ userId: candidateProfiles.userId })
    .from(candidateProfiles)
    .where(eq(candidateProfiles.id, profileId));
  return db().transaction(async (tx) => {
    const [a] = await tx
      .insert(challengeAssignments)
      .values({ challengeId: pick.id, profileId, offeredAt: now })
      .onConflictDoNothing()
      .returning({ id: challengeAssignments.id });
    if (a && p)
      await notify(tx, p.userId, {
        title: `Новая задача от ${pick.company}`,
        body: `«${pick.title}». Решите её или предложите подход — это обновит ваш профиль.`,
        link: "/candidate/challenges",
      });
    return a ?? null;
  });
}

/** Current task and history. The reference answer never leaves the server. */
export async function candidateChallenges(profileId: string, now = new Date()) {
  const rows = await db()
    .select({
      id: challengeAssignments.id,
      status: challengeAssignments.status,
      answer: challengeAssignments.answer,
      score: challengeAssignments.score,
      feedback: challengeAssignments.feedback,
      offeredAt: challengeAssignments.offeredAt,
      submittedAt: challengeAssignments.submittedAt,
      gradedAt: challengeAssignments.gradedAt,
      title: challenges.title,
      statement: challenges.statement,
      kind: challenges.kind,
      specialization: challenges.specialization,
      company: employers.companyName,
    })
    .from(challengeAssignments)
    .innerJoin(challenges, eq(challenges.id, challengeAssignments.challengeId))
    .innerJoin(employers, eq(employers.id, challenges.employerId))
    .where(eq(challengeAssignments.profileId, profileId))
    .orderBy(desc(challengeAssignments.offeredAt));
  const current = rows.find((r) => r.status === "offered") ?? null;
  const last = rows[0];
  const nextAt = current || !last ? null : new Date(last.offeredAt.getTime() + PERIOD_MS);
  return {
    current,
    history: rows.filter((r) => r !== current),
    nextAt: nextAt && nextAt > now ? nextAt : null,
    periodDays: CHALLENGE_CONFIG.periodDays,
  };
}

async function ownOffered(profileId: string, assignmentId: string) {
  const [a] = await db()
    .select({
      id: challengeAssignments.id,
      status: challengeAssignments.status,
      kind: challenges.kind,
      expectedAnswer: challenges.expectedAnswer,
      title: challenges.title,
      employerUserId: employers.userId,
    })
    .from(challengeAssignments)
    .innerJoin(challenges, eq(challenges.id, challengeAssignments.challengeId))
    .innerJoin(employers, eq(employers.id, challenges.employerId))
    .where(and(eq(challengeAssignments.id, assignmentId), eq(challengeAssignments.profileId, profileId)));
  if (!a) throw notFound("Задача не найдена");
  if (a.status !== "offered") throw conflict("Ответ на эту задачу уже отправлен");
  return a;
}

export async function submitAnswer(profileId: string, assignmentId: string, answer: string, now = new Date()) {
  const a = await ownOffered(profileId, assignmentId);
  const auto = a.kind === "exact";
  const score = auto ? (normalizeAnswer(answer) === normalizeAnswer(a.expectedAnswer ?? "") ? 3 : 0) : null;
  await db().transaction(async (tx) => {
    await tx
      .update(challengeAssignments)
      .set({
        answer,
        submittedAt: now,
        ...(auto
          ? { status: "graded" as const, score, gradedAt: now, feedback: score ? "Ответ совпал с эталоном" : "Ответ не совпал с эталоном" }
          : { status: "submitted" as const }),
      })
      .where(eq(challengeAssignments.id, assignmentId));
    // Solving keeps the profile fresh: the freshness component of the ranking reads lastActiveAt.
    await tx.update(candidateProfiles).set({ lastActiveAt: now }).where(eq(candidateProfiles.id, profileId));
    if (!auto)
      await notify(tx, a.employerUserId, {
        title: `Новый ответ на задачу «${a.title}»`,
        body: "Кандидат предложил подход — оцените его от 0 до 3.",
        link: "/employer/challenges",
      });
  });
  return { status: auto ? "graded" : "submitted", score };
}

export async function skipChallenge(profileId: string, assignmentId: string) {
  await ownOffered(profileId, assignmentId);
  await db()
    .update(challengeAssignments)
    .set({ status: "skipped" })
    .where(eq(challengeAssignments.id, assignmentId));
  return { ok: true };
}

// ---------------------------------------------------------------- matching signal

export type ChallengeSignal = { title: string; company: string; score: number; gradedAt: Date };

/** The latest good graded result within signalDays for each candidate. */
export async function challengeSignals(profileIds: string[], now = new Date()) {
  const out = new Map<string, ChallengeSignal>();
  if (!profileIds.length) return out;
  const since = new Date(now.getTime() - CHALLENGE_CONFIG.signalDays * DAY_MS);
  const rows = await db()
    .select({
      profileId: challengeAssignments.profileId,
      score: challengeAssignments.score,
      gradedAt: challengeAssignments.gradedAt,
      title: challenges.title,
      company: employers.companyName,
    })
    .from(challengeAssignments)
    .innerJoin(challenges, eq(challenges.id, challengeAssignments.challengeId))
    .innerJoin(employers, eq(employers.id, challenges.employerId))
    .where(
      and(
        inArray(challengeAssignments.profileId, profileIds),
        eq(challengeAssignments.status, "graded"),
        gte(challengeAssignments.score, CHALLENGE_CONFIG.goodScore),
        gte(challengeAssignments.gradedAt, since),
      ),
    )
    .orderBy(desc(challengeAssignments.gradedAt));
  for (const r of rows)
    if (!out.has(r.profileId) && r.gradedAt && r.score !== null)
      out.set(r.profileId, { title: r.title, company: r.company, score: r.score, gradedAt: r.gradedAt });
  return out;
}

export function signalPro(s: ChallengeSignal, now = new Date()) {
  const days = Math.max(0, Math.round((now.getTime() - s.gradedAt.getTime()) / DAY_MS));
  const when = days === 0 ? "сегодня" : `${days} дн. назад`;
  return `Свежий сигнал: решил задачу работодателя «${s.title}» (${s.score}/3), ${when}`;
}
