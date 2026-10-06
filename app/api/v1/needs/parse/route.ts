import { requireEmployer } from "@/server/http/guard";
import { limitOrThrow, parseJson, route } from "@/server/http/route";
import { parseNeedText } from "@/server/matching/need-parser";
import { needParseSchema } from "@/server/schemas/needs";

export const maxDuration = 30;

/** Parses vacancy text into a draft for the employer to confirm. Nothing is saved. */
export const POST = route(async (req) => {
  const me = await requireEmployer();
  await limitOrThrow(`llm:${me.userId}`, 30, 3600);
  const { text } = await parseJson(req, needParseSchema);
  return parseNeedText(text);
});
