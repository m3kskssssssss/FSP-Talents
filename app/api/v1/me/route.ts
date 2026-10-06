import { signOut } from "@/server/auth";
import { requireCandidate } from "@/server/http/guard";
import { parseJson, route } from "@/server/http/route";
import { deleteAccountSchema } from "@/server/schemas/candidate";
import { deleteAccount } from "@/server/services/candidate";

/** Account deletion with anonymisation (152-FZ). */
export const DELETE = route(async (req) => {
  const me = await requireCandidate();
  await parseJson(req, deleteAccountSchema);
  await deleteAccount(me.userId, me.profileId);
  await signOut({ redirect: false });
  return { ok: true };
});
