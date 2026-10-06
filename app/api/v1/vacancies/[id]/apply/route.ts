import { requireCandidate } from "@/server/http/guard";
import { parseJson, route } from "@/server/http/route";
import { applySchema } from "@/server/schemas/vacancies";
import { apply } from "@/server/services/vacancies";

/** Apply to a vacancy: discloses contacts to its employer. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const me = await requireCandidate();
  const { coverLetter } = await parseJson(req, applySchema);
  return apply(me.profileId, me.userId, params.id, coverLetter);
});
