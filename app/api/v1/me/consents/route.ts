import { requireActor } from "@/server/http/guard";
import { parseJson, route } from "@/server/http/route";
import { consentSchema } from "@/server/schemas/candidate";
import { setConsent } from "@/server/services/candidate";

export const POST = route(async (req) => {
  const me = await requireActor();
  const { kind, granted } = await parseJson(req, consentSchema);
  return setConsent(me.userId, kind, granted);
});
