import { and, count, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { notifications } from "@/server/db/schema";
import { requireActor } from "@/server/http/guard";
import { requireParty } from "@/server/http/party";
import { route } from "@/server/http/route";
import { unreadChats } from "@/server/services/chats";

/** Header badges: unread notifications and chat messages. Polled by the header. */
export const GET = route(async () => {
  const me = await requireActor();
  const [n] = await db()
    .select({ n: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, me.userId), isNull(notifications.readAt)));
  const chats = me.role === "admin" ? 0 : await unreadChats(await requireParty());
  return { notifications: n?.n ?? 0, chats };
});
