import { requireActor } from "@/server/http/guard";
import { route } from "@/server/http/route";
import { plagiarismReport } from "@/server/services/moderation";

export const GET = route(async () => {
  await requireActor("admin");
  return { clusters: await plagiarismReport() };
});
