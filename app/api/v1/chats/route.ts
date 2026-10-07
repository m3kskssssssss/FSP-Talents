import { requireParty } from "@/server/http/party";
import { route } from "@/server/http/route";
import { listChats } from "@/server/services/chats";

/** My conversations, newest first, with the last message and the unread count. */
export const GET = route(async () => {
  const me = await requireParty();
  return { items: await listChats(me) };
});
