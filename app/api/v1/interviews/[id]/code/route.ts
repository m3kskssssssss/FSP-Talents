import { requireParty } from "@/server/http/party";
import { limitOrThrow, parseJson, route } from "@/server/http/route";
import { uuidSchema } from "@/server/schemas/common";
import { interviewCodeSchema } from "@/server/schemas/interviews";
import { saveCode } from "@/server/services/interviews";

/** Saves the shared editor; live sync between the two sides goes over the LiveKit data channel. */
export const PUT = route<{ id: string }>(async (req, { params }) => {
  const me = await requireParty();
  await limitOrThrow(`interview-code:${me.userId}`, 120, 60);
  const input = await parseJson(req, interviewCodeSchema);
  await saveCode(me, uuidSchema.parse(params.id), input);
});
