import { requireCandidate } from "@/server/http/guard";
import { limitOrThrow, parseJson, route } from "@/server/http/route";
import { challengeAnswerSchema } from "@/server/schemas/challenges";
import { submitAnswer } from "@/server/services/challenges";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const me = await requireCandidate();
  await limitOrThrow(`challenge-answer:${me.profileId}`, 10, 60);
  const { answer } = await parseJson(req, challengeAnswerSchema);
  return submitAnswer(me.profileId, params.id, answer);
});
