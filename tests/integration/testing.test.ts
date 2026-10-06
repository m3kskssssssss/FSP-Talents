import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { attemptItems, candidateSkills, categories, taskTemplates, testAttempts } from "@/server/db/schema";
import { getTemplate } from "@/server/testing/bank";
import { referenceAnswer, type Answer } from "@/server/testing/engine";
import {
  finishEarly,
  getAttempt,
  issueHidden,
  logEvents,
  startAttempt,
  submitAnswer,
  syncTemplates,
} from "@/server/services/testing";
import { resetDb } from "../helpers/db";
import { makeCandidate } from "../helpers/factories";

async function currentSeed(itemId: string) {
  const [it] = await db().select().from(attemptItems).where(eq(attemptItems.id, itemId));
  return it!;
}

/** Plays an attempt the way the browser does; `solve` decides whether to answer correctly. */
async function play(profileId: string, attemptId: string, solve: (pos: number) => boolean) {
  let state = await getAttempt(profileId, attemptId);
  let guard = 0;
  while (state.status === "in_progress" && state.current && guard++ < 30) {
    const cur = state.current;
    const item = await currentSeed(cur.itemId);
    const t = getTemplate(item.templateId);
    let nonce = "none";
    if (t.kind === "code" || t.kind === "sql") {
      await issueHidden(profileId, attemptId, cur.itemId);
      nonce = (await currentSeed(cur.itemId)).hiddenNonce!;
    }
    let answer: Answer = await referenceAnswer(t, item.seed, nonce);
    if (!solve(cur.position)) {
      if (answer.kind === "calc") answer = { kind: "calc", value: "-999999" };
      else if (answer.kind === "quiz") answer = { kind: "quiz", selected: [] };
      else if (answer.kind === "code") answer = { ...answer, outputs: answer.outputs.map(() => ({ ok: false as const, error: "x" })) };
      else answer = { ...answer, result: { error: "syntax" } };
    }
    state = await submitAnswer(profileId, attemptId, cur.itemId, { answer, timeMs: 120_000 });
  }
  return state;
}

describe("testing service", () => {
  beforeEach(async () => {
    await resetDb();
    await syncTemplates(true);
  });

  it("express check: 6 items without code, a marked category, no calibration side effects, no cooldown", async () => {
    const { user, profileId } = await makeCandidate();
    const before = await db().select().from(taskTemplates);
    const { attemptId } = await startAttempt(user.id, profileId, "backend", "middle", "express");
    const fin = await play(profileId, attemptId, () => true);
    expect(fin.mode).toBe("express");
    expect(fin.answered).toBe(6);
    expect(fin.maxItems).toBe(6);
    expect(fin.result!.categoryAssigned).toBe(true);
    const served = await db().select().from(attemptItems).where(eq(attemptItems.attemptId, attemptId));
    for (const it of served) expect(["quiz", "calc"]).toContain(getTemplate(it.templateId).kind);
    // Counters used by calibration and the leak detector are untouched.
    const after = await db().select().from(taskTemplates);
    const sum = (rows: typeof before) => rows.reduce((s, r) => s + r.answeredCount + r.exposureCount, 0);
    expect(sum(after)).toBe(sum(before));
    // Does not burn the 14-day cooldown of the full test.
    await expect(startAttempt(user.id, profileId, "backend", "middle")).resolves.toHaveProperty("attemptId");
  });

  it("express check is refused outside demo mode", async () => {
    const { resetEnvCache } = await import("@/server/env");
    process.env.DEMO_MODE = "false";
    resetEnvCache();
    try {
      const { user, profileId } = await makeCandidate();
      await expect(startAttempt(user.id, profileId, "backend", "middle", "express")).rejects.toMatchObject({ status: 403 });
    } finally {
      process.env.DEMO_MODE = "true";
      resetEnvCache();
    }
  });

  it("serves items one by one, without reference data, and assigns a category to a strong candidate", async () => {
    const { user, profileId } = await makeCandidate();
    const { attemptId } = await startAttempt(user.id, profileId, "backend", "middle");
    const s0 = await getAttempt(profileId, attemptId);
    expect(s0.current).not.toBeNull();
    expect(JSON.stringify(s0.current!.view)).not.toMatch(/reference|"correct"|solve/);
    const items0 = await db().select().from(attemptItems).where(eq(attemptItems.attemptId, attemptId));
    expect(items0).toHaveLength(1);

    const fin = await play(profileId, attemptId, () => true);
    expect(fin.status).toBe("finished");
    expect(fin.answered).toBeGreaterThanOrEqual(10);
    expect(fin.answered).toBeLessThanOrEqual(18);
    expect(fin.result!.result).toBe("passed_confident");
    expect(fin.result!.categoryAssigned).toBe(true);
    const cats = await db().select().from(categories).where(eq(categories.profileId, profileId));
    expect(cats).toHaveLength(1);
    expect(cats[0]).toMatchObject({ specialization: "backend", grade: "middle", status: "active" });
    const skills = await db().select().from(candidateSkills).where(and(eq(candidateSkills.profileId, profileId), eq(candidateSkills.source, "test_confirmed")));
    expect(skills.length).toBeGreaterThan(0);
  });

  it("weak candidate fails: no category, may take junior immediately, middle blocked for 14 days", async () => {
    const { user, profileId } = await makeCandidate();
    const { attemptId } = await startAttempt(user.id, profileId, "backend", "middle");
    const fin = await play(profileId, attemptId, () => false);
    expect(fin.result!.result).toBe("failed");
    expect(fin.result!.categoryAssigned).toBe(false);
    await expect(startAttempt(user.id, profileId, "backend", "middle")).rejects.toMatchObject({ status: 409 });
    await expect(startAttempt(user.id, profileId, "backend", "junior")).resolves.toHaveProperty("attemptId");
  });

  it("does not let another candidate read or answer someone else's attempt (hard rule #4)", async () => {
    const a = await makeCandidate();
    const b = await makeCandidate();
    const { attemptId } = await startAttempt(a.user.id, a.profileId, "backend", "junior");
    const st = await getAttempt(a.profileId, attemptId);
    await expect(getAttempt(b.profileId, attemptId)).rejects.toMatchObject({ status: 404 });
    await expect(issueHidden(b.profileId, attemptId, st.current!.itemId)).rejects.toMatchObject({ status: 404 });
    await expect(submitAnswer(b.profileId, attemptId, st.current!.itemId, { skipped: true })).rejects.toMatchObject({ status: 404 });
    await expect(logEvents(b.profileId, attemptId, [{ type: "blur" }])).rejects.toMatchObject({ status: 404 });
  });

  it("rejects answers to a stale item and after the deadline; expires lazily on read", async () => {
    const { user, profileId } = await makeCandidate();
    const { attemptId } = await startAttempt(user.id, profileId, "backend", "junior");
    const st = await getAttempt(profileId, attemptId);
    await submitAnswer(profileId, attemptId, st.current!.itemId, { skipped: true });
    await expect(submitAnswer(profileId, attemptId, st.current!.itemId, { skipped: true })).rejects.toMatchObject({ status: 409 });
    await db().update(testAttempts).set({ deadlineAt: new Date(Date.now() - 1000) }).where(eq(testAttempts.id, attemptId));
    const after = await getAttempt(profileId, attemptId);
    expect(after.status).toBe("expired");
    expect(after.current).toBeNull();
  });

  it("marker in the code drops trust to low and withholds the category", async () => {
    const { user, profileId } = await makeCandidate();
    const { attemptId } = await startAttempt(user.id, profileId, "backend", "junior");
    let state = await getAttempt(profileId, attemptId);
    let guard = 0;
    while (state.status === "in_progress" && state.current && guard++ < 30) {
      const item = await currentSeed(state.current.itemId);
      const t = getTemplate(item.templateId);
      let nonce = "none";
      if (t.kind === "code" || t.kind === "sql") {
        await issueHidden(profileId, attemptId, item.id);
        nonce = (await currentSeed(item.id)).hiddenNonce!;
      }
      const ans = await referenceAnswer(t, item.seed, nonce);
      if (ans.kind === "code" || ans.kind === "sql") ans.code = `# ${item.marker}\n${ans.code}`;
      state = await submitAnswer(profileId, attemptId, item.id, { answer: ans, timeMs: 200_000 });
    }
    expect(state.result!.trustLevel).toBe("low");
    expect(state.result!.categoryAssigned).toBe(false);
  });

  it("flags a template online when its correct-answer share drifts above the IRT prediction", async () => {
    const { user, profileId } = await makeCandidate();
    const { attemptId } = await startAttempt(user.id, profileId, "backend", "junior");
    const st = await getAttempt(profileId, attemptId);
    const item = await currentSeed(st.current!.itemId);
    await db().update(taskTemplates).set({ answeredCount: 60, correctCount: 58, expectedCorrect: 30 }).where(eq(taskTemplates.id, item.templateId));
    await submitAnswer(profileId, attemptId, item.id, { skipped: true });
    const [t] = await db().select().from(taskTemplates).where(eq(taskTemplates.id, item.templateId));
    expect(t!.status).toBe("flagged");
    expect(t!.flagReason).toMatch(/выше прогноза IRT/);
  });

  it("early finish closes the attempt", async () => {
    const { user, profileId } = await makeCandidate();
    const { attemptId } = await startAttempt(user.id, profileId, "backend", "senior");
    const st = await finishEarly(profileId, attemptId);
    expect(st.status).toBe("abandoned");
    expect(st.result!.result).toBe("failed");
  });
});
