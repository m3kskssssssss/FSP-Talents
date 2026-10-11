import { requireCandidate } from "@/server/http/guard";
import { route } from "@/server/http/route";
import { skipChallenge } from "@/server/services/challenges";

export const POST = route<{ id: string }>(async (_req, { params }) => {
  const me = await requireCandidate();
  return skipChallenge(me.profileId, params.id);
});
