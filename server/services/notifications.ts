import { and, desc, eq, isNull } from "drizzle-orm";
import { db, type DbOrTx } from "../db";
import { notifications } from "../db/schema";

export async function notify(tx: DbOrTx, userId: string, n: { title: string; body?: string; link?: string }) {
  await tx.insert(notifications).values({ userId, ...n });
}

export async function listNotifications(userId: string, limit = 30) {
  return db()
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function markAllRead(userId: string) {
  await db()
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}
