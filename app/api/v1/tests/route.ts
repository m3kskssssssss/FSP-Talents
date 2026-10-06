import { requireCandidate } from "@/server/http/guard";
import { route } from "@/server/http/route";
import { availability } from "@/server/services/testing";

export const GET = route(async () => {
  const me = await requireCandidate();
  return { specializations: await availability(me.profileId) };
});
