import { requireCandidate } from "@/server/http/guard";
import { parseJson, route } from "@/server/http/route";
import { invitationDecisionSchema } from "@/server/schemas/invitations";
import { decide } from "@/server/services/invitations";

/** Accept or decline. Invalid state transitions -> 409. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const me = await requireCandidate();
  const { decision, reason } = await parseJson(req, invitationDecisionSchema);
  return decide(me.profileId, me.userId, params.id, decision, reason);
});
