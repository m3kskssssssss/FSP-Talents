import type { NextRequest } from "next/server";
import { requireEmployer } from "@/server/http/guard";
import { parseJson, route } from "@/server/http/route";
import { challengeCreateSchema } from "@/server/schemas/challenges";
import { createChallenge, listEmployerChallenges } from "@/server/services/challenges";

export const GET = route(async () => {
  const me = await requireEmployer();
  return { items: await listEmployerChallenges(me.employerId) };
});

export const POST = route(async (req: NextRequest) => {
  const me = await requireEmployer();
  return createChallenge(me.employerId, await parseJson(req, challengeCreateSchema));
});
