import { requireCandidate } from "@/server/http/guard";
import { route } from "@/server/http/route";
import { contactAccessLog } from "@/server/services/candidate";

export const GET = route(async () => {
  const me = await requireCandidate();
  return { items: await contactAccessLog(me.profileId) };
});
