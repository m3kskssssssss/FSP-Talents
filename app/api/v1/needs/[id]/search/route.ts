import { requireEmployer } from "@/server/http/guard";
import { route } from "@/server/http/route";
import { searchForNeed } from "@/server/services/matching";

export const POST = route<{ id: string }>(async (_req, { params }) => {
  const me = await requireEmployer();
  return searchForNeed(me.employerId, params.id);
});
