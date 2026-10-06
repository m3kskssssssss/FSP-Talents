import { requireCandidate } from "@/server/http/guard";
import { route } from "@/server/http/route";
import { deleteAchievement } from "@/server/services/candidate";

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const me = await requireCandidate();
  return deleteAchievement(me.profileId, params.id);
});
