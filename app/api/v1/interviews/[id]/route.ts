import { requireParty } from "@/server/http/party";
import { route } from "@/server/http/route";
import { uuidSchema } from "@/server/schemas/common";
import { getInterview } from "@/server/services/interviews";

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const me = await requireParty();
  return getInterview(me, uuidSchema.parse(params.id));
});
