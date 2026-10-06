import { requireCandidate } from "@/server/http/guard";
import { parseJson, route } from "@/server/http/route";
import { visibilitySchema } from "@/server/schemas/candidate";
import { setVisibility } from "@/server/services/candidate";

export const PUT = route(async (req) => {
  const me = await requireCandidate();
  const { visibility } = await parseJson(req, visibilitySchema);
  return setVisibility(me.profileId, visibility);
});
