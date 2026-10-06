import { requireCandidate } from "@/server/http/guard";
import { route } from "@/server/http/route";
import { issueHidden } from "@/server/services/testing";

/** Issues hidden inputs generated right now (attempt seed + fresh nonce). */
export const POST = route<{ id: string; itemId: string }>(async (_req, { params }) => {
  const me = await requireCandidate();
  return issueHidden(me.profileId, params.id, params.itemId);
});
