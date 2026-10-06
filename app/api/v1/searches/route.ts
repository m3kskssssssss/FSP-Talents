import { requireEmployer } from "@/server/http/guard";
import { parseJson, route } from "@/server/http/route";
import { baseSearchSchema } from "@/server/schemas/needs";
import { listSearches, searchBase } from "@/server/services/matching";

export const GET = route(async () => {
  const me = await requireEmployer();
  return { items: await listSearches(me.employerId) };
});

/** Search over the whole base without a saved need. */
export const POST = route(async (req) => {
  const me = await requireEmployer();
  return searchBase(me.employerId, await parseJson(req, baseSearchSchema));
});
