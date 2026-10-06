import { requireCandidate } from "@/server/http/guard";
import { limitOrThrow, parseJson, route } from "@/server/http/route";
import { reportSchema } from "@/server/schemas/invitations";
import { decide } from "@/server/services/invitations";
import { REPORT_REASONS, reportInvitation } from "@/server/services/reputation";

/** Complain about an invitation; an open invitation is declined at the same time. Repeat -> 409. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const me = await requireCandidate();
  await limitOrThrow(`report:${me.userId}`, 20, 86400);
  const { reason, note } = await parseJson(req, reportSchema);
  const r = await reportInvitation(me.profileId, me.userId, params.id, reason, note);
  if (r.wasOpen) await decide(me.profileId, me.userId, params.id, "decline", `Жалоба: ${REPORT_REASONS[reason]}`);
  return { id: r.id };
});
