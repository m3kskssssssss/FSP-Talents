import { requireActor } from "@/server/http/guard";
import { parseQuery, route } from "@/server/http/route";
import { attemptsFilterSchema } from "@/server/schemas/moderation";
import { listAttempts } from "@/server/services/moderation";

export const GET = route(async (req) => {
  await requireActor("admin");
  return listAttempts(parseQuery(req, attemptsFilterSchema));
});
