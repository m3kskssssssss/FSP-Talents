import { requireParty } from "@/server/http/party";
import { route } from "@/server/http/route";
import { uuidSchema } from "@/server/schemas/common";
import { cancelInterview } from "@/server/services/interviews";

export const POST = route<{ id: string }>(async (_req, { params }) => {
  const me = await requireParty();
  await cancelInterview(me, uuidSchema.parse(params.id));
});
