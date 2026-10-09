import { requireParty } from "@/server/http/party";
import { route } from "@/server/http/route";
import { listInterviews } from "@/server/services/interviews";

/** My interviews (both sides), newest first. */
export const GET = route(async () => {
  const me = await requireParty();
  return { items: await listInterviews(me) };
});
