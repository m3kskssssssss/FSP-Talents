import { requireCandidate } from "@/server/http/guard";
import { parseJson, route } from "@/server/http/route";
import { skillsSchema } from "@/server/schemas/candidate";
import { setSkills } from "@/server/services/candidate";

/** Declared skills only; test-confirmed skills are set by the testing engine. */
export const PUT = route(async (req) => {
  const me = await requireCandidate();
  const { skills } = await parseJson(req, skillsSchema);
  return setSkills(me.profileId, skills, "declared");
});
