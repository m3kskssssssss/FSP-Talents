import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { notifications } from "@/server/db/schema";
import { resetEnvCache } from "@/server/env";
import { addMinutes } from "@/server/lib/time";
import { chatIdFor, getMessages, type Party } from "@/server/services/chats";
import {
  cancelInterview,
  finishInterview,
  getInterview,
  joinInterview,
  listInterviews,
  saveCode,
  scheduleInterview,
} from "@/server/services/interviews";
import { createInvitation, decide } from "@/server/services/invitations";
import { resetDb } from "../helpers/db";
import { makeCategorized, makeEmployer } from "../helpers/factories";

async function openChat() {
  const emp = await makeEmployer("ООО Звонок");
  const c = await makeCategorized({ fullName: "Анна Петрова" });
  const inv = await createInvitation(emp.employerId, emp.user.id, {
    profileId: c.profileId,
    title: "Python-разработчик",
    description: "Платёжный шлюз",
    salaryFrom: 200000,
    salaryTo: 260000,
  });
  await decide(c.profileId, c.user.id, inv.id, "accept");
  const chatId = (await chatIdFor(emp.employerId, c.profileId))!;
  const employer: Party = { role: "employer", employerId: emp.employerId };
  const candidate: Party = { role: "candidate", profileId: c.profileId };
  return { emp, c, chatId, employer, candidate };
}

const input = (scheduledAt: Date) => ({
  scheduledAt,
  durationMin: 60,
  language: "python" as const,
});

describe("video interviews", () => {
  beforeEach(async () => {
    await resetDb();
    process.env.LIVEKIT_URL = "wss://test.livekit.cloud";
    process.env.LIVEKIT_API_KEY = "key";
    process.env.LIVEKIT_API_SECRET = "secret-secret-secret-secret-secret";
    resetEnvCache();
  });

  it("schedules from a chat, notifies the candidate and hides the verdict from them", async () => {
    const { emp, c, chatId, employer, candidate } = await openChat();
    const at = addMinutes(new Date(), 120);
    const { id } = await scheduleInterview(emp.employerId, chatId, {
      ...input(at),
      task: "FizzBuzz",
    });

    const thread = await getMessages(candidate, chatId);
    expect(thread.messages.at(-1)!.body).toMatch(/видеособеседование/i);
    expect(thread.interview?.id).toBe(id);
    const pings = await db()
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, c.user.id),
          eq(notifications.link, `/candidate/interviews/${id}`),
        ),
      );
    expect(pings).toHaveLength(1);

    expect(await listInterviews(candidate)).toHaveLength(1);
    await finishInterview(emp.employerId, id, { rating: 4, notes: "Сильный алгоритмист" });
    expect(await getInterview(employer, id)).toMatchObject({ status: "done", rating: 4 });
    const seen = await getInterview(candidate, id);
    expect(seen).not.toHaveProperty("rating");
    expect(seen).not.toHaveProperty("notes");
  });

  it("gives a room token only to the two sides and only inside the window", async () => {
    const { emp, c, chatId, candidate } = await openChat();
    const at = addMinutes(new Date(), 120);
    const { id } = await scheduleInterview(emp.employerId, chatId, input(at));
    const me = { ...candidate, userId: c.user.id };

    await expect(joinInterview(me, id)).rejects.toMatchObject({ status: 403 });
    const r = await joinInterview(me, id, addMinutes(at, -10));
    expect(r.url).toBe("wss://test.livekit.cloud");
    expect(r.token.split(".")).toHaveLength(3);
    await expect(joinInterview(me, id, addMinutes(at, 200))).rejects.toMatchObject({ status: 403 });

    const stranger = await makeEmployer("ООО Чужие");
    await expect(
      joinInterview(
        { role: "employer", employerId: stranger.employerId, userId: stranger.user.id },
        id,
        at,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("rejects past times, stores shared code and stops after cancel", async () => {
    const { emp, chatId, employer, candidate } = await openChat();
    await expect(
      scheduleInterview(emp.employerId, chatId, input(addMinutes(new Date(), -60))),
    ).rejects.toMatchObject({ status: 422 });

    const { id } = await scheduleInterview(
      emp.employerId,
      chatId,
      input(addMinutes(new Date(), 30)),
    );
    await saveCode(candidate, id, { code: "print(42)", language: "python" });
    expect((await getInterview(employer, id)).code).toBe("print(42)");

    await cancelInterview(candidate, id);
    expect((await getInterview(employer, id)).status).toBe("cancelled");
    await expect(saveCode(employer, id, { code: "", language: "sql" })).rejects.toMatchObject({
      status: 409,
    });
    await expect(cancelInterview(employer, id)).rejects.toMatchObject({ status: 409 });
    expect((await getMessages(employer, chatId)).interview).toBeNull();
  });
});
