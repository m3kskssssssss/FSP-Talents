import { requireCandidate } from "@/server/http/guard";
import { parseJson, route } from "@/server/http/route";
import { contactsSchema } from "@/server/schemas/candidate";
import { updateContacts } from "@/server/services/candidate";

export const PUT = route(async (req) => {
  const me = await requireCandidate();
  return updateContacts(me.profileId, await parseJson(req, contactsSchema));
});
