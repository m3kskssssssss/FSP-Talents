import { beforeEach, describe, expect, it } from "vitest";
import { CHALLENGE_CONFIG } from "@/server/config";
import { DAY_MS } from "@/server/lib/time";
import {
  candidateChallenges,
  challengeSignals,
  closeChallenge,
  createChallenge,
  gradeSubmission,
  listSubmissions,
  normalizeAnswer,
  offerNext,
  skipChallenge,
  submitAnswer,
} from "@/server/services/challenges";
import { searchBase, searchResults } from "@/server/services/matching";
import { resetDb } from "../helpers/db";
import { makeCandidate, makeCategorized, makeEmployer } from "../helpers/factories";

const exact = {
  title: "Дубли",
  statement: "Сколько строк вернёт запрос с GROUP BY и HAVING count(*) > 1?",
  specialization: "backend" as const,
  kind: "exact" as const,
  expectedAnswer: "2",
};
const open = {
  title: "Кеш курсов",
  statement: "Предложите схему кеширования курсов валют для платёжного шлюза.",
  specialization: "backend" as const,
  kind: "open" as const,
};

describe("regular employer challenges", () => {
  beforeEach(resetDb);

  it("offers only to candidates of the category, once per period, and checks exact answers", async () => {
    const emp = await makeEmployer();
    await createChallenge(emp.employerId, exact);
    const front = await makeCategorized({ spec: "frontend" });
    const none = await makeCandidate({});
    const c = await makeCategorized({});

    expect(await offerNext(front.profileId)).toBeNull();
    expect(await offerNext(none.profileId)).toBeNull();
    const a = await offerNext(c.profileId);
    expect(a).toBeTruthy();
    // pending task — nothing new
    expect(await offerNext(c.profileId)).toBeNull();

    const view = await candidateChallenges(c.profileId);
    expect(view.current?.title).toBe("Дубли");
    expect(view.current).not.toHaveProperty("expectedAnswer");

    expect(await submitAnswer(c.profileId, a!.id, " 2. ")).toMatchObject({ status: "graded", score: 3 });
    await expect(submitAnswer(c.profileId, a!.id, "2")).rejects.toMatchObject({ status: 409 });

    // a new task appears only after the period
    await createChallenge(emp.employerId, open);
    expect(await offerNext(c.profileId)).toBeNull();
    const later = new Date(Date.now() + (CHALLENGE_CONFIG.periodDays + 1) * DAY_MS);
    expect(await offerNext(c.profileId, later)).toBeTruthy();
  });

  it("open answers wait for the employer's grade; only the owner grades; good results become a signal", async () => {
    const emp = await makeEmployer();
    const other = await makeEmployer("ООО Чужие");
    await createChallenge(emp.employerId, open);
    const c = await makeCategorized({ fullName: "Анна Петрова" });
    const a = (await offerNext(c.profileId))!;
    expect(await submitAnswer(c.profileId, a.id, "Redis с TTL и фоновое обновление")).toMatchObject({ status: "submitted" });

    const [sub] = await listSubmissions(emp.employerId);
    expect(sub).toMatchObject({ displayName: "Анна П.", status: "submitted" });
    expect(sub).not.toHaveProperty("email");
    await expect(gradeSubmission(other.employerId, a.id, { score: 3 })).rejects.toMatchObject({ status: 404 });
    expect((await challengeSignals([c.profileId])).size).toBe(0);

    await gradeSubmission(emp.employerId, a.id, { score: 3, feedback: "Отлично" });
    await expect(gradeSubmission(emp.employerId, a.id, { score: 1 })).rejects.toMatchObject({ status: 409 });
    expect((await challengeSignals([c.profileId])).get(c.profileId)).toMatchObject({ title: "Кеш курсов", score: 3 });

    // the employer sees it as a reason in the selection
    const s = await searchBase(other.employerId, { specialization: "backend", stack: [] });
    const res = await searchResults(other.employerId, s.searchId, {});
    expect(res.items.find((i) => i.profileId === c.profileId)?.pros.some((p) => p.startsWith("Свежий сигнал"))).toBe(true);
  });

  it("spreads tasks: the least exposed one goes first; closed and skipped tasks are not repeated", async () => {
    const emp = await makeEmployer();
    const t1 = await createChallenge(emp.employerId, exact);
    await createChallenge(emp.employerId, open);
    const c1 = await makeCategorized({});
    const c2 = await makeCategorized({});
    const a1 = (await offerNext(c1.profileId))!;
    const a2 = (await offerNext(c2.profileId))!;
    const titles = [(await candidateChallenges(c1.profileId)).current!.title, (await candidateChallenges(c2.profileId)).current!.title];
    expect(new Set(titles).size).toBe(2);

    await skipChallenge(c1.profileId, a1.id);
    await expect(skipChallenge(c2.profileId, a1.id)).rejects.toMatchObject({ status: 404 });
    await skipChallenge(c2.profileId, a2.id);

    await closeChallenge(emp.employerId, t1.id);
    const later = new Date(Date.now() + (CHALLENGE_CONFIG.periodDays + 1) * DAY_MS);
    const next = await offerNext(c1.profileId, later);
    const view = await candidateChallenges(c1.profileId, later);
    if (next) expect(view.current!.title).not.toBe(exact.title);
  });

  it("normalises answers", () => {
    expect(normalizeAnswer("  42,5. ")).toBe("42.5");
    expect(normalizeAnswer("Ёлка  Палка")).toBe("елка палка");
  });
});
