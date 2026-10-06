import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { attemptEvents, attemptItems, candidateProfiles, categories, taskTemplates, testAttempts } from "../db/schema";
import { conflict, notFound } from "../lib/errors";
import { getTemplate } from "../testing/bank";
import { leakVerdict } from "../testing/calibration";
import { findClusters } from "../testing/plagiarism";
import { audit } from "./audit";
import { assignCategory } from "./testing";
import { maskName } from "./matching";

export async function listAttempts(filter: { level?: "low" | "medium" | "high"; pending?: boolean }, limit = 100) {
  const conds = [isNotNull(testAttempts.finishedAt)];
  if (filter.level) conds.push(eq(testAttempts.trustLevel, filter.level));
  if (filter.pending) conds.push(isNull(testAttempts.reviewedAt));
  const rows = await db()
    .select({ a: testAttempts, name: candidateProfiles.fullName })
    .from(testAttempts)
    .innerJoin(candidateProfiles, eq(candidateProfiles.id, testAttempts.profileId))
    .where(and(...conds))
    .orderBy(sql`${testAttempts.trustIndex} ASC NULLS LAST`, desc(testAttempts.finishedAt))
    .limit(limit);
  const counts = await db()
    .select({ level: testAttempts.trustLevel, n: sql<number>`count(*)::int`, pending: sql<number>`count(*) filter (where ${testAttempts.reviewedAt} is null)::int` })
    .from(testAttempts)
    .where(isNotNull(testAttempts.finishedAt))
    .groupBy(testAttempts.trustLevel);
  return { items: rows.map((r) => ({ ...r.a, candidate: maskName(r.name) })), counts };
}

export async function attemptDetail(id: string) {
  const [row] = await db()
    .select({ a: testAttempts, name: candidateProfiles.fullName })
    .from(testAttempts)
    .innerJoin(candidateProfiles, eq(candidateProfiles.id, testAttempts.profileId))
    .where(eq(testAttempts.id, id));
  if (!row) throw notFound("Попытка не найдена");
  const [items, events, cat] = await Promise.all([
    db().select().from(attemptItems).where(eq(attemptItems.attemptId, id)).orderBy(asc(attemptItems.position)),
    db().select().from(attemptEvents).where(eq(attemptEvents.attemptId, id)).orderBy(asc(attemptEvents.at)),
    db().select().from(categories).where(eq(categories.attemptId, id)),
  ]);
  // Similar solutions to the same templates from other attempts.
  const tplIds = [...new Set(items.filter((i) => i.code).map((i) => i.templateId))];
  const others = tplIds.length
    ? await db()
        .select({ itemId: attemptItems.id, attemptId: attemptItems.attemptId, templateId: attemptItems.templateId, code: attemptItems.code })
        .from(attemptItems)
        .where(and(inArray(attemptItems.templateId, tplIds), isNotNull(attemptItems.code)))
        .orderBy(desc(attemptItems.answeredAt))
        .limit(500)
    : [];
  const clusters = findClusters(others.map((o) => ({ ...o, code: o.code! }))).filter((c) => c.members.some((m) => m.attemptId === id));
  return {
    attempt: row.a,
    candidate: maskName(row.name),
    category: cat[0] ?? null,
    items: items.map((i) => {
      let title = i.templateId;
      let kind = "";
      try {
        const t = getTemplate(i.templateId);
        title = t.title;
        kind = t.kind;
      } catch {
        /* synthetic template */
      }
      return { ...i, title, kind };
    }),
    events,
    eventCounts: events.reduce<Record<string, number>>((m, e) => ((m[e.type] = (m[e.type] ?? 0) + 1), m), {}),
    similar: clusters.map((c) => ({ templateId: c.templateId, similarity: c.similarity, attempts: c.members.map((m) => m.attemptId).filter((x) => x !== id) })),
  };
}

/**
 * Human decision on a suspicious attempt. Approve assigns the category the
 * test result earned (even if the trust index was low); reject removes it.
 * No automatic bans anywhere.
 */
export async function reviewAttempt(adminUserId: string, id: string, decision: "approve" | "reject", note?: string) {
  return db().transaction(async (tx) => {
    const [a] = await tx.select().from(testAttempts).where(eq(testAttempts.id, id)).for("update");
    if (!a) throw notFound("Попытка не найдена");
    if (a.status === "in_progress") throw conflict("Попытка ещё идёт");
    let categoryAssigned = false;
    if (decision === "approve") {
      if (a.result && a.result !== "failed" && a.score !== null) {
        const [existing] = await tx.select().from(categories).where(eq(categories.attemptId, id));
        if (!existing) categoryAssigned = await assignCategory(tx, a, { score: a.score, theta: a.theta ?? 0, se: a.se ?? 0, trustLevel: "medium" });
      }
    } else {
      await tx.update(categories).set({ status: "superseded" }).where(and(eq(categories.attemptId, id), eq(categories.status, "active")));
    }
    await tx.update(testAttempts).set({ reviewedAt: new Date(), reviewNote: `${decision === "approve" ? "Подтверждена" : "Отклонена"}${note ? `: ${note}` : ""}` }).where(eq(testAttempts.id, id));
    await audit(tx, { actorUserId: adminUserId, action: `attempt.${decision}`, entity: "test_attempt", entityId: id });
    return { ok: true, categoryAssigned };
  });
}

export async function templateStats() {
  const rows = await db().select().from(taskTemplates).orderBy(asc(taskTemplates.specialization), asc(taskTemplates.difficultyB));
  return rows.map((t) => ({
    ...t,
    observed: t.answeredCount ? t.correctCount / t.answeredCount : null,
    predicted: t.answeredCount ? t.expectedCorrect / t.answeredCount : null,
    verdict: leakVerdict({ id: t.id, answered: t.answeredCount, correct: t.correctCount, expected: t.expectedCorrect }),
  }));
}

export async function setTemplateStatus(adminUserId: string, id: string, status: "active" | "flagged" | "retired") {
  const [t] = await db().select().from(taskTemplates).where(eq(taskTemplates.id, id));
  if (!t) throw notFound("Шаблон не найден");
  // Re-activation resets the drift counters so the detector starts afresh.
  await db()
    .update(taskTemplates)
    .set({ status, ...(status === "active" ? { answeredCount: 0, correctCount: 0, expectedCorrect: 0, flaggedAt: null, flagReason: null } : { flaggedAt: new Date(), flagReason: t.flagReason ?? "Помечен модератором" }) })
    .where(eq(taskTemplates.id, id));
  await audit(db(), { actorUserId: adminUserId, action: `template.${status}`, entity: "task_template", entityId: id });
  return { ok: true };
}

export async function plagiarismReport() {
  const subs = await db()
    .select({ itemId: attemptItems.id, attemptId: attemptItems.attemptId, templateId: attemptItems.templateId, code: attemptItems.code })
    .from(attemptItems)
    .where(isNotNull(attemptItems.code))
    .orderBy(desc(attemptItems.answeredAt))
    .limit(3000);
  return findClusters(subs.map((s) => ({ ...s, code: s.code! }))).slice(0, 50);
}
