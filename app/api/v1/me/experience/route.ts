import { requireCandidate } from "@/server/http/guard";
import { parseJson, route } from "@/server/http/route";
import { workHistorySchema } from "@/server/schemas/candidate";
import { setWorkHistory } from "@/server/services/candidate";

/** Replaces the whole work history (the editor always sends the full list). */
export const PUT = route(async (req) => {
  const me = await requireCandidate();
  const { items } = await parseJson(req, workHistorySchema);
  return setWorkHistory(me.profileId, items);
});
