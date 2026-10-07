import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import {
  GRADES,
  TEST_CONFIG,
  TESTABLE_SPECIALIZATIONS,
  gradeIndex,
  type Grade,
  type Specialization,
} from "../config";
import { db, type DbOrTx, type Tx } from "../db";
import { env } from "../env";
import {
  attemptEvents,
  attemptItems,
  candidateSkills,
  categories,
  taskTemplates,
  testAttempts,
} from "../db/schema";
import { randomToken, sha256 } from "../lib/crypto";
import { AppError, conflict, forbidden, notFound } from "../lib/errors";
import { addMinutes } from "../lib/time";
import { BANK, getTemplate } from "../testing/bank";
import {
  estimate,
  selectNext,
  shouldStop,
  toResponses,
  type Administered,
  type BankItem,
} from "../testing/cat";
import { checkEligibility, type Eligibility, type PastAttempt } from "../testing/eligibility";
import {
  checkAnswer,
  hiddenPayload,
  renderItem,
  type Answer,
  type PublicItem,
} from "../testing/engine";
import { leakVerdict } from "../testing/calibration";
import { decide, p2pl } from "../testing/irt";
import { Rng } from "../testing/rng";
import { computeTrust } from "../testing/trust";
import type { TaskKind } from "../testing/types";
import { hasActiveConsent } from "./accounts";
import { audit } from "./audit";

// ---------------------------------------------------------------- template metadata sync

let synced = false;

/**
 * Generators live in code; their metadata (IRT params, counters, status) lives
 * in `task_templates`. New templates are inserted; calibrated params are kept.
 */
export async function syncTemplates(force = false) {
  if (synced && !force) return;
  for (const t of BANK) {
    await db()
      .insert(taskTemplates)
      .values({
        id: t.id,
        specialization: t.specialization,
        kind: t.kind,
        language: t.kind === "code" ? t.languages.join(",") : t.kind === "sql" ? "sql" : null,
        title: t.title,
        skills: t.skills,
        difficultyB: t.b,
        discriminationA: t.a,
        generatorRef: `server/testing/bank#${t.id}`,
      })
      .onConflictDoUpdate({
        target: taskTemplates.id,
        set: {
          title: t.title,
          skills: t.skills,
          kind: t.kind,
          // Keep calibrated parameters; refresh expert ones otherwise.
          difficultyB: sql`CASE WHEN ${taskTemplates.calibratedAt} IS NULL THEN ${t.b} ELSE ${taskTemplates.difficultyB} END`,
          discriminationA: sql`CASE WHEN ${taskTemplates.calibratedAt} IS NULL THEN ${t.a} ELSE ${taskTemplates.discriminationA} END`,
        },
      });
  }
  synced = true;
}

type Mode = (typeof testAttempts.$inferSelect)["mode"];

/** Item-count limits of an attempt: the full adaptive test or the short express check. */
const limitsFor = (mode: Mode) =>
  mode === "express"
    ? {
        ...TEST_CONFIG,
        minItems: TEST_CONFIG.express.minItems,
        maxItems: TEST_CONFIG.express.maxItems,
      }
    : TEST_CONFIG;

async function bankFor(tx: DbOrTx, spec: Specialization, mode: Mode = "full"): Promise<BankItem[]> {
  const rows = await tx
    .select()
    .from(taskTemplates)
    .where(and(eq(taskTemplates.specialization, spec), eq(taskTemplates.status, "active")));
  const [{ n }] = (await tx
    .select({ n: count() })
    .from(testAttempts)
    .where(eq(testAttempts.specialization, spec))) as [{ n: number }];
  const known = new Set(BANK.map((t) => t.id));
  const kinds: readonly string[] | null = mode === "express" ? TEST_CONFIG.express.kinds : null;
  return rows
    .filter((r) => known.has(r.id) && (!kinds || kinds.includes(r.kind)))
    .map((r) => ({
      id: r.id,
      kind: r.kind,
      a: r.discriminationA,
      b: r.difficultyB,
      exposureRate: n > 0 ? r.exposureCount / n : 0,
    }));
}

// ---------------------------------------------------------------- availability

export async function attemptHistory(profileId: string, spec?: Specialization) {
  return db()
    .select()
    .from(testAttempts)
    .where(
      spec
        ? and(eq(testAttempts.profileId, profileId), eq(testAttempts.specialization, spec))
        : eq(testAttempts.profileId, profileId),
    )
    .orderBy(desc(testAttempts.startedAt));
}

export async function availability(profileId: string) {
  const history = await attemptHistory(profileId);
  const cats = await db()
    .select()
    .from(categories)
    .where(and(eq(categories.profileId, profileId), eq(categories.status, "active")));
  const now = new Date();
  return TESTABLE_SPECIALIZATIONS.map((spec) => {
    const h = history.filter((a) => a.specialization === spec);
    const category = cats.find((c) => c.specialization === spec) ?? null;
    return {
      specialization: spec,
      category,
      inProgress: h.find((a) => a.status === "in_progress")?.id ?? null,
      grades: GRADES.map((grade) => ({
        grade,
        eligibility: checkEligibility(toPast(h), grade, now, category) as Eligibility,
      })),
      expressAvailable: env().DEMO_MODE,
      attempts: h.map((a) => ({
        id: a.id,
        grade: a.targetGrade,
        mode: a.mode,
        status: a.status,
        result: a.result,
        score: a.score,
        trustLevel: a.trustLevel,
        startedAt: a.startedAt,
        finishedAt: a.finishedAt,
      })),
    };
  });
}

/** Express checks never count towards retake rules; an attempt in progress always blocks a new one. */
const toPast = (rows: (typeof testAttempts.$inferSelect)[]): PastAttempt[] =>
  rows
    .filter((r) => r.mode === "full" || r.status === "in_progress")
    .map((r) => ({
      grade: r.targetGrade,
      status: r.status,
      startedAt: r.startedAt,
      finishedAt: r.finishedAt,
      score: r.score,
    }));

// ---------------------------------------------------------------- start

const MARKER_WORDS = [
  "kvant",
  "orbita",
  "vektor",
  "sigma",
  "fotan",
  "lambda",
  "gradus",
  "tensor",
  "pulsar",
  "kristal",
];

export async function startAttempt(
  userId: string,
  profileId: string,
  spec: Specialization,
  grade: Grade,
  mode: Mode = "full",
) {
  if (mode === "express" && !env().DEMO_MODE)
    throw forbidden("Экспресс-проверка доступна только в демо-режиме");
  if (!TESTABLE_SPECIALIZATIONS.includes(spec as (typeof TESTABLE_SPECIALIZATIONS)[number])) {
    throw new AppError(422, "validation_error", "Для этой специализации тест пока недоступен");
  }
  if (!(await hasActiveConsent(userId, "pd_processing")))
    throw forbidden("Нужно согласие на обработку персональных данных");
  await syncTemplates();
  return db().transaction(async (tx) => {
    // Serialise starts per candidate.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${profileId}))`);
    const history = await tx
      .select()
      .from(testAttempts)
      .where(and(eq(testAttempts.profileId, profileId), eq(testAttempts.specialization, spec)));
    const [category] = await tx
      .select({ grade: categories.grade, assignedAt: categories.assignedAt })
      .from(categories)
      .where(
        and(
          eq(categories.profileId, profileId),
          eq(categories.specialization, spec),
          eq(categories.status, "active"),
        ),
      );
    const elig = checkEligibility(toPast(history), grade, new Date(), category);
    // Express (demo) checks skip cooldowns but still: one attempt at a time, nothing below the category.
    if (
      !elig.ok &&
      (mode === "full" || elig.code === "in_progress" || elig.code === "below_category")
    )
      throw conflict(elig.message, { code: elig.code, availableAt: elig.availableAt });
    const seed = randomToken(24);
    const rng = new Rng(seed);
    const marker = `${rng.pick(MARKER_WORDS)}_${rng.token(3)}`;
    const startedAt = new Date();
    const [a] = await tx
      .insert(testAttempts)
      .values({
        profileId,
        specialization: spec,
        targetGrade: grade,
        mode,
        seed,
        marker,
        startedAt,
        deadlineAt: addMinutes(
          startedAt,
          mode === "express" ? TEST_CONFIG.express.durationMinutes : TEST_CONFIG.durationMinutes,
        ),
      })
      .returning();
    const bank = await bankFor(tx, spec, mode);
    const first = selectNext(grade, [], bank, rng.fork("select/0"));
    if (!first) throw new AppError(503, "bank_empty", "Банк заданий пуст");
    await serveItem(tx, a!, first.id, 0);
    return { attemptId: a!.id };
  });
}

type AttemptRow = typeof testAttempts.$inferSelect;
type ItemRow = typeof attemptItems.$inferSelect;

const itemSeedFor = (attempt: AttemptRow, position: number, templateId: string) =>
  sha256(`${attempt.seed}:${position}:${templateId}`).slice(0, 32);

async function serveItem(tx: DbOrTx, attempt: AttemptRow, templateId: string, position: number) {
  const t = getTemplate(templateId);
  const seed = itemSeedFor(attempt, position, templateId);
  const { hash } = await renderItem(t, seed, attempt.marker);
  await tx.insert(attemptItems).values({
    attemptId: attempt.id,
    position,
    templateId,
    seed,
    renderedHash: hash,
    marker: attempt.marker,
    traps: { twin: Boolean(t.twin), hiddenText: true, microText: true },
  });
  // Express demo checks do not affect exposure control or calibration.
  if (attempt.mode === "express") return;
  await tx
    .update(taskTemplates)
    .set({ exposureCount: sql`${taskTemplates.exposureCount} + 1` })
    .where(eq(taskTemplates.id, templateId));
}

// ---------------------------------------------------------------- read state

async function loadOwned(tx: DbOrTx, profileId: string, attemptId: string, lock = false) {
  const q = tx.select().from(testAttempts).where(eq(testAttempts.id, attemptId));
  const [a] = lock ? await q.for("update") : await q;
  // Hard rule #4: same 404 for "not yours" and "does not exist".
  if (!a || a.profileId !== profileId) throw notFound("Попытка не найдена");
  return a;
}

async function items(tx: DbOrTx, attemptId: string) {
  return tx
    .select()
    .from(attemptItems)
    .where(eq(attemptItems.attemptId, attemptId))
    .orderBy(asc(attemptItems.position));
}

type Meta = Map<string, { a: number; b: number; kind: TaskKind; status: string }>;

/** Answers to flagged (suspected leaked) templates do not count towards theta. */
function administered(rows: ItemRow[], meta: Meta): Administered[] {
  return rows.map((r) => {
    const m = meta.get(r.templateId)!;
    const counts = r.answeredAt && m.status !== "flagged";
    return {
      id: r.templateId,
      kind: m.kind,
      a: m.a,
      b: m.b,
      x: counts ? (r.partialScore ?? 0) : undefined,
    };
  });
}

async function templateMeta(tx: DbOrTx, ids: string[]): Promise<Meta> {
  if (!ids.length) return new Map();
  const rows = await tx.select().from(taskTemplates).where(inArray(taskTemplates.id, ids));
  return new Map(
    rows.map((r) => [
      r.id,
      { a: r.discriminationA, b: r.difficultyB, kind: r.kind as TaskKind, status: r.status },
    ]),
  );
}

export interface AttemptState {
  id: string;
  specialization: Specialization;
  grade: Grade;
  mode: Mode;
  status: AttemptRow["status"];
  startedAt: Date;
  deadlineAt: Date;
  serverNow: Date;
  answered: number;
  minItems: number;
  maxItems: number;
  current: null | {
    itemId: string;
    position: number;
    servedAt: Date;
    view: PublicItem;
    hiddenIssued: boolean;
  };
  result: null | {
    score: number;
    result: AttemptRow["result"];
    theta: number;
    se: number;
    trustLevel: AttemptRow["trustLevel"];
    trustIndex: number | null;
    categoryAssigned: boolean;
  };
}

export async function getAttempt(profileId: string, attemptId: string): Promise<AttemptState> {
  let a = await loadOwned(db(), profileId, attemptId);
  if (a.status === "in_progress" && new Date() >= a.deadlineAt) {
    // Lazy expiry: no cron on the free plan, the deadline is enforced on read.
    await db().transaction(async (tx) => {
      const locked = await loadOwned(tx, profileId, attemptId, true);
      if (locked.status === "in_progress") await finalize(tx, locked, "expired");
    });
    a = await loadOwned(db(), profileId, attemptId);
  }
  const rows = await items(db(), attemptId);
  const cur = a.status === "in_progress" ? rows.find((r) => !r.answeredAt) : undefined;
  let current: AttemptState["current"] = null;
  if (cur) {
    const { view } = await renderItem(getTemplate(cur.templateId), cur.seed, cur.marker);
    current = {
      itemId: cur.id,
      position: cur.position,
      servedAt: cur.servedAt,
      view,
      hiddenIssued: Boolean(cur.hiddenNonce),
    };
  }
  let result: AttemptState["result"] = null;
  if (a.status !== "in_progress" && a.score !== null) {
    const [cat] = await db()
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.attemptId, a.id));
    result = {
      score: a.score,
      result: a.result,
      theta: a.theta ?? 0,
      se: a.se ?? 0,
      trustLevel: a.trustLevel,
      trustIndex: a.trustIndex,
      categoryAssigned: Boolean(cat),
    };
  }
  return {
    id: a.id,
    specialization: a.specialization,
    grade: a.targetGrade,
    mode: a.mode,
    status: a.status,
    startedAt: a.startedAt,
    deadlineAt: a.deadlineAt,
    serverNow: new Date(),
    answered: rows.filter((r) => r.answeredAt).length,
    minItems: limitsFor(a.mode).minItems,
    maxItems: limitsFor(a.mode).maxItems,
    current,
    result,
  };
}

// ---------------------------------------------------------------- hidden inputs

export async function issueHidden(profileId: string, attemptId: string, itemId: string) {
  return db().transaction(async (tx) => {
    const a = await loadOwned(tx, profileId, attemptId, true);
    assertOpen(a);
    const item = await currentItem(tx, a.id, itemId);
    const t = getTemplate(item.templateId);
    if (t.kind !== "code" && t.kind !== "sql")
      throw new AppError(400, "no_hidden", "Для этого задания скрытые тесты не нужны");
    // A fresh nonce on every request: inputs are generated at submission time.
    const nonce = randomToken(12);
    await tx
      .update(attemptItems)
      .set({ hiddenNonce: nonce, hiddenIssuedAt: new Date() })
      .where(eq(attemptItems.id, item.id));
    return { ...hiddenPayload(t, item.seed, nonce), timeoutMs: TEST_CONFIG.hiddenRunTimeoutMs };
  });
}

function assertOpen(a: AttemptRow) {
  if (a.status !== "in_progress") throw conflict("Попытка уже завершена");
  if (new Date() >= a.deadlineAt) throw conflict("Время на тест истекло");
}

async function currentItem(tx: DbOrTx, attemptId: string, itemId: string) {
  const rows = await items(tx, attemptId);
  const cur = rows.find((r) => !r.answeredAt);
  if (!cur || cur.id !== itemId) throw conflict("Это задание уже недоступно — обновите страницу");
  return cur;
}

// ---------------------------------------------------------------- answer

export async function submitAnswer(
  profileId: string,
  attemptId: string,
  itemId: string,
  input: { answer?: Answer; skipped?: boolean; timeMs?: number },
) {
  await db().transaction(async (tx) => {
    const a = await loadOwned(tx, profileId, attemptId, true);
    assertOpen(a);
    const item = await currentItem(tx, a.id, itemId);
    const t = getTemplate(item.templateId);
    let score = 0;
    let correct = false;
    let trapHits: string[] = [];
    if (!input.skipped) {
      if (!input.answer) throw new AppError(422, "validation_error", "Нет ответа");
      if ((t.kind === "code" || t.kind === "sql") && item.hiddenIssuedAt) {
        const age = (Date.now() - item.hiddenIssuedAt.getTime()) / 1000;
        if (age > TEST_CONFIG.hiddenWindowSeconds)
          throw conflict("Скрытые тесты устарели — отправьте решение ещё раз");
      }
      const r = await checkAnswer(t, item.seed, item.marker, input.answer, item.hiddenNonce);
      score = r.score;
      correct = r.correct;
      trapHits = r.trapHits;
    }
    const rows = await items(tx, a.id);
    const meta = await templateMeta(
      tx,
      rows.map((r) => r.templateId),
    );
    const before = estimate(a.targetGrade, administered(rows, meta));
    const now = new Date();
    const timeMs = input.timeMs ?? now.getTime() - item.servedAt.getTime();
    await tx
      .update(attemptItems)
      .set({
        answeredAt: now,
        answer: input.answer ? stripForStorage(input.answer) : { skipped: true },
        code: input.answer && "code" in input.answer ? input.answer.code : null,
        isCorrect: correct,
        partialScore: score,
        timeMs: Math.min(timeMs, now.getTime() - item.servedAt.getTime() + 5000),
        trapHits,
      })
      .where(eq(attemptItems.id, item.id));
    const m = meta.get(item.templateId)!;
    if (a.mode === "full") {
      await tx
        .update(taskTemplates)
        .set({
          answeredCount: sql`${taskTemplates.answeredCount} + 1`,
          correctCount: sql`${taskTemplates.correctCount} + ${correct ? 1 : 0}`,
          expectedCorrect: sql`${taskTemplates.expectedCorrect} + ${p2pl(before.theta, m.a, m.b)}`,
        })
        .where(eq(taskTemplates.id, item.templateId));
      await checkLeak(tx, item.templateId);
    }

    const updated = await items(tx, a.id);
    const adm = administered(updated, meta);
    const est = estimate(a.targetGrade, adm);
    await tx
      .update(attemptItems)
      .set({ thetaAfter: est.theta, seAfter: est.se })
      .where(eq(attemptItems.id, item.id));

    const bank = await bankFor(tx, a.specialization, a.mode);
    const used = new Set(updated.map((r) => r.templateId));
    const stop = shouldStop(
      a.targetGrade,
      adm,
      { bankLeft: bank.filter((b) => !used.has(b.id)).length, now, deadline: a.deadlineAt },
      limitsFor(a.mode),
    );
    if (stop) {
      await finalize(tx, a, stop === "deadline" ? "expired" : "finished");
      return;
    }
    const next = selectNext(
      a.targetGrade,
      adm,
      bank,
      new Rng(a.seed).fork(`select/${updated.length}`),
    );
    if (!next) await finalize(tx, a, "finished");
    else await serveItem(tx, a, next.id, updated.length);
  });
  return getAttempt(profileId, attemptId);
}

/** Leak drift detection after each answer (see testing/calibration.ts). */
async function checkLeak(tx: DbOrTx, templateId: string) {
  const [t] = await tx.select().from(taskTemplates).where(eq(taskTemplates.id, templateId));
  if (!t || t.status !== "active") return;
  const v = leakVerdict({
    id: t.id,
    answered: t.answeredCount,
    correct: t.correctCount,
    expected: t.expectedCorrect,
  });
  if (v.flagged) {
    await tx
      .update(taskTemplates)
      .set({
        status: "flagged",
        flaggedAt: new Date(),
        flagReason: `Доля верных выше прогноза IRT на ${Math.round(v.excess * 100)} п.п. (z = ${v.z.toFixed(1)})`,
      })
      .where(eq(taskTemplates.id, templateId));
    await audit(tx, {
      actorUserId: null,
      action: "template.flagged",
      entity: "task_template",
      entityId: templateId,
      meta: { excess: v.excess, z: v.z },
    });
  }
}

/** Outputs can be large; keep the code and a compact summary only. */
function stripForStorage(a: Answer): Record<string, unknown> {
  if (a.kind === "code") return { kind: a.kind, language: a.language, outputs: a.outputs.length };
  if (a.kind === "sql")
    return { kind: a.kind, rows: "error" in a.result ? -1 : a.result.rows.length };
  return a as unknown as Record<string, unknown>;
}

export async function finishEarly(profileId: string, attemptId: string) {
  await db().transaction(async (tx) => {
    const a = await loadOwned(tx, profileId, attemptId, true);
    if (a.status !== "in_progress") return;
    await finalize(tx, a, "abandoned");
  });
  return getAttempt(profileId, attemptId);
}

// ---------------------------------------------------------------- finalize

async function finalize(tx: Tx, a: AttemptRow, status: "finished" | "expired" | "abandoned") {
  const rows = await items(tx, a.id);
  const answered = rows.filter((r) => r.answeredAt);
  // Unanswered served item is dropped (not counted as wrong) unless time ran out.
  const meta = await templateMeta(
    tx,
    rows.map((r) => r.templateId),
  );
  const adm = administered(answered, meta);
  const est = estimate(a.targetGrade, adm);
  const { score, result } = decide(est.theta, a.targetGrade);
  const events = await tx.select().from(attemptEvents).where(eq(attemptEvents.attemptId, a.id));
  const trust = computeTrust({
    events,
    items: answered.map((r) => ({
      kind: meta.get(r.templateId)!.kind,
      b: meta.get(r.templateId)!.b,
      x: r.partialScore,
      timeMs: r.timeMs,
      trapHits: r.trapHits ?? [],
    })),
    theta: est.theta,
    responses: toResponses(adm),
  });
  // Too few answers (e.g. abandoned at the start) -> result is not meaningful.
  const enough = answered.length >= Math.min(5, TEST_CONFIG.minItems);
  const finalResult = enough ? result : "failed";
  await tx
    .update(testAttempts)
    .set({
      status,
      finishedAt: new Date(),
      theta: est.theta,
      se: est.se,
      score: enough ? score : Math.min(score, TEST_CONFIG.passScore - 1),
      result: finalResult,
      trustIndex: trust.index,
      trustLevel: trust.level,
      trustSignals: { signals: trust.signals, answered: answered.length },
    })
    .where(eq(testAttempts.id, a.id));

  if (finalResult !== "failed" && trust.level !== "low") {
    await assignCategory(tx, a, { score, theta: est.theta, se: est.se, trustLevel: trust.level });
  }
  // Skills confirmed by correct answers (hard rule #5: stack from tests outranks declared).
  const skills = new Set<string>();
  for (const r of answered) {
    if (!r.isCorrect) continue;
    const t = getTemplate(r.templateId);
    t.skills.forEach((s) => skills.add(s));
    if (t.kind === "sql") skills.add("sql");
    const lang = (r.answer as { language?: string } | null)?.language;
    if (lang) skills.add(lang);
  }
  if (skills.size && trust.level !== "low") {
    await tx
      .insert(candidateSkills)
      .values(
        [...skills].map((skill) => ({
          profileId: a.profileId,
          skill,
          source: "test_confirmed" as const,
        })),
      )
      .onConflictDoNothing();
  }
  await audit(tx, {
    actorUserId: null,
    action: "test.finalized",
    entity: "test_attempt",
    entityId: a.id,
    meta: { status, result: finalResult, trust: trust.level },
  });
}

/**
 * One active category per specialization: a new one supersedes an older one
 * of the same or lower grade; a lower result never downgrades a higher category.
 */
export async function assignCategory(
  tx: DbOrTx,
  a: Pick<AttemptRow, "id" | "profileId" | "specialization" | "targetGrade">,
  r: { score: number; theta: number; se: number; trustLevel: "high" | "medium" | "low" },
) {
  const [existing] = await tx
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.profileId, a.profileId),
        eq(categories.specialization, a.specialization),
        eq(categories.status, "active"),
      ),
    );
  if (existing && gradeIndex(existing.grade) > gradeIndex(a.targetGrade)) return false;
  if (existing)
    await tx.update(categories).set({ status: "superseded" }).where(eq(categories.id, existing.id));
  await tx.insert(categories).values({
    profileId: a.profileId,
    specialization: a.specialization,
    grade: a.targetGrade,
    score: r.score,
    theta: r.theta,
    se: r.se,
    trustLevel: r.trustLevel,
    attemptId: a.id,
  });
  return true;
}

// ---------------------------------------------------------------- events

export async function logEvents(
  profileId: string,
  attemptId: string,
  events: {
    type: (typeof attemptEvents.$inferInsert)["type"];
    itemId?: string;
    payload?: Record<string, unknown>;
  }[],
) {
  const a = await loadOwned(db(), profileId, attemptId);
  if (a.status !== "in_progress" || !events.length) return { stored: 0 };
  await db()
    .insert(attemptEvents)
    .values(
      events.map((e) => ({
        attemptId,
        itemId: e.itemId ?? null,
        type: e.type,
        payload: e.payload ?? null,
      })),
    );
  return { stored: events.length };
}
