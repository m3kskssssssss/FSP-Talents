import { requireEmployer } from "@/server/http/guard";
import { route } from "@/server/http/route";
import { uuidSchema } from "@/server/schemas/common";
import { addToShortlist, removeFromShortlist } from "@/server/services/matching";

export const PUT = route<{ profileId: string }>(async (_req, { params }) => {
  const me = await requireEmployer();
  return addToShortlist(me.employerId, uuidSchema.parse(params.profileId));
});

export const DELETE = route<{ profileId: string }>(async (_req, { params }) => {
  const me = await requireEmployer();
  return removeFromShortlist(me.employerId, uuidSchema.parse(params.profileId));
});
