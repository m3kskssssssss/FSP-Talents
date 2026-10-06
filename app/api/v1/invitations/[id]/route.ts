import { candidateProfileId, employerId, requireActor } from "@/server/http/guard";
import { route } from "@/server/http/route";
import { getForCandidate, getForEmployer } from "@/server/services/invitations";

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const me = await requireActor("candidate", "employer");
  if (me.role === "candidate") return getForCandidate(await candidateProfileId(me.userId), me.userId, params.id);
  return getForEmployer(await employerId(me.userId), params.id);
});
