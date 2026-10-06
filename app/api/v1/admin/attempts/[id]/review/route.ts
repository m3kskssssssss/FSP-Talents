import { requireActor } from "@/server/http/guard";
import { parseJson, route } from "@/server/http/route";
import { reviewSchema } from "@/server/schemas/moderation";
import { reviewAttempt } from "@/server/services/moderation";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const me = await requireActor("admin");
  const { decision, note } = await parseJson(req, reviewSchema);
  return reviewAttempt(me.userId, params.id, decision, note);
});
