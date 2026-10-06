import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { categories, taskTemplates, testAttempts } from "@/server/db/schema";
import { attemptDetail, listAttempts, reviewAttempt, setTemplateStatus, templateStats } from "@/server/services/moderation";
import { syncTemplates } from "@/server/services/testing";
import { resetDb } from "../helpers/db";
import { makeCandidate, makeUser } from "../helpers/factories";

async function finishedAttempt(profileId: string, trust: "low" | "medium" | "high", result: "passed" | "failed" = "passed") {
  const now = new Date();
  const [a] = await db()
    .insert(testAttempts)
    .values({ profileId, specialization: "backend", targetGrade: "middle", status: "finished", startedAt: now, deadlineAt: now, finishedAt: now, theta: 0.6, se: 0.3, score: 21, result, trustIndex: trust === "low" ? 20 : 80, trustLevel: trust, trustSignals: { signals: [{ code: "marker", title: "Маркер", points: 65 }] }, seed: "s", marker: "kvant_x9" })
    .returning();
  return a!;
}

describe("moderation", () => {
  beforeEach(async () => {
    await resetDb();
    await syncTemplates(true);
  });

  it("lists low-trust attempts first and lets a moderator approve (category with a mark) or reject", async () => {
    const admin = await makeUser("admin");
    const c = await makeCandidate();
    const low = await finishedAttempt(c.profileId, "low");
    await finishedAttempt(c.profileId, "high");
    const list = await listAttempts({});
    expect(list.items[0]!.id).toBe(low.id);
    expect((await listAttempts({ level: "low", pending: true })).items).toHaveLength(1);

    const detail = await attemptDetail(low.id);
    expect(detail.category).toBeNull();
    const r = await reviewAttempt(admin.id, low.id, "approve", "проверено на звонке");
    expect(r.categoryAssigned).toBe(true);
    const [cat] = await db().select().from(categories).where(eq(categories.attemptId, low.id));
    expect(cat).toMatchObject({ status: "active", trustLevel: "medium" });

    await reviewAttempt(admin.id, low.id, "reject");
    const active = await db().select().from(categories).where(and(eq(categories.profileId, c.profileId), eq(categories.status, "active")));
    expect(active).toHaveLength(0);
  });

  it("template status changes; re-activation resets drift counters", async () => {
    const admin = await makeUser("admin");
    await db().update(taskTemplates).set({ answeredCount: 100, correctCount: 90, expectedCorrect: 50 }).where(eq(taskTemplates.id, "be-code-lru"));
    const stats = await templateStats();
    expect(stats.find((t) => t.id === "be-code-lru")!.verdict.flagged).toBe(true);
    await setTemplateStatus(admin.id, "be-code-lru", "flagged");
    await setTemplateStatus(admin.id, "be-code-lru", "active");
    const [t] = await db().select().from(taskTemplates).where(eq(taskTemplates.id, "be-code-lru"));
    expect(t).toMatchObject({ status: "active", answeredCount: 0 });
  });
});
