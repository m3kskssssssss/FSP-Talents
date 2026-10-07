import { requireParty } from "@/server/http/party";
import { limitOrThrow, parseJson, route } from "@/server/http/route";
import { chatMessageSchema } from "@/server/schemas/chats";
import { uuidSchema } from "@/server/schemas/common";
import { getMessages, sendMessage } from "@/server/services/chats";

/** The thread; reading it marks the chat as read for my side. */
export const GET = route<{ id: string }>(async (_req, { params }) => {
  const me = await requireParty();
  return getMessages(me, uuidSchema.parse(params.id));
});

export const POST = route<{ id: string }>(async (req, { params }) => {
  const me = await requireParty();
  await limitOrThrow(`chat:${me.userId}`, 30, 60);
  const { body } = await parseJson(req, chatMessageSchema);
  return sendMessage(me, uuidSchema.parse(params.id), body);
});
