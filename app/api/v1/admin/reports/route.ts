import { requireActor } from "@/server/http/guard";
import { route } from "@/server/http/route";
import { listReports } from "@/server/services/reputation";

export const GET = route(async (req) => {
  await requireActor("admin");
  const s = new URL(req.url).searchParams.get("status");
  return { items: await listReports(s === "open" || s === "confirmed" || s === "dismissed" ? s : undefined) };
});
