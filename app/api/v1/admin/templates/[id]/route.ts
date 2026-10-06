import { requireActor } from "@/server/http/guard";
import { parseJson, route } from "@/server/http/route";
import { templateStatusSchema } from "@/server/schemas/moderation";
import { setTemplateStatus } from "@/server/services/moderation";

export const PATCH = route<{ id: string }>(async (req, { params }) => {
  const me = await requireActor("admin");
  const { status } = await parseJson(req, templateStatusSchema);
  return setTemplateStatus(me.userId, params.id, status);
});
