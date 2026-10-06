import { requireCandidate } from "@/server/http/guard";
import { parseJson, route } from "@/server/http/route";
import { selfAchievementSchema } from "@/server/schemas/candidate";
import { addSelfAchievement } from "@/server/services/candidate";

/** Self-declared achievement: source "self", minimal weight in ranking. */
export const POST = route(async (req) => {
  const me = await requireCandidate();
  return addSelfAchievement(me.profileId, await parseJson(req, selfAchievementSchema));
});
