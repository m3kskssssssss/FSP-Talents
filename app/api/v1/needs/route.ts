import { requireEmployer } from "@/server/http/guard";
import { parseJson, route } from "@/server/http/route";
import { needCreateSchema } from "@/server/schemas/needs";
import { createNeed, listNeeds } from "@/server/services/needs";

export const GET = route(async () => {
  const me = await requireEmployer();
  return { items: await listNeeds(me.employerId) };
});

export const POST = route(async (req) => {
  const me = await requireEmployer();
  const input = await parseJson(req, needCreateSchema);
  return createNeed(me.employerId, input);
});
