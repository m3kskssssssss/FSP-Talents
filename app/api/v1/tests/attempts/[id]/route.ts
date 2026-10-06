import { requireCandidate } from "@/server/http/guard";
import { route } from "@/server/http/route";
import { getAttempt } from "@/server/services/testing";

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const me = await requireCandidate();
  return getAttempt(me.profileId, params.id);
});
