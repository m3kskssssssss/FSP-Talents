import { requireCandidate } from "@/server/http/guard";
import { route } from "@/server/http/route";
import { candidateChallenges, offerNext } from "@/server/services/challenges";

export const GET = route(async () => {
  const me = await requireCandidate();
  await offerNext(me.profileId);
  return candidateChallenges(me.profileId);
});
