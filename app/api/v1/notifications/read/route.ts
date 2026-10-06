import { requireActor } from "@/server/http/guard";
import { route } from "@/server/http/route";
import { markAllRead } from "@/server/services/notifications";

export const POST = route(async () => {
  const me = await requireActor();
  await markAllRead(me.userId);
  return { ok: true };
});
