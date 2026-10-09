import { and, asc, count, desc, eq, gt, inArray, ne, or, sql } from "drizzle-orm";
import { db, type DbOrTx } from "../db";
import { candidateProfiles, chatMessages, chats, employers } from "../db/schema";
import { notFound } from "../lib/errors";
import { nextInterviewInChat } from "./interviews";
import { notify } from "./notifications";

/** Who is talking: the employer side or the candidate side of a chat. */
export type Party =
  { role: "employer"; employerId: string } | { role: "candidate"; profileId: string };

export const chatsPath = (role: Party["role"], chatId?: string) =>
  `/${role}/chats${chatId ? `?chat=${chatId}` : ""}`;

/**
 * Opens the employer–candidate conversation (or reuses the existing one) when
 * an invitation or an application is accepted, and leaves a system message
 * saying why it opened. Runs inside the caller's transaction.
 */
export async function openChat(
  tx: DbOrTx,
  input: { employerId: string; profileId: string; title: string; reason: string },
) {
  const [chat] = await tx
    .insert(chats)
    .values({ employerId: input.employerId, profileId: input.profileId, title: input.title })
    .onConflictDoUpdate({
      target: [chats.employerId, chats.profileId],
      set: { title: input.title, lastMessageAt: new Date() },
    })
    .returning({ id: chats.id });
  await tx.insert(chatMessages).values({ chatId: chat!.id, author: "system", body: input.reason });
  return chat!.id;
}

const ownership = (p: Party) =>
  p.role === "employer" ? eq(chats.employerId, p.employerId) : eq(chats.profileId, p.profileId);
const myReadAt = (p: Party) =>
  p.role === "employer" ? chats.employerReadAt : chats.candidateReadAt;

async function ownedChat(p: Party, chatId: string) {
  const [c] = await db()
    .select()
    .from(chats)
    .where(and(eq(chats.id, chatId), ownership(p)));
  if (!c) throw notFound("Чат не найден");
  return c;
}

/** Messages the other side wrote after I last opened the chat. */
const unreadFor = (p: Party) =>
  and(
    eq(chatMessages.chatId, chats.id),
    ne(chatMessages.author, p.role),
    or(sql`${myReadAt(p)} IS NULL`, gt(chatMessages.createdAt, myReadAt(p))),
  );

export async function listChats(p: Party) {
  const rows = await db()
    .select({
      id: chats.id,
      title: chats.title,
      lastMessageAt: chats.lastMessageAt,
      company: employers.companyName,
      candidate: candidateProfiles.fullName,
      unread: sql<number>`(SELECT count(*)::int FROM ${chatMessages} WHERE ${unreadFor(p)})`,
    })
    .from(chats)
    .innerJoin(employers, eq(employers.id, chats.employerId))
    .innerJoin(candidateProfiles, eq(candidateProfiles.id, chats.profileId))
    .where(ownership(p))
    .orderBy(desc(chats.lastMessageAt));
  const last = rows.length
    ? await db()
        .selectDistinctOn([chatMessages.chatId], {
          chatId: chatMessages.chatId,
          body: chatMessages.body,
          author: chatMessages.author,
        })
        .from(chatMessages)
        .where(
          inArray(
            chatMessages.chatId,
            rows.map((r) => r.id),
          ),
        )
        .orderBy(chatMessages.chatId, desc(chatMessages.createdAt))
    : [];
  const byChat = new Map(last.map((m) => [m.chatId, m]));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    with: p.role === "employer" ? r.candidate || "Кандидат" : r.company,
    lastMessageAt: r.lastMessageAt,
    unread: r.unread,
    last: byChat.get(r.id) ?? null,
  }));
}

/** Total unread messages across my chats (header badge). */
export async function unreadChats(p: Party) {
  const [r] = await db()
    .select({ n: count() })
    .from(chatMessages)
    .innerJoin(chats, eq(chats.id, chatMessages.chatId))
    .where(and(ownership(p), unreadFor(p)));
  return r?.n ?? 0;
}

/** The thread; opening it marks everything as read for my side. */
export async function getMessages(p: Party, chatId: string) {
  const c = await ownedChat(p, chatId);
  const messages = await db()
    .select({
      id: chatMessages.id,
      author: chatMessages.author,
      body: chatMessages.body,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .where(eq(chatMessages.chatId, chatId))
    .orderBy(asc(chatMessages.createdAt))
    .limit(500);
  await db()
    .update(chats)
    .set(p.role === "employer" ? { employerReadAt: new Date() } : { candidateReadAt: new Date() })
    .where(eq(chats.id, chatId));
  return {
    chat: { id: c.id, title: c.title },
    messages,
    interview: await nextInterviewInChat(chatId),
  };
}

/**
 * Sends a message. The other side gets a notification only for the first
 * unread message, not for every line of a conversation.
 */
export async function sendMessage(p: Party, chatId: string, body: string) {
  const c = await ownedChat(p, chatId);
  const other: Party =
    p.role === "employer"
      ? { role: "candidate", profileId: c.profileId }
      : { role: "employer", employerId: c.employerId };
  const [{ n: waiting } = { n: 0 }] = await db()
    .select({ n: count() })
    .from(chatMessages)
    .innerJoin(chats, eq(chats.id, chatMessages.chatId))
    .where(and(eq(chats.id, chatId), unreadFor(other)));
  const now = new Date();
  const [m] = await db().transaction(async (tx) => {
    const row = await tx
      .insert(chatMessages)
      .values({ chatId, author: p.role, body, createdAt: now })
      .returning();
    // writing a message means I have read everything before it
    await tx
      .update(chats)
      .set(
        p.role === "employer"
          ? { lastMessageAt: now, employerReadAt: now }
          : { lastMessageAt: now, candidateReadAt: now },
      )
      .where(eq(chats.id, chatId));
    if (!waiting) {
      const [who] =
        other.role === "candidate"
          ? await tx
              .select({ userId: candidateProfiles.userId, from: employers.companyName })
              .from(candidateProfiles)
              .innerJoin(employers, eq(employers.id, c.employerId))
              .where(eq(candidateProfiles.id, c.profileId))
          : await tx
              .select({ userId: employers.userId, from: candidateProfiles.fullName })
              .from(employers)
              .innerJoin(candidateProfiles, eq(candidateProfiles.id, c.profileId))
              .where(eq(employers.id, c.employerId));
      if (who)
        await notify(tx, who.userId, {
          title: `Новое сообщение: ${who.from || "кандидат"}`,
          body: body.length > 140 ? `${body.slice(0, 140)}…` : body,
          link: chatsPath(other.role, chatId),
        });
    }
    return row;
  });
  return { id: m!.id, author: m!.author, body: m!.body, createdAt: m!.createdAt };
}

/** The chat between this employer and candidate, if it has been opened. */
export async function chatIdFor(employerId: string, profileId: string) {
  const [c] = await db()
    .select({ id: chats.id })
    .from(chats)
    .where(and(eq(chats.employerId, employerId), eq(chats.profileId, profileId)));
  return c?.id ?? null;
}
