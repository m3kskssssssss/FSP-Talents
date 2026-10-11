import { requireEmployer } from "@/server/http/guard";
import { route } from "@/server/http/route";
import { listSubmissions } from "@/server/services/challenges";

export const GET = route(async () => {
  const me = await requireEmployer();
  return { items: await listSubmissions(me.employerId) };
});
