import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { notifications } from "@/server/db/schema";
import {
  chatIdFor,
  getMessages,
  listChats,
  sendMessage,
  unreadChats,
  type Party,
} from "@/server/services/chats";
import { createInvitation, decide } from "@/server/services/invitations";
import { resetDb } from "../helpers/db";
import { makeCategorized, makeEmployer } from "../helpers/factories";

const base = {
  title: "Python-разработчик",
  description: "Платёжный шлюз, высокие нагрузки",
  salaryFrom: 200000,
  salaryTo: 260000,
};

describe("employer–candidate chats", () => {
  beforeEach(resetDb);

  it("opens on acceptance only, counts unread per side and notifies once per unread streak", async () => {
    const emp = await makeEmployer("ООО Чат");
    const c = await makeCategorized({ fullName: "Анна Петрова" });
    const employer: Party = { role: "employer", employerId: emp.employerId };
    const candidate: Party = { role: "candidate", profileId: c.profileId };

    const inv = await createInvitation(emp.employerId, emp.user.id, {
      profileId: c.profileId,
      ...base,
    });
    expect(await chatIdFor(emp.employerId, c.profileId)).toBeNull();

    await decide(c.profileId, c.user.id, inv.id, "accept");
    const chatId = (await chatIdFor(emp.employerId, c.profileId))!;
    expect(chatId).toBeTruthy();
    const [mine] = await listChats(employer);
    expect(mine).toMatchObject({ id: chatId, with: "Анна Петрова", title: base.title });
    expect((await getMessages(employer, chatId)).messages[0]!.author).toBe("system");

    await sendMessage(employer, chatId, "Здравствуйте! Удобно созвониться завтра?");
    await sendMessage(employer, chatId, "Например, в 15:00.");
    expect(await unreadChats(candidate)).toBe(2);
    expect(await unreadChats(employer)).toBe(0);
    const pings = await db()
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, c.user.id),
          eq(notifications.link, `/candidate/chats?chat=${chatId}`),
        ),
      );
    expect(pings).toHaveLength(1);

    await getMessages(candidate, chatId);
    expect(await unreadChats(candidate)).toBe(0);
    await sendMessage(candidate, chatId, "Да, подходит");
    expect(await unreadChats(employer)).toBe(1);
  });

  it("a stranger cannot read or write someone else's chat", async () => {
    const emp = await makeEmployer();
    const c = await makeCategorized({});
    const inv = await createInvitation(emp.employerId, emp.user.id, {
      profileId: c.profileId,
      ...base,
    });
    await decide(c.profileId, c.user.id, inv.id, "accept");
    const chatId = (await chatIdFor(emp.employerId, c.profileId))!;
    const other = await makeEmployer("ООО Чужие");
    await expect(
      getMessages({ role: "employer", employerId: other.employerId }, chatId),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      sendMessage({ role: "employer", employerId: other.employerId }, chatId, "привет"),
    ).rejects.toMatchObject({ status: 404 });
  });
});
