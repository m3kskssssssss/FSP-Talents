import { requireEmployer } from "@/server/http/guard";
import { route } from "@/server/http/route";
import { uuidSchema } from "@/server/schemas/common";
import { candidateForEmployer } from "@/server/services/invitations";

/** Candidate profile for an employer; `contacts` is null unless the candidate accepted this employer's invitation. */
export const GET = route<{ profileId: string }>(async (_req, { params }) => {
  const me = await requireEmployer();
  return candidateForEmployer(me.employerId, me.userId, uuidSchema.parse(params.profileId));
});
