import { requireCandidate } from "@/server/http/guard";
import { parseJson, route } from "@/server/http/route";
import { answerSchema } from "@/server/schemas/testing";
import { submitAnswer } from "@/server/services/testing";
import type { Answer } from "@/server/testing/engine";

export const POST = route<{ id: string; itemId: string }>(async (req, { params }) => {
  const me = await requireCandidate();
  const input = await parseJson(req, answerSchema);
  return submitAnswer(me.profileId, params.id, params.itemId, { ...input, answer: input.answer as Answer | undefined });
});
