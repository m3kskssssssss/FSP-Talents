import { requireCandidate } from "@/server/http/guard";
import { limitOrThrow, parseJson, route } from "@/server/http/route";
import { startAttemptSchema } from "@/server/schemas/testing";
import { startAttempt } from "@/server/services/testing";

export const POST = route(async (req) => {
  const me = await requireCandidate();
  await limitOrThrow(`attempt-start:${me.userId}`, 10, 3600);
  const input = await parseJson(req, startAttemptSchema);
  return startAttempt(me.userId, me.profileId, input.specialization, input.grade);
});
