import { requireEmployer } from "@/server/http/guard";
import { route } from "@/server/http/route";
import { closeChallenge } from "@/server/services/challenges";

export const POST = route<{ id: string }>(async (_req, { params }) => {
  const me = await requireEmployer();
  return closeChallenge(me.employerId, params.id);
});
