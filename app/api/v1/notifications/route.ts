import { requireActor } from "@/server/http/guard";
import { route } from "@/server/http/route";
import { listNotifications } from "@/server/services/notifications";

export const GET = route(async () => {
  const me = await requireActor();
  return { items: await listNotifications(me.userId) };
});
