import { requireEmployer } from "@/server/http/guard";
import { route } from "@/server/http/route";
import { getNeed } from "@/server/services/needs";

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const me = await requireEmployer();
  return getNeed(me.employerId, params.id);
});
