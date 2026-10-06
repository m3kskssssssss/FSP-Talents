import { requireEmployer } from "@/server/http/guard";
import { limitOrThrow, parseJson, route } from "@/server/http/route";
import { rephraseArguments } from "@/server/matching/rephrase";
import { rephraseSchema } from "@/server/schemas/needs";
import { searchResults } from "@/server/services/matching";

export const maxDuration = 30;

/** Optional: rewrites the deterministic arguments in natural language (no new facts). */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const me = await requireEmployer();
  await limitOrThrow(`llm:${me.userId}`, 30, 3600);
  const { profileIds } = await parseJson(req, rephraseSchema);
  const res = await searchResults(me.employerId, params.id, {}, 1, 1000);
  const wanted = new Set(profileIds);
  const items = res.items.filter((c) => wanted.has(c.profileId)).map((c) => ({ id: c.profileId, pros: c.pros, cons: c.cons }));
  return rephraseArguments(items);
});
