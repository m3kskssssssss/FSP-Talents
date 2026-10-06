import { requireActor } from "@/server/http/guard";
import { route } from "@/server/http/route";
import { attemptDetail } from "@/server/services/moderation";

export const GET = route<{ id: string }>(async (_req, { params }) => {
  await requireActor("admin");
  return attemptDetail(params.id);
});
