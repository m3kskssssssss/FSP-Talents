import { requireCandidate } from "@/server/http/guard";
import { route } from "@/server/http/route";
import { finishEarly } from "@/server/services/testing";

export const POST = route<{ id: string }>(async (_req, { params }) => {
  const me = await requireCandidate();
  return finishEarly(me.profileId, params.id);
});
