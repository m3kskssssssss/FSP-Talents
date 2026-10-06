import { requireActor } from "@/server/http/guard";
import { parseJson, route } from "@/server/http/route";
import { reportResolveSchema } from "@/server/schemas/invitations";
import { resolveReport } from "@/server/services/reputation";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const me = await requireActor("admin");
  const { decision, note } = await parseJson(req, reportResolveSchema);
  return resolveReport(me.userId, params.id, decision, note);
});
