import { requireCandidate } from "@/server/http/guard";
import { parseJson, route } from "@/server/http/route";
import { showcaseSchema } from "@/server/schemas/candidate";
import { setShowcase } from "@/server/services/candidate";

/** Up to five own achievements pinned to the profile showcase, in display order. */
export const PUT = route(async (req) => {
  const me = await requireCandidate();
  const { ids } = await parseJson(req, showcaseSchema);
  return setShowcase(me.profileId, ids);
});
