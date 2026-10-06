import { requireCandidate } from "@/server/http/guard";
import { parseJson, route } from "@/server/http/route";
import { attemptEventsSchema } from "@/server/schemas/testing";
import { logEvents } from "@/server/services/testing";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const me = await requireCandidate();
  const { events } = await parseJson(req, attemptEventsSchema);
  return logEvents(me.profileId, params.id, events);
});
