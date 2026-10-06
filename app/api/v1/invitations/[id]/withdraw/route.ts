import { requireEmployer } from "@/server/http/guard";
import { route } from "@/server/http/route";
import { withdraw } from "@/server/services/invitations";

export const POST = route<{ id: string }>(async (_req, { params }) => {
  const me = await requireEmployer();
  return withdraw(me.employerId, me.userId, params.id);
});
