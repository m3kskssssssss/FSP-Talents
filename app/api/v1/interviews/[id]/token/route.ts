import { requireDesktop } from "@/server/http/device";
import { requireParty } from "@/server/http/party";
import { limitOrThrow, route } from "@/server/http/route";
import { uuidSchema } from "@/server/schemas/common";
import { joinInterview } from "@/server/services/interviews";

/** LiveKit access token for the interview room, only while its window is open. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const me = await requireParty();
  requireDesktop(req.headers, "Подключение к собеседованию");
  await limitOrThrow(`interview-join:${me.userId}`, 20, 60);
  return joinInterview(me, uuidSchema.parse(params.id));
});
