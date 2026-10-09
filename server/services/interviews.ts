import { and, asc, desc, eq } from "drizzle-orm";
import { AccessToken } from "livekit-server-sdk";
import { db, type DbOrTx } from "../db";
import { candidateProfiles, chatMessages, chats, employers, interviews } from "../db/schema";
import { env } from "../env";
import { AppError, conflict, forbidden, notFound, unprocessable } from "../lib/errors";
import { addMinutes, DAY_MS } from "../lib/time";
import type { z } from "zod";
import type {
  interviewCodeSchema,
  interviewCreateSchema,
  interviewFinishSchema,
} from "../schemas/interviews";
import type { Party } from "./chats";
import { notify } from "./notifications";

export const INTERVIEW_CONFIG = {
  /** The room opens this long before the start… */
  joinBeforeMin: 15,
  /** …and stays open this long after the planned end. */
  joinAfterEndMin: 60,
  maxAheadDays: 60,
  /** A start a few minutes in the past is fine: "let's talk right now". */
  pastGraceMin: 5,
} as const;

export const interviewPath = (role: Party["role"], id: string) => `/${role}/interviews/${id}`;
export const roomName = (id: string) => `interview-${id}`;

/** Interview times in chat messages and notifications; the platform works in Moscow time. */
const moscow = (d: Date) =>
  `${d.toLocaleString("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  })} МСК`;

/** When the room can be entered; outside this window there is no token. */
export function joinWindow(i: { scheduledAt: Date; durationMin: number }) {
  return {
    opensAt: addMinutes(i.scheduledAt, -INTERVIEW_CONFIG.joinBeforeMin),
    closesAt: addMinutes(i.scheduledAt, i.durationMin + INTERVIEW_CONFIG.joinAfterEndMin),
  };
}

const ownership = (p: Party) =>
  p.role === "employer" ? eq(chats.employerId, p.employerId) : eq(chats.profileId, p.profileId);

const baseQuery = () =>
  db()
    .select({
      id: interviews.id,
      chatId: interviews.chatId,
      scheduledAt: interviews.scheduledAt,
      durationMin: interviews.durationMin,
      status: interviews.status,
      task: interviews.task,
      language: interviews.language,
      code: interviews.code,
      rating: interviews.rating,
      notes: interviews.notes,
      title: chats.title,
      employerId: chats.employerId,
      profileId: chats.profileId,
      company: employers.companyName,
      candidate: candidateProfiles.fullName,
      employerUserId: employers.userId,
      candidateUserId: candidateProfiles.userId,
    })
    .from(interviews)
    .innerJoin(chats, eq(chats.id, interviews.chatId))
    .innerJoin(employers, eq(employers.id, chats.employerId))
    .innerJoin(candidateProfiles, eq(candidateProfiles.id, chats.profileId));

type Row = Awaited<ReturnType<typeof baseQuery>>[number];

async function ownedInterview(p: Party, id: string) {
  const [i] = await baseQuery().where(and(eq(interviews.id, id), ownership(p)));
  if (!i) throw notFound("Собеседование не найдено");
  return i;
}

/** What one side sees: the employer's verdict stays with the employer. */
function view(p: Party, i: Row) {
  const { employerUserId: _e, candidateUserId: _c, rating, notes, ...rest } = i;
  return {
    ...rest,
    with: p.role === "employer" ? i.candidate || "Кандидат" : i.company,
    ...(p.role === "employer" ? { rating, notes } : {}),
    ...joinWindow(i),
  };
}

async function systemMessage(tx: DbOrTx, chatId: string, body: string) {
  const now = new Date();
  await tx.insert(chatMessages).values({ chatId, author: "system", body, createdAt: now });
  await tx.update(chats).set({ lastMessageAt: now }).where(eq(chats.id, chatId));
}

function otherUser(p: Party, i: Row) {
  return p.role === "employer"
    ? { userId: i.candidateUserId, from: i.company, role: "candidate" as const }
    : { userId: i.employerUserId, from: i.candidate || "Кандидат", role: "employer" as const };
}

/** The employer schedules an interview in an open chat; the candidate is notified. */
export async function scheduleInterview(
  employerId: string,
  chatId: string,
  input: z.infer<typeof interviewCreateSchema>,
  now = new Date(),
) {
  const [c] = await db()
    .select({ id: chats.id, userId: candidateProfiles.userId, company: employers.companyName })
    .from(chats)
    .innerJoin(candidateProfiles, eq(candidateProfiles.id, chats.profileId))
    .innerJoin(employers, eq(employers.id, chats.employerId))
    .where(and(eq(chats.id, chatId), eq(chats.employerId, employerId)));
  if (!c) throw notFound("Чат не найден");
  const at = input.scheduledAt;
  if (at.getTime() < now.getTime() - INTERVIEW_CONFIG.pastGraceMin * 60_000)
    throw unprocessable("Это время уже прошло", [
      { path: "scheduledAt", message: "Это время уже прошло" },
    ]);
  if (at.getTime() > now.getTime() + INTERVIEW_CONFIG.maxAheadDays * DAY_MS)
    throw unprocessable(`Не дальше чем на ${INTERVIEW_CONFIG.maxAheadDays} дней вперёд`, [
      {
        path: "scheduledAt",
        message: `Не дальше чем на ${INTERVIEW_CONFIG.maxAheadDays} дней вперёд`,
      },
    ]);
  return db().transaction(async (tx) => {
    const [row] = await tx
      .insert(interviews)
      .values({
        chatId,
        scheduledAt: at,
        durationMin: input.durationMin,
        language: input.language,
        task: input.task || null,
      })
      .returning({ id: interviews.id });
    const when = moscow(at);
    await systemMessage(
      tx,
      chatId,
      `Назначено видеособеседование: ${when}, ${input.durationMin} мин.`,
    );
    await notify(tx, c.userId, {
      title: `Собеседование: ${c.company}`,
      body: `Видеозвонок ${when}. Ссылка на комнату — в карточке собеседования.`,
      link: interviewPath("candidate", row!.id),
    });
    return { id: row!.id };
  });
}

export async function listInterviews(p: Party) {
  const rows = await baseQuery()
    .where(ownership(p))
    .orderBy(desc(interviews.scheduledAt))
    .limit(200);
  return rows.map((i) => view(p, i));
}

/** The nearest upcoming interview in a chat, for the banner in the thread. */
export async function nextInterviewInChat(chatId: string, now = new Date()) {
  const rows = await db()
    .select({
      id: interviews.id,
      scheduledAt: interviews.scheduledAt,
      durationMin: interviews.durationMin,
    })
    .from(interviews)
    .where(and(eq(interviews.chatId, chatId), eq(interviews.status, "scheduled")))
    .orderBy(asc(interviews.scheduledAt));
  return rows.find((i) => joinWindow(i).closesAt > now) ?? null;
}

export async function getInterview(p: Party, id: string) {
  return view(p, await ownedInterview(p, id));
}

/** Either side can call it off; the other side learns about it in the chat and a notification. */
export async function cancelInterview(p: Party, id: string) {
  const i = await ownedInterview(p, id);
  if (i.status !== "scheduled") throw conflict("Собеседование уже завершено или отменено");
  const who = p.role === "employer" ? i.company : i.candidate || "Кандидат";
  const other = otherUser(p, i);
  await db().transaction(async (tx) => {
    await tx.update(interviews).set({ status: "cancelled" }).where(eq(interviews.id, id));
    await systemMessage(tx, i.chatId, `${who} отменяет собеседование ${moscow(i.scheduledAt)}.`);
    await notify(tx, other.userId, {
      title: `Собеседование отменено: ${other.from}`,
      body: moscow(i.scheduledAt),
      link: interviewPath(other.role, id),
    });
  });
}

/** The employer closes the interview with a private rating and notes. */
export async function finishInterview(
  employerId: string,
  id: string,
  input: z.infer<typeof interviewFinishSchema>,
) {
  const i = await ownedInterview({ role: "employer", employerId }, id);
  if (i.status === "cancelled") throw conflict("Собеседование отменено");
  await db()
    .update(interviews)
    .set({ status: "done", rating: input.rating, notes: input.notes || null })
    .where(eq(interviews.id, id));
  if (i.status === "scheduled") await systemMessage(db(), i.chatId, "Собеседование завершено.");
}

/** Persists the shared editor so whoever joins later sees the current code. */
export async function saveCode(p: Party, id: string, input: z.infer<typeof interviewCodeSchema>) {
  const i = await ownedInterview(p, id);
  if (i.status !== "scheduled") throw conflict("Собеседование уже завершено или отменено");
  await db()
    .update(interviews)
    .set({ code: input.code, language: input.language })
    .where(eq(interviews.id, id));
}

/**
 * A LiveKit access token for this interview's room. Only the two sides of the
 * chat get one, only while the interview is scheduled and its window is open.
 */
export async function joinInterview(p: Party & { userId: string }, id: string, now = new Date()) {
  const i = await ownedInterview(p, id);
  if (i.status !== "scheduled") throw conflict("Собеседование уже завершено или отменено");
  const w = joinWindow(i);
  if (now < w.opensAt)
    throw forbidden(`Комната откроется за ${INTERVIEW_CONFIG.joinBeforeMin} минут до начала`);
  if (now > w.closesAt) throw forbidden("Время собеседования прошло");
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = env();
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET)
    throw new AppError(503, "video_unavailable", "Видеосвязь не настроена на сервере");
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: `${p.role}-${p.userId}`,
    name: p.role === "employer" ? i.company : i.candidate || "Кандидат",
    ttl: Math.ceil((w.closesAt.getTime() - now.getTime()) / 1000),
  });
  at.addGrant({
    room: roomName(id),
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
  return { url: LIVEKIT_URL, token: await at.toJwt() };
}
