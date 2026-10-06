import { requireCandidate } from "@/server/http/guard";
import { parseJson, route } from "@/server/http/route";
import { profileUpdateSchema } from "@/server/schemas/candidate";
import { getMyProfile, updateProfile } from "@/server/services/candidate";

/** The candidate's own profile. There is no endpoint returning another candidate's profile to a candidate. */
export const GET = route(async () => {
  const me = await requireCandidate();
  return getMyProfile(me.profileId, me.userId);
});

export const PUT = route(async (req) => {
  const me = await requireCandidate();
  return updateProfile(me.profileId, await parseJson(req, profileUpdateSchema));
});
