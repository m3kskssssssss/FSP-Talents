import { requireEmployer } from "@/server/http/guard";
import { route } from "@/server/http/route";
import { listShortlist } from "@/server/services/matching";

export const GET = route(async () => {
  const me = await requireEmployer();
  return { items: await listShortlist(me.employerId) };
});
