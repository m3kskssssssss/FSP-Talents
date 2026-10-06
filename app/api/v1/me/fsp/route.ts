import { requireCandidate } from "@/server/http/guard";
import { limitOrThrow, parseJson, route } from "@/server/http/route";
import { fspLinkSchema } from "@/server/schemas/candidate";
import { linkFsp } from "@/server/services/candidate";

/** Link FSP ID: achievements are imported from the registry (mock) with trust "high". */
export const POST = route(async (req) => {
  const me = await requireCandidate();
  await limitOrThrow(`fsp:${me.userId}`, 20, 3600);
  const { fspId } = await parseJson(req, fspLinkSchema);
  return linkFsp(me.profileId, fspId);
});
