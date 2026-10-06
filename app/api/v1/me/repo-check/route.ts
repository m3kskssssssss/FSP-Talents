import { requireCandidate } from "@/server/http/guard";
import { limitOrThrow, parseJson, route } from "@/server/http/route";
import { repoCheckSchema } from "@/server/schemas/candidate";
import { verifyRepository } from "@/server/services/candidate";

/** Hackathon result confirmed by a GitHub repository (trust level "repo"). */
export const POST = route(async (req) => {
  const me = await requireCandidate();
  await limitOrThrow(`gh:${me.userId}`, 20, 3600);
  return verifyRepository(me.profileId, await parseJson(req, repoCheckSchema));
});
